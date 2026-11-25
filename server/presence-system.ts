import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { ServerResponse, type IncomingMessage, type Server } from 'http';
import type { Duplex } from 'stream';
import type { RequestHandler } from 'express';
import { storage } from './storage.js';

// SISTEMA DE PRESENCIA REFORMATEADO COMPLETAMENTE
// Diseño simple: Un usuario = Un estado (online/offline)

interface UserPresence {
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
  sockets: Set<WebSocket>;
}

class PresenceManager {
  private users = new Map<string, UserPresence>();
  private wss: WebSocketServer | null = null;
  private aliveFlags = new WeakMap<WebSocket, boolean>();

  // Resuelve el userId desde la cookie de sesion HTTP corriendo el MISMO
  // middleware de express-session (mismo secret/store que las rutas). El
  // userId nunca viene del cliente.
  private authenticateUpgrade(req: IncomingMessage, sessionMiddleware: RequestHandler): Promise<string | null> {
    return new Promise((resolve) => {
      sessionMiddleware(req as any, new ServerResponse(req) as any, (err?: unknown) => {
        if (err) {
          console.error('[PRESENCE] Session lookup failed on upgrade:', err);
          return resolve(null);
        }
        // Impersonando: sin WebSocket, para no marcar al usuario real como conectado.
        resolve((req as any).session?.impersonatorId ? null : ((req as any).session?.user?.id ?? null));
      });
    });
  }

  // Fire-and-forget con try/catch propio: una BD lenta o caida no debe
  // generar UnhandledPromiseRejection ni afectar la conexion.
  private async markDelivered(userId: string) {
    try {
      await storage.markMessagesAsDelivered(userId);
    } catch (err) {
      console.error('[PRESENCE] Error marking messages as delivered:', err);
    }
  }

  private rejectUpgrade(socket: Duplex, status: number, reason: string) {
    socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  initialize(httpServer: Server, sessionMiddleware: RequestHandler) {
    // noServer + upgrade manual: con `{ server: httpServer, path: '/ws' }`,
    // la libreria `ws` engancha su propio listener de 'upgrade' en TODO el
    // httpServer (no solo en /ws) y, si el path no matchea, aborta el
    // socket con un 400 ANTES de dejar que otro listener (el HMR de Vite,
    // que comparte el mismo httpServer en dev) lo vea — tumbaba cualquier
    // WebSocket que no fuera /ws, incluido `ws://localhost:5000/?token=...`
    // de Vite. Con noServer, ws no toca el evento; nosotros lo filtramos
    // por path a mano y solo llamamos handleUpgrade para /ws.
    this.wss = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', async (req, socket, head) => {
      const { pathname } = new URL(req.url || '', 'http://localhost');
      if (pathname !== '/ws') return;

      // La consulta de sesion es async (store Postgres): mientras tanto un
      // error del socket no debe tumbar el proceso.
      socket.on('error', () => {});
      const userId = await this.authenticateUpgrade(req, sessionMiddleware);
      if (!userId) {
        console.warn('[PRESENCE] WS upgrade rechazado (401): sin sesion valida');
        return this.rejectUpgrade(socket, 401, 'Unauthorized');
      }
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.wss!.emit('connection', ws, req, userId);
      });
    });

    this.wss.on('connection', (ws: WebSocket, _req: IncomingMessage, userId: string) => {
      // Identidad fijada por el servidor desde la sesion; el payload de
      // 'user_connected' del cliente se ignora.
      const currentUserId: string = userId;
      this.aliveFlags.set(ws, true);
      ws.on('pong', () => {
        this.aliveFlags.set(ws, true);
      });

      this.setUserOnline(currentUserId, ws);
      console.log(`[PRESENCE] User ${currentUserId.slice(0,8)} connected`);
      this.markDelivered(currentUserId);

      // Handle incoming messages
      ws.on('message', (data: RawData) => {
        try {
          const message = JSON.parse(data.toString());
          
          // 'user_connected' ya no registra nada: el cliente aun lo manda
          // (useWebSocketFixed/usePresence). Un userId distinto al de la
          // sesion se ignora y se deja constancia.
          if (message.type === 'user_connected' && message.userId && message.userId !== currentUserId) {
            console.warn(`[PRESENCE] user_connected con userId ajeno ignorado (sesion ${currentUserId.slice(0,8)})`);
          }

          if (message.type === 'heartbeat') {
            // User is still alive - update last seen
            const user = this.users.get(currentUserId);
            if (user) {
              user.lastSeen = new Date();
            }
            // Acuse: el cliente lo usa para detectar sockets zombie al volver de segundo plano.
            try { ws.send('{"type":"pong"}'); } catch {}
          }
          
          // Indicador "Escribiendo...": se reenvia solo al destinatario. El userId del
          // evento sale del socket autenticado (currentUserId), nunca del payload.
          if ((message.type === 'typing_start' || message.type === 'typing_stop')
              && currentUserId && typeof message.receiverId === 'string' && message.receiverId !== currentUserId) {
            this.sendToUser(message.receiverId, { type: message.type, userId: currentUserId, threadId: message.threadId ?? null });
          }

          if (message.type === 'presence_leaving' && currentUserId) {
            this.setUserOffline(currentUserId);
            console.log(`[PRESENCE] User ${currentUserId.slice(0,8)} left manually`);
          }
          
        } catch (error) {
          console.error('[PRESENCE] Message parse error:', error);
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        if (currentUserId) {
          this.removeSocket(currentUserId, ws);
          console.log(`[PRESENCE] Socket closed for ${currentUserId.slice(0,8)}`);
        }
      });
      
      ws.on('error', (error: Error) => {
        console.error('[PRESENCE] Socket error:', error);
        if (currentUserId) {
          this.removeSocket(currentUserId, ws);
        }
      });
    });

    // Deteccion de sockets "zombie": un proxy o el SO del celular puede
    // cortar el TCP en silencio (app en segundo plano, pantalla bloqueada)
    // sin mandar un frame de cierre real. `readyState` se queda en OPEN y
    // `socket.send()` en sendToUser() no lanza error -> el mensaje se
    // pierde sin que nadie se entere. Ping/pong estandar de `ws`: si un
    // socket no respondio al ping anterior, se lo termina (esto SI dispara
    // 'close' de verdad, limpia el registro via removeSocket, y el cliente
    // reconecta via su propio scheduleReconnect).
    setInterval(() => {
      this.wss!.clients.forEach((ws) => {
        if (this.aliveFlags.get(ws) === false) {
          console.log('[PRESENCE] Ping timeout, terminando socket zombie');
          ws.terminate();
          return;
        }
        this.aliveFlags.set(ws, false);
        try { ws.ping(); } catch {}
      });
    }, 30000);

    console.log('[PRESENCE] System initialized');
  }
  
  private setUserOnline(userId: string, socket: WebSocket) {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        userId,
        isOnline: false,
        lastSeen: new Date(),
        sockets: new Set()
      });
    }
    
    const user = this.users.get(userId)!;
    
    // Clean up dead sockets but allow up to 2 connections per user
    const deadSockets: WebSocket[] = [];
    for (const s of user.sockets) {
      if (s.readyState !== WebSocket.OPEN && s.readyState !== WebSocket.CONNECTING) {
        deadSockets.push(s);
      }
    }
    for (const s of deadSockets) {
      user.sockets.delete(s);
    }
    
    // If too many open sockets, close oldest ones (keep max 2)
    if (user.sockets.size >= 2) {
      const socketsArray = Array.from(user.sockets);
      for (let i = 0; i < socketsArray.length - 1; i++) {
        try {
          if (socketsArray[i].readyState === WebSocket.OPEN) {
            socketsArray[i].close(1000, 'Too many connections');
          }
        } catch (e) {}
        user.sockets.delete(socketsArray[i]);
      }
    }
    
    user.sockets.add(socket);
    
    // If user wasn't online, broadcast change
    if (!user.isOnline) {
      console.log(`[PRESENCE] ${userId.slice(0,8)} going online - first socket connection`);
      user.isOnline = true;
      user.lastSeen = new Date();
      this.broadcastPresenceUpdate(userId, true);
    } else {
      console.log(`[PRESENCE] ${userId.slice(0,8)} reconnected - replaced previous socket`);
    }
    
    // IMPORTANT: Send current online users list to the newly connected user
    this.sendOnlineUsersToSocket(socket, userId);
  }
  
  private sendOnlineUsersToSocket(socket: WebSocket, requestingUserId: string) {
    const onlineUsers = this.getOnlineUsers();
    console.log(`[PRESENCE] Sending ${onlineUsers.length} online users to ${requestingUserId.slice(0,8)}`);
    
    // Send bulk presence update with all currently online users
    const message = JSON.stringify({
      type: 'presence_bulk',
      onlineUsers: onlineUsers,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
        console.log(`[PRESENCE] Sent bulk presence to ${requestingUserId.slice(0,8)}: ${onlineUsers.map(u => u.slice(0,8)).join(', ')}`);
      }
    } catch (error) {
      console.error('[PRESENCE] Error sending bulk presence:', error);
    }
  }
  
  private removeSocket(userId: string, socket: WebSocket) {
    const user = this.users.get(userId);
    if (!user) return;
    
    user.sockets.delete(socket);
    console.log(`[PRESENCE] Socket removed for ${userId.slice(0,8)}, remaining: ${user.sockets.size}`);
    
    // Only go offline if no more sockets AND user was online
    if (user.sockets.size === 0 && user.isOnline) {
      console.log(`[PRESENCE] ${userId.slice(0,8)} going offline - no more active sockets`);
      user.isOnline = false;
      user.lastSeen = new Date();
      this.broadcastPresenceUpdate(userId, false);
    } else if (user.sockets.size > 0) {
      console.log(`[PRESENCE] ${userId.slice(0,8)} staying online - ${user.sockets.size} sockets remaining`);
    }
  }
  
  private setUserOffline(userId: string) {
    const user = this.users.get(userId);
    if (!user) return;
    
    // Close all sockets
    user.sockets.forEach(socket => {
      try {
        socket.terminate();
      } catch {}
    });
    user.sockets.clear();
    
    // Set offline
    if (user.isOnline) {
      user.isOnline = false;
      user.lastSeen = new Date();
      this.broadcastPresenceUpdate(userId, false);
    }
  }
  
  private broadcastPresenceUpdate(userId: string, isOnline: boolean) {
    if (!this.wss) return;
    
    const message = JSON.stringify({
      type: 'presence_update',
      userId,
      status: isOnline ? 'online' : 'offline',
      timestamp: new Date().toISOString()
    });
    
    // Send to all connected clients
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('[PRESENCE] Broadcast error:', error);
        }
      }
    });
    
    console.log(`[PRESENCE] Broadcasted: ${userId.slice(0,8)} is ${isOnline ? 'online' : 'offline'}`);
  }
  
  // Force user offline (for logout)
  forceUserOffline(userId: string) {
    console.log(`[PRESENCE] Force offline: ${userId.slice(0,8)}`);
    this.setUserOffline(userId);
  }
  
  // Get current online users
  getOnlineUsers(): string[] {
    const online: string[] = [];
    this.users.forEach((user, userId) => {
      if (user.isOnline) {
        online.push(userId);
      }
    });
    return online;
  }

  // Debug: Get all users status
  debugAllUsers(): void {
    console.log(`[PRESENCE_DEBUG] === Current User Status ===`);
    this.users.forEach((user, userId) => {
      console.log(`[PRESENCE_DEBUG] User ${userId.slice(0,8)}: ${user.isOnline ? 'ONLINE' : 'OFFLINE'} (${user.sockets.size} sockets)`);
    });
    console.log(`[PRESENCE_DEBUG] === End Status ===`);
  }

  // Broadcast any message to all connected clients
  broadcastMessage(data: any) {
    if (!this.wss) return;
    
    const message = JSON.stringify(data);
    
    // Send to all connected clients
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('[PRESENCE] Message broadcast error:', error);
        }
      }
    });
    
    console.log(`[PRESENCE] ⚡ Broadcasted message: ${data.type}`);
  }

  // Send message to a specific user only (privacy-safe)
  sendToUser(userId: string, data: any): boolean {
    const user = this.users.get(userId);
    if (!user || !user.isOnline || user.sockets.size === 0) {
      console.log(`[PRESENCE] User ${userId.slice(0,8)} is not online, cannot send targeted message`);
      return false;
    }

    const message = JSON.stringify(data);
    let sent = false;

    user.sockets.forEach(socket => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(message);
          sent = true;
        } catch (error) {
          console.error(`[PRESENCE] Error sending to user ${userId.slice(0,8)}:`, error);
        }
      }
    });

    if (sent) {
      console.log(`[PRESENCE] 🎯 Targeted message sent to ${userId.slice(0,8)}: ${data.type}`);
    }
    return sent;
  }
}

// Global instance
const presenceManager = new PresenceManager();

export function setupPresenceSystem(httpServer: Server, sessionMiddleware: RequestHandler): void {
  presenceManager.initialize(httpServer, sessionMiddleware);
  console.log('🚀 [WEBSOCKET] Presence system initialized');
}

export function forceUserOffline(userId: string): void {
  presenceManager.forceUserOffline(userId);
}

export function broadcastMessage(data: any): void {
  presenceManager.broadcastMessage(data);
}

export function sendToUser(userId: string, data: any): boolean {
  return presenceManager.sendToUser(userId, data);
}

export function getOnlineUsers(): string[] {
  return presenceManager.getOnlineUsers();
}

export function debugAllUsers(): void {
  presenceManager.debugAllUsers();
}
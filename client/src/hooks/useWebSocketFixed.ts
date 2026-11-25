import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { queryClient } from '@/lib/queryClient';
import { isImpersonating } from '@/lib/impersonation';

export interface WebSocketMessage {
  type: 'user_connected' | 'send_message' | 'join_chat' | 'message_sent' | 'new_message' | 'presence_update' | 'typing_start' | 'typing_stop' | 'error';
  [key: string]: any;
}

// Singleton: un solo socket real por pestaña, compartido por todos los
// componentes que llamen useWebSocketFixed (chat-fullscreen, messages-section,
// tutor-profile-page, tutor-profile-modal, ...). Antes cada llamada abria su
// propia conexion; con 2+ montadas a la vez (p.ej. split-view desktop:
// MessagesSection + ChatFullscreenWorking) el servidor (presence-system.ts,
// max 2 sockets/usuario) cerraba las de mas, cada cierre disparaba
// reconexion inmediata, y cada reconexion invalidaba las queries de chat
// (evento 'websocket_reconnected') -> loop de render/refetch infinito.
//
// UNICO hook de WS autorizado en el proyecto (ver SESSION_STATE.md fix #5).
// Existio un hook viejo (`useWebSocket.ts`, ya borrado) que cerraba el
// socket y mandaba `presence_leaving` en `visibilitychange === 'hidden'`.
// El servidor responde a `presence_leaving` terminando TODOS los sockets
// del usuario (server/presence-system.ts, setUserOffline) y marcandolo
// offline -> sendToUser() falla en silencio para cualquier otro componente
// (recibia el mensaje del otro usuario o no, dependiendo de si su pestaña
// tenia foco). Por eso este hook NO debe agregar ninguna rama que cierre
// `ws` o mande `presence_leaving` en 'hidden' — perder el foco de la
// pestaña/ventana es normal (alt-tab, minimizar, dos ventanas en paralelo)
// y no debe tumbar la presencia del usuario. Si se necesita otro
// componente con acceso al socket, debe usar ESTE hook (no crear uno
// nuevo) para no reintroducir el bug.

let ws: WebSocket | null = null;
let currentUserId: string | undefined;
let isConnected = false;
let onlineUsers = new Set<string>();
let refCount = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
let isConnecting = false;
let everOpened = false;
const MAX_INITIAL_FAILURES = 5;
const WS_DISABLED = import.meta.env.VITE_DISABLE_WS === "1";
const listeners = new Set<() => void>();
let pongTimer: ReturnType<typeof setTimeout> | null = null;

// Al volver de segundo plano (movil) el socket puede figurar OPEN en el
// navegador y estar muerto en el servidor: el receptor no recibiria en vivo
// hasta que expire el ping del servidor. Se manda heartbeat; el servidor
// responde 'pong'. Sin pong en 2.5s se descarta el socket y se reconecta ya.
function probeSocket() {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentUserId) return;
  if (pongTimer) clearTimeout(pongTimer);
  const probed = ws;
  pongTimer = setTimeout(() => {
    pongTimer = null;
    if (ws !== probed) return;
    try { probed.close(); } catch (e) {}
    ws = null;
    isConnected = false;
    emitChange();
    connectWebSocket();
  }, 2500);
  try {
    probed.send(JSON.stringify({ type: 'heartbeat', userId: currentUserId, timestamp: new Date().toISOString() }));
  } catch (e) {}
}

function emitChange() {
  listeners.forEach((l) => l());
}

function stopHeartbeat() {
  if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  // probeSocket exige pong: un socket half-open (sleep, NAT/proxy idle) sigue
  // OPEN y send() no lanza; sin pong se descarta y se reconecta.
  heartbeatInterval = setInterval(probeSocket, 25000);
}

function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (!currentUserId) return;
  // Si nunca llego a abrir y ya fallo 5 veces seguidas, el socket no existe (p.ej. Vercel): dejar de insistir.
  if (!everOpened && reconnectAttempts >= MAX_INITIAL_FAILURES) return;

  const attempts = reconnectAttempts;
  const delay = Math.min(1000 * Math.pow(1.5, attempts), 10000);
  reconnectAttempts = attempts + 1;

  reconnectTimeout = setTimeout(() => {
    if (currentUserId && (!ws || ws.readyState === WebSocket.CLOSED)) {
      connectWebSocket();
    }
  }, delay);
}

function connectWebSocket() {
  if (WS_DISABLED || !currentUserId || isConnecting) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  isConnecting = true;

  try {
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    ws = socket;

    // Un CONNECTING que nunca resuelve dejaria isConnecting=true y bloquearia todo reintento.
    const connectTimer = setTimeout(() => {
      if (ws !== socket || socket.readyState !== WebSocket.CONNECTING) return;
      isConnecting = false;
      try { socket.close(); } catch (e) {}
      ws = null;
      scheduleReconnect();
    }, 8000);

    socket.onopen = () => {
      clearTimeout(connectTimer);
      isConnecting = false;
      isConnected = true;
      everOpened = true;
      reconnectAttempts = 0;
      emitChange();

      if (currentUserId && ws === socket) {
        socket.send(JSON.stringify({ type: 'user_connected', userId: currentUserId }));
        startHeartbeat();
      }
      window.dispatchEvent(new CustomEvent('websocket_reconnected'));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        window.dispatchEvent(new CustomEvent('websocket_message', { detail: message }));

        if (message.type === 'pong') {
          if (pongTimer) { clearTimeout(pongTimer); pongTimer = null; }
        } else if (message.type === 'presence_update') {
          if (message.status === 'online') {
            onlineUsers.add(message.userId);
          } else {
            onlineUsers.delete(message.userId);
          }
          onlineUsers = new Set(onlineUsers);
          emitChange();
          window.dispatchEvent(new Event('websocket_presence_update'));
        } else if (message.type === 'presence_bulk') {
          onlineUsers = new Set<string>(message.onlineUsers || []);
          emitChange();
          window.dispatchEvent(new Event('websocket_presence_update'));
        } else if (message.type === 'auth_error') {
          isConnected = false;
          onlineUsers = new Set();
          emitChange();
        } else if (message.type === 'candidate_price_updated') {
          // El tutor mando una cotizacion nueva: la lista de candidatos del alumno relee /api/tasks.
          window.dispatchEvent(new CustomEvent('task_list_refresh'));
        } else if (message.type === 'task_status_changed') {
          // El admin cambio el estado de un pedido: alumno y tutor releen /api/tasks.
          window.dispatchEvent(new CustomEvent('task_list_refresh'));
        } else if (message.type === 'new_task_available') {
          // Pedido nuevo publicado: admin y tutores releen sus listas. Se invalida aqui (no en un
          // componente) porque este socket vive siempre; "Disponibles" del tutor tiene clave propia.
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
          queryClient.invalidateQueries({ predicate: q => q.queryKey[0] === '/api/tutors' && q.queryKey[2] === 'available-tasks' });
          window.dispatchEvent(new CustomEvent('new_task_available', { detail: { taskId: message.taskId } }));
        } else if (message.type === 'new_candidate') {
          window.dispatchEvent(new CustomEvent('task_list_refresh'));
          window.dispatchEvent(new CustomEvent('new_candidate', { detail: { taskId: message.taskId, tutorId: message.tutorId } }));
        }
      } catch (error) {
        console.error('[WEBSOCKET] Error parsing message:', error);
      }
    };

    socket.onclose = () => {
      clearTimeout(connectTimer);
      if (ws !== socket) return; // ya reemplazado por una conexion mas nueva
      isConnecting = false;
      isConnected = false;
      emitChange();
      stopHeartbeat();
      scheduleReconnect();
    };

    socket.onerror = () => {
      if (ws !== socket) return;
      isConnecting = false;
      isConnected = false;
      emitChange();
      try { socket.close(); } catch (e) {}
      ws = null;
      scheduleReconnect();
    };
  } catch (e) {
    isConnecting = false;
    scheduleReconnect();
  }
}

function teardown() {
  if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
  stopHeartbeat();
  if (ws) {
    try { ws.close(); } catch (e) {}
    ws = null;
  }
  isConnected = false;
  currentUserId = undefined;
  reconnectAttempts = 0;
  everOpened = false;
  emitChange();
}

function ensureConnection(userId: string) {
  // Impersonando el servidor rechaza el socket: no se intenta, para no reintentar sin fin.
  if (isImpersonating()) return;
  if (currentUserId !== userId) {
    // cambio de usuario (login/logout) en la misma pestana: reiniciar
    teardown();
    currentUserId = userId;
  }
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    reconnectAttempts = 0;
    connectWebSocket();
  }
}

export function useWebSocketFixed(currentUserIdArg?: string) {
  const currentUserIdRef = useRef(currentUserIdArg);
  currentUserIdRef.current = currentUserIdArg;

  const subscribe = useCallback((onStoreChange: () => void) => {
    listeners.add(onStoreChange);
    return () => listeners.delete(onStoreChange);
  }, []);

  const connectedSnapshot = useSyncExternalStore(subscribe, () => isConnected, () => false);
  const onlineUsersSnapshot = useSyncExternalStore(subscribe, () => onlineUsers, () => new Set<string>());
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!currentUserIdArg) return;

    refCount += 1;
    ensureConnection(currentUserIdArg);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentUserIdRef.current) {
        if (!ws || ws.readyState === WebSocket.CLOSED) {
          ensureConnection(currentUserIdRef.current);
        } else {
          probeSocket();
        }
      }
    };

    const handleOnline = () => {
      if (!currentUserIdRef.current) return;
      if (!ws || ws.readyState === WebSocket.CLOSED) ensureConnection(currentUserIdRef.current);
      else probeSocket();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      refCount -= 1;
      if (refCount <= 0) {
        refCount = 0;
        teardown();
      }
    };
  }, [currentUserIdArg]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  const sendChatMessage = useCallback((taskId: string, receiverId: string, messageText: string, attachments: string[] = []) => {
    if (!currentUserIdRef.current) return;
    sendMessage({
      type: 'send_message',
      taskId,
      senderId: currentUserIdRef.current,
      receiverId,
      message: messageText,
      attachments: attachments.length > 0 ? attachments : null
    });
  }, [sendMessage]);

  // Indicador "Escribiendo...": el servidor lo reenvia solo a `receiverId`.
  const sendTyping = useCallback((receiverId: string, isTyping: boolean) => {
    sendMessage({ type: isTyping ? 'typing_start' : 'typing_stop', receiverId });
  }, [sendMessage]);

  const isUserOnline = useCallback((userId: string) => onlineUsersSnapshot.has(userId), [onlineUsersSnapshot]);

  return {
    isConnected: connectedSnapshot,
    onlineUsers: onlineUsersSnapshot,
    sendChatMessage,
    sendTyping,
    isUserOnline
  };
}

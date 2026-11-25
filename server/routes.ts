import type { Express, Request, Response } from "express";
import { chatPreviewText, chatAttachmentKind, type AttachmentKind } from "@shared/chat-preview";
import { MAIN_ADMIN_EMAIL } from "@shared/admin";
import { TASK_FILE_MAX_BYTES } from "@shared/file-limits";
import { compileFilterRule, scanContact, maskContact, describeScan, CONTACT_CENSORSHIP_NOTICE, type FilterRule, type ContactScan } from "@shared/contact-filter";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { verifyPassword, isHashed } from "./password";
import { insertTaskSchema, insertCandidateSchema, insertChatMessageSchema, insertNativePushTokenSchema, reportUserSchema, type Task, type User, type ChatMessage } from "@shared/schema";
import { z } from "zod";

const deleteNativeTokenSchema = z.object({ token: z.string().trim().min(1).max(4096) });
import { broadcastMessage, sendToUser, forceUserOffline, getOnlineUsers } from "./presence-system.js";
import { sendNewMessageNotification, getVapidPublicKey, sendPushNotification, sendNewPedidoNotification, sendNewUserNotification, sendDeadlineReminders } from "./push-notifications";
import {
  sendNewTaskEmail,
  sendNewApplicantEmail,
  sendNewMessageEmail,
  sendPaymentApprovedTutor,
  sendPaymentApprovedStudent,
  sendNewReviewEmail,
  sendRequestReviewEmail,
  sendWelcomeStudentEmail,
  sendActivationEmail,
  EMAIL_PREVIEWS,
} from "./email";
import {
  DEFAULT_PASSWORD, GENERIC_LOGIN_ERROR, DUMMY_PASSWORD_HASH, passwordProblem, newActivationToken, hashActivationToken,
  isActivationTokenShape, loginIpLimiter, loginAccountLimiter, registerLimiter, requestActivationIpLimiter,
  requestActivationAccountLimiter, activateLimiter, changePasswordLimiter, clientErrorLimiter,
} from "./auth-security";
import { logError, routeOf } from "./middleware/error-logger";
import { summarizeDeliveries } from "./delivery-stats";
import { getStudentAlias } from "./student-alias";
import { isTutorLanguage, defaultLanguageForCountry } from "@shared/tutor-language";
import { attachmentFailureSchema, attachmentFailureMessage } from "@shared/attachment-failure";
import { registerObjectStorageRoutes, ObjectStorageService, ObjectNotFoundError } from "./object_storage";
import sharp from "sharp";
import { toPublicTutor, toPublicReview } from "./tutor-public";
import { universitySchema } from "@shared/profile-validation";
import { ERROR_LOG_LEVELS, ERROR_LOG_STATUSES } from "@shared/schema";
import { sideEffectsEnabled } from "./side-effects";
import { registerSuperadmin } from "./superadmin";
import { registerPichangas, releaseExpiredHolds } from "./pichangas";
import { registerAdminPichangas } from "./admin-pichangas";
import { registerPichangaRules } from "./pichanga-rules";
import { IMPERSONATION_MAX_MS } from "./superadmin-rules";

const objectStorageService = new ObjectStorageService();

async function logActivity(userId: string, action: string, detail?: string, req?: any) {
  try {
    const ipAddress = req ? ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '') : '';
    const userAgent = req?.headers['user-agent'] || '';
    const device = /mobile|android|iphone|ipad/i.test(userAgent) ? 'mobile' : 'desktop';
    await storage.createActivityLog({ userId, action, detail, ipAddress, device });
  } catch (e) {
    console.error('[ActivityLog] Error:', e);
  }
}

// Session-based authentication only (removed global variable for security)

// Configure multer for file uploads
// Subidas: en Vercel el disco es de solo lectura, asi que multer guarda en memoria (file.buffer); fuera de Vercel sigue en disco.
const IS_VERCEL = Boolean(process.env.VERCEL);
const fileBytes = (f: Express.Multer.File): Buffer => f.buffer ?? fs.readFileSync(f.path);
const discardFile = (f: Express.Multer.File) => { if (f.path) { try { fs.unlinkSync(f.path); } catch { /* ya no existe */ } } };

const uploadStorage = IS_VERCEL ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `avatar-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Task file upload storage configuration
const taskUploadStorage = IS_VERCEL ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename for task files to match database references
    cb(null, file.originalname);
  }
});

const taskUpload = multer({
  storage: taskUploadStorage,
  limits: {
    fileSize: TASK_FILE_MAX_BYTES,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/', 'video/', 'audio/',
      'application/pdf', 'application/msword', 'application/rtf',
      'application/vnd.openxmlformats-officedocument',
      'application/vnd.ms-powerpoint', 'application/vnd.ms-excel',
      'application/vnd.oasis.opendocument',
      'application/zip', 'application/x-rar', 'application/x-7z-compressed',
      'application/x-zip-compressed', 'application/octet-stream',
      'text/plain', 'text/csv', 'text/html', 'text/css', 'text/markdown',
      'application/x-latex', 'application/x-tex'
    ];
    const allowedExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic',
      '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
      '.odt', '.ods', '.odp',
      '.rtf', '.tex', '.latex',
      '.zip', '.rar', '.7z',
      '.txt', '.csv', '.md',
      '.py', '.java', '.cpp', '.c', '.js', '.ts', '.html', '.css', '.sql', '.r', '.m',
      '.mp4', '.mov', '.avi', '.mp3', '.wav',
      '.dwg', '.dxf'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeMatch = allowedMimeTypes.some(type => file.mimetype.startsWith(type));
    const extMatch = allowedExtensions.includes(ext);
    if (mimeMatch || extMatch) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Se aceptan imágenes, PDFs, Word, PowerPoint, Excel y archivos comprimidos.'));
    }
  }
});

// Configure multer for payment receipt uploads
const paymentReceiptStorage = IS_VERCEL ? multer.memoryStorage() : multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'payments');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `receipt-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, filename);
  }
});

const paymentReceiptUpload = multer({ 
  storage: paymentReceiptStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for receipts!'));
    }
  }
});

// Subset del pedido ancla de un hilo para pintar la tarjeta de cotizacion del
// chat sin esperar GET /api/tasks/:id (sin `delivery`: el cliente no usa este
// subset para pedidos completados). El cliente igual refetchea el pedido real.
function toSendableTaskPreview(task: Task | undefined) {
  if (!task) return null;
  const { id, title, description, currency, budget, deadline, status, assignedTutorId } = task;
  return { id, title, description, currency, budget, deadline, status, assignedTutorId };
}

// Pedidos citados por los mensajes de una pagina, para que el cliente pinte
// las tarjetas de cotizacion sin pedir GET /api/tasks/:id aparte (skeleton).
// Misma forma que GET /api/tasks/:id (task + delivery si completado), asi el
// cliente puede sembrar la cache ["/api/tasks", id] tal cual.
async function getTasksForMessages(messages: Array<{ taskId?: string | null }>) {
  const ids = Array.from(new Set(messages.map(m => m.taskId).filter((id): id is string => !!id)));
  const rows = await storage.getTasksByIds(ids);
  const entries = await Promise.all(rows.map(async (t) => {
    const delivery = t.status === 'completed' ? await storage.getTaskDelivery(t.id) : null;
    return [t.id, { ...t, delivery }] as const;
  }));
  return Object.fromEntries(entries);
}

// Tipo de adjunto sin nombre original: Content-Type del objeto (cache en memoria).
const contentTypeKindCache = new Map<string, AttachmentKind>();
async function attachmentKindByContentType(paths: string[]): Promise<AttachmentKind> {
  const kinds = await Promise.all(paths.map(async (p) => {
    const hit = contentTypeKindCache.get(p);
    if (hit) return hit;
    const ct = p.startsWith("/objects/") ? await new ObjectStorageService().getObjectContentType(p) : null;
    const kind: AttachmentKind = ct?.startsWith("image/") ? "image" : "file";
    if (ct) contentTypeKindCache.set(p, kind);
    return kind;
  }));
  return kinds.every(k => k === "image") ? "image" : "file";
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files statically with proper 404 handling
  // This prevents Vite from serving HTML when files don't exist
  const uploadsPath = path.join(process.cwd(), 'uploads');
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(uploadsPath, decodeURIComponent(req.path));
    // Check if file exists before serving
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        // File doesn't exist - return 404 instead of falling through to Vite
        return res.status(404).json({ error: 'File not found' });
      }
      // File exists, serve it
      next();
    });
  }, express.static(uploadsPath));

  // Impersonacion del super admin + auditoria. Antes del RBAC: "stop" lo llama una sesion que ya no es admin.
  // Antes de toda ruta /api: el modo solo lectura solo alcanza a las rutas registradas despues.
  registerSuperadmin(app);

  // Register Object Storage routes for persistent file storage
  registerObjectStorageRoutes(app);

  // Pichangas: canchas, partidos, anotarse/bajarse.
  registerPichangas(app);
  registerAdminPichangas(app);
  registerPichangaRules(app);

  // Centralized RBAC middleware for all /api/admin/* routes.
  // Admin: full access.
  // Agent: POST /api/admin/tutors if they have add_tutors permission (read from DB for immediacy).
  // Others: 403.
  app.use('/api/admin', async (req: any, res: any, next: any) => {
    const user = (req as any).session?.user;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (user.userType === 'admin') return next(); // full access
    if (user.userType === 'agent') {
      // Always read from DB to ensure permission revocations apply immediately
      const freshAgent = await storage.getUserById(user.id);
      const perms: string[] = (freshAgent as any)?.agentPermissions || [];
      if (req.method === 'POST' && req.path === '/tutors' && perms.includes('add_tutors')) return next();
      // Allow agents to access the task chat endpoint (view_tasks permission)
      if (req.method === 'GET' && /^\/tasks\/[^/]+\/chat$/.test(req.path) && perms.includes('view_tasks')) return next();
      // Allow agents to select or reject a tutor candidate (manage_candidates permission)
      if (req.method === 'POST' && /^\/tasks\/[^/]+\/select-tutor$/.test(req.path) && perms.includes('manage_candidates')) return next();
      if (req.method === 'POST' && /^\/tasks\/[^/]+\/reject-candidate$/.test(req.path) && perms.includes('manage_candidates')) return next();
      return res.status(403).json({ message: "No tienes permiso para esta acción" });
    }
    return res.status(403).json({ message: "Acceso restringido al administrador" });
  });

  // Agents have restricted access to tasks: GET always allowed; POST republish
  // allowed for agents with republish_tasks; all other mutations blocked.
  app.use('/api/tasks', async (req: any, res: any, next: any) => {
    if (req.method === 'GET') return next(); // reads always allowed
    const user = (req as any).session?.user;
    if (user && user.userType === 'agent') {
      // Allow republish endpoint for agents with the republish_tasks permission
      if (req.method === 'POST' && /^\/[^/]+\/republish$/.test(req.path)) {
        const freshAgent = await storage.getUserById(user.id);
        const perms: string[] = (freshAgent as any)?.agentPermissions || [];
        if (perms.includes('republish_tasks')) return next();
      }
      return res.status(403).json({ message: "Los agentes solo tienen acceso de lectura a las tareas" });
    }
    return next();
  });

  // Cuentas pausadas (inactivas) o suspendidas no pueden iniciar sesion ni seguir con sesion abierta.
  // El admin principal nunca se bloquea, para no quedar fuera del panel.
  const accountBlockedMessage = (u: any): string | null => {
    if (!u || u.email === MAIN_ADMIN_EMAIL) return null;
    if (u.status === 'paused') return "Tu cuenta está inactiva. Contacta a soporte para reactivarla.";
    if (u.status === 'suspended') return "Tu cuenta está suspendida. Contacta a soporte.";
    if (u.status === 'deleted') return "Esta cuenta fue eliminada.";
    return null;
  };

  // Ninguna respuesta de /api lleva el campo `password`: muchas rutas devuelven `{ ...user }` o usuarios
  // anidados (tutors, tasks), asi que se filtra en un solo punto en vez de ruta por ruta.
  app.use('/api', (_req, res, next) => {
    res.json = (body: any) => res.type('json').send(JSON.stringify(body, (k, v) => (k === 'password' || k === 'activationTokenHash' || k === 'activationTokenExpires' ? undefined : v)));
    next();
  });

  // Tutores con cuenta pausada o suspendida no aparecen para alumnos ni tutores; admin y agentes ven todo.
  const canSeeInactiveAccounts = (caller: any) => caller?.userType === 'admin' || caller?.userType === 'agent';
  const hideInactiveTutors = <T extends { user?: any }>(list: T[], caller: any): T[] =>
    canSeeInactiveAccounts(caller) ? list : list.filter((t) => !t.user?.status || t.user.status === 'active');

  // System configuration endpoints (bank accounts, country settings) are admin-only.
  // Non-GET requests require admin role.
  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.method === 'GET') return next();
    const user = req.session?.user;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (user.userType !== 'admin') return res.status(403).json({ message: "Acceso restringido al administrador" });
    return next();
  };
  app.use('/api/bank-accounts', requireAdmin);
  app.use('/api/country-settings', requireAdmin);
  app.use('/api/careers', requireAdmin);
  app.use('/api/services', requireAdmin);
  app.use('/api/areas', requireAdmin);
  app.use('/api/min-budget', requireAdmin);

  // In-memory session tracker: userId -> timestamp (ms) of last logged visit
  // A new "visit" is recorded when the user is inactive for >= SESSION_GAP_MS
  const visitSessionTracker = new Map<string, number>();
  const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

  // Middleware to update last_seen and log per-session visits for authenticated users
  // last_seen: escritura fire-and-forget y throttled (1/30s por usuario). Antes
  // era un `await` por CADA request /api/*, un viaje a la BD bloqueando el
  // handler (incluido /api/chat/send). La presencia en vivo ya viene del WS.
  const lastSeenWrittenAt = new Map<string, number>();
  const LAST_SEEN_THROTTLE_MS = 30 * 1000;
  app.use(async (req, res, next) => {
    const user = req.session.user;
    // Impersonando: ni last_seen ni 'visit' del usuario real (los pondria como activo sin estarlo).
    if (user && !req.session.impersonatorId && req.path.startsWith('/api/')) {
      try {
        const nowTs = Date.now();
        if (nowTs - (lastSeenWrittenAt.get(user.id) ?? 0) >= LAST_SEEN_THROTTLE_MS) {
          lastSeenWrittenAt.set(user.id, nowTs);
          storage.updateUserLastSeen(user.id).catch(() => lastSeenWrittenAt.delete(user.id));
        }

        // Log a "visit" event each time the user starts a new session
        // (first request, or after 30+ min of inactivity).
        // The chart still counts DISTINCT users per day so multiple visits/day don't inflate it.
        const now = Date.now();
        const lastVisit = visitSessionTracker.get(user.id);
        if (!lastVisit || now - lastVisit > SESSION_GAP_MS) {
          visitSessionTracker.set(user.id, now);
          await logActivity(user.id, 'visit', undefined, req);
        }
      } catch (error) {
        // Continue even if update fails
      }
    }
    next();
  });

  // Dev-only: previsualizar plantillas de correo sin enviar nada — disabled in production
  app.get("/dev/email-preview", (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).send("Not found");
    }
    const links = Object.entries(EMAIL_PREVIEWS)
      .map(([key, { label }]) => `<li><a href="/dev/email-preview/${key}">${label}</a></li>`)
      .join("");
    res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;">
      <h1>Email previews</h1><ul>${links}</ul></body></html>`);
  });

  app.get("/dev/email-preview/:type", (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).send("Not found");
    }
    const preview = EMAIL_PREVIEWS[req.params.type];
    if (!preview) return res.status(404).send("Unknown preview type");
    res.send(preview.html());
  });

  // Dev-only quick login (no password required) — disabled in production
  app.post("/api/auth/dev-login", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }
    try {
      const { email } = req.body;
      const normalizedEmail = email?.toLowerCase().trim();
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) return res.status(401).json({ message: "Usuario no encontrado" });

      let userType = "student";
      if (user.email === MAIN_ADMIN_EMAIL) {
        userType = "admin";
      } else if ((user as any).role === "agent") {
        userType = "agent";
      } else {
        const tutorProfile = await storage.getTutorByUserId(user.id);
        userType = tutorProfile ? "tutor" : "student";
      }

      const userWithType = { ...user, userType };
      await storage.updateUserLastSeen(user.id);
      req.session.user = userWithType;
      // Esperar a que la sesion quede escrita antes de responder — sin esto
      // el cliente podia recargar y pedir /api/user/current antes de que el
      // guardado (Postgres session store) terminara, viendose como "no logueado".
      const saveError = await new Promise<Error | null>((resolve) => {
        req.session.save((err) => resolve(err ?? null));
      });
      if (saveError) {
        console.error('Session save error:', saveError);
        return res.status(500).json({ message: "Error al guardar la sesión, intenta de nuevo" });
      }
      logActivity(user.id, 'login', `Inicio de sesión rápido como ${userType}`, req);
      res.json({ user: userWithType, message: "Inicio de sesión exitoso" });
    } catch (error) {
      console.error("[POST /api/auth/dev-login] error:", error);
      res.status(500).json({ message: "Error del servidor" });
    }
  });

  // Genera un enlace de activacion de un solo uso (vence en 24 h) y lo envia por Resend. En la base solo queda su SHA-256.
  // `kind`: "new" = cuenta creada por el admin; "reset" = la persona pidio definir o restablecer su contrasena.
  const sendActivationLink = async (user: { id: string; email: string; name: string }, kind: 'new' | 'reset'): Promise<void> => {
    const { token, hash, expires } = newActivationToken();
    await storage.setActivationToken(user.id, hash, expires);
    await sendActivationEmail(user.email, user.name, token, kind);
  };
  const activationFailed = (email: string) => (err: unknown) => console.error('[ACTIVATION] No se pudo enviar el enlace a', email, err);

  // Authentication endpoints
  app.post("/api/auth/login", loginIpLimiter, loginAccountLimiter, async (req, res) => {
    try {
      const { email, password } = req.body ?? {};

      // Normalize email to lowercase for case-insensitive comparison
      const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
      const user = normalizedEmail ? await storage.getUserByEmail(normalizedEmail) : undefined;
      const userPassword = (user as any)?.password as string | null | undefined;

      // UN solo error para todo fallo (cuenta inexistente, clave incorrecta, cuenta de Google o sin activar): no revela que
      // correos estan registrados. Siempre se corre un scrypt (contra un hash de relleno si no hay clave local) para que
      // el tiempo de respuesta tampoco lo delate. La clave por defecto "123456" NUNCA entra, aunque coincida con el hash.
      const verified = typeof password === "string" && verifyPassword(password, userPassword || DUMMY_PASSWORD_HASH);
      if (!user || !userPassword || !verified || password === DEFAULT_PASSWORD) {
        return res.status(401).json({ message: GENERIC_LOGIN_ERROR });
      }
      // Migracion al vuelo: contrasena vieja en texto plano -> se re-guarda con hash (updateUser lo hace).
      if (!isHashed(userPassword)) await storage.updateUser(user.id, { password } as any);
      const blockedMsg = accountBlockedMessage(user);
      if (blockedMsg) {
        return res.status(403).json({ message: blockedMsg });
      }
      
      // Determine userType with fast single query
      let userType = "student"; // default
      console.log("User email:", user.email);
      
      if (user.email === MAIN_ADMIN_EMAIL) {
        userType = "admin";
        console.log("Detected as ADMIN");
      } else if ((user as any).role === "agent") {
        userType = "agent";
        console.log("Detected as AGENT");
      } else {
        // Fast check: single query instead of loading all tutors
        const tutorProfile = await storage.getTutorByUserId(user.id);
        
        if (tutorProfile) {
          userType = "tutor";
          console.log("Detected as TUTOR");
        } else {
          userType = "student";
          console.log("Detected as STUDENT");
        }
      }
      
      const userWithType = { ...user, userType };
      console.log("Final userType:", userType);
      
      // Update last_seen when user logs in (no bloquea la respuesta)
      storage.updateUserLastSeen(user.id).catch((e) => console.error('[Login] updateUserLastSeen:', e));
      
      // Store user in session only (no global variable for security)
      req.session.user = userWithType;

      // Esperar el guardado antes de responder — mismo motivo que dev-login arriba.
      const saveError = await new Promise<Error | null>((resolve) => {
        req.session.save((err) => resolve(err ?? null));
      });
      if (saveError) {
        console.error('Session save error:', saveError);
        return res.status(500).json({ message: "Error al guardar la sesión, intenta de nuevo" });
      }

      logActivity(user.id, 'login', `Inicio de sesión como ${userType}`, req);

      // Backfill supabaseUid for existing users who don't have it stored yet
      if (!(user as any).supabaseUid) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey) {
          fetch(
            `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(normalizedEmail)}&per_page=10`,
            { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
          ).then(async r => {
            if (!r.ok) return;
            const data = await r.json() as { users?: { id: string; email: string }[] };
            const match = data.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
            if (match?.id) {
              await storage.updateUser(user.id, { supabaseUid: match.id } as any);
            }
          }).catch((err) => {
            console.error('[Login] Error al obtener supabaseUid para', normalizedEmail, err);
          });
        }
      }

      res.json({ 
        user: userWithType,
        message: "Inicio de sesión exitoso"
      });
    } catch (error) {
      console.error("[POST /api/auth/login] error:", error);
      res.status(500).json({ message: "Error del servidor" });
    }
  });

  app.post("/api/auth/register", registerLimiter, async (req, res) => {
    try {
      const { email, password, university, country, whatsapp } = req.body;
      // El cliente nunca elige su tipo de cuenta: la sesion arranca siempre como "student" y pasa a "tutor"
      // solo cuando el admin crea su perfil de tutor.

      // Normalize email to lowercase for consistent storage
      const normalizedEmail = email?.toLowerCase().trim();
      if (!normalizedEmail) {
        return res.status(400).json({ message: "Email requerido" });
      }
      const passwordIssue = passwordProblem(password);
      if (passwordIssue) {
        return res.status(400).json({ message: passwordIssue });
      }
      // El registro ya no pide nombre/pais/whatsapp: el onboarding los completa
      // al entrar. name es notNull, asi que cae al prefijo del email (igual que Google).
      const name = (req.body.name as string | undefined)?.trim() || normalizedEmail.split('@')[0];

      // Check if user already exists (fast single query)
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      
      if (existingUser) {
        return res.status(400).json({ message: "Este email ya está registrado" });
      }
      
      // Parse User-Agent for device info
      const userAgent = req.headers['user-agent'] || '';
      const registrationDevice = /mobile|android|iphone|ipad/i.test(userAgent) 
        ? (/ipad/i.test(userAgent) ? 'tablet' : 'mobile') 
        : 'desktop';
      
      // Detect browser
      let registrationBrowser = 'Unknown';
      if (/chrome/i.test(userAgent) && !/edge|edg/i.test(userAgent)) registrationBrowser = 'Chrome';
      else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) registrationBrowser = 'Safari';
      else if (/firefox/i.test(userAgent)) registrationBrowser = 'Firefox';
      else if (/edge|edg/i.test(userAgent)) registrationBrowser = 'Edge';
      else if (/opera|opr/i.test(userAgent)) registrationBrowser = 'Opera';
      
      // Detect OS
      let registrationOS = 'Unknown';
      if (/iphone|ipad/i.test(userAgent)) registrationOS = 'iOS';
      else if (/android/i.test(userAgent)) registrationOS = 'Android';
      else if (/windows/i.test(userAgent)) registrationOS = 'Windows';
      else if (/macintosh|mac os/i.test(userAgent)) registrationOS = 'macOS';
      else if (/linux/i.test(userAgent)) registrationOS = 'Linux';
      
      // Get IP address
      const registrationIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
        || req.socket.remoteAddress 
        || 'Unknown';
      
      // Try to get location from IP (using free ip-api.com service)
      let registrationCity = '';
      let registrationCountry = '';
      try {
        const ipForGeo = registrationIP === '::1' || registrationIP === '127.0.0.1' ? '' : registrationIP;
        if (ipForGeo) {
          const geoResponse = await fetch(`http://ip-api.com/json/${ipForGeo}?fields=city,country`);
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            registrationCity = geoData.city || '';
            registrationCountry = geoData.country || '';
          }
        }
      } catch (geoError) {
        console.log('[REGISTER] Could not get geolocation:', geoError);
      }
      
      // Create new user with normalized email and registration tracking
      const newUser = await storage.createUser({
        name,
        email: normalizedEmail,
        university,
        country,
        whatsapp,
        password, // la elegida por la persona; antes se ignoraba y la cuenta quedaba con la clave por defecto
        rating: "0.0",
        tasksPublished: 0,
        tasksCompleted: 0,
        status: "active",
        registrationDevice,
        registrationBrowser,
        registrationOS,
        registrationIP,
        registrationCity,
        registrationCountry,
      });

      const userWithType = { ...newUser, userType: "student" };
      
      req.session.user = userWithType;
      await new Promise<void>((resolve) => {
        req.session.save((err) => {
          if (err) console.error('[REGISTER] Session save error:', err);
          resolve();
        });
      });

      console.log(`[REGISTER] Auto-login for new user: ${normalizedEmail}`);
      
      logActivity(newUser.id, 'register', `Registro como student: ${name}`, req);

      // Notify admin about the new user
      sendNewUserNotification(name, normalizedEmail, 'student', registrationCountry).catch(err =>
        console.error('[Push] Error notifying admin of new user:', err)
      );

      sendWelcomeStudentEmail(normalizedEmail, name)
        .catch(err => console.error('[EMAIL] Welcome email error:', err));

      res.json({ 
        user: userWithType,
        message: "Cuenta creada exitosamente"
      });
    } catch (error) {
      console.error("[POST /api/auth/register] error:", error);
      res.status(500).json({ message: "Error del servidor" });
    }
  });

  // Social login via Supabase OAuth (Google, etc.)
  // Requires a valid Supabase Bearer token — email is taken from verified token, not request body
  app.patch("/api/auth/complete-profile", async (req, res) => {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      const { name, country, whatsapp } = req.body as { name?: string; country?: string; whatsapp?: string };
      if (!name?.trim() || !country?.trim() || !whatsapp?.trim()) {
        return res.status(400).json({ message: "Nombre, país y WhatsApp son requeridos" });
      }
      const setting = await storage.getCountrySettingByCode(country.trim());
      const currency = setting?.currencyCode || "PEN";
      const updated = await storage.updateUser(sessionUser.id, {
        name: name.trim(),
        country: country.trim(),
        whatsapp: whatsapp.trim(),
        currency,
      });
      if (!updated) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      req.session.user = { ...sessionUser, name: updated.name, country: updated.country, whatsapp: updated.whatsapp, currency: updated.currency };
      await new Promise<void>((resolve) => {
        req.session.save((err) => {
          if (err) console.error('[complete-profile] Session save error:', err);
          resolve();
        });
      });
      res.json({ user: updated });
    } catch (error) {
      console.error('[complete-profile] Error:', error);
      res.status(500).json({ message: "Error del servidor" });
    }
  });

  app.post("/api/auth/social-login", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!accessToken) {
        return res.status(401).json({ message: "Token de autenticación requerido" });
      }

      // Verify the token with Supabase and extract the authenticated user's identity
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        return res.status(500).json({ message: "Configuración de autenticación incompleta" });
      }

      const supabaseResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
        },
      });

      if (!supabaseResponse.ok) {
        return res.status(401).json({ message: "Token inválido o expirado" });
      }

      const supabaseUser = await supabaseResponse.json() as { id?: string; email?: string; user_metadata?: { full_name?: string; name?: string; avatar_url?: string } };
      const email = supabaseUser.email;
      const supabaseAuthUid = supabaseUser.id;
      const name = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || email?.split('@')[0];

      if (!email) {
        return res.status(401).json({ message: "No se pudo obtener el email del proveedor" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      let user = await storage.getUserByEmail(normalizedEmail);

      // Pestaña "Soy tutor" en /login: los tutores no se crean solos (los activa el admin tras la postulacion).
      // Sin perfil de tutor no se crea usuario ni sesion; el cliente manda al formulario de postulacion.
      // Es intencion de UX, no permiso: el tipo de cuenta lo sigue definiendo la tabla de tutores mas abajo.
      if (req.body?.intent === 'tutor' && user?.email !== MAIN_ADMIN_EMAIL && (user as any)?.role !== 'agent') {
        const tutorProfile = (user && await storage.getTutorByUserId(user.id)) || await storage.getTutorByEmail(normalizedEmail);
        if (!tutorProfile) {
          return res.status(403).json({
            code: 'TUTOR_NOT_ACTIVE',
            message: "Tu cuenta de tutor no está activa o aún no has postulado. Por favor completa la postulación.",
          });
        }
      }

      const isNewUser = !user;

      if (!user) {
        // Auto-register new social user (no password — social only)
        const userAgent = req.headers['user-agent'] || '';
        const registrationDevice = /mobile|android|iphone|ipad/i.test(userAgent) ? 'mobile' : 'desktop';
        user = await storage.createUser({
          name: name || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          university: '',
          country: '',
          whatsapp: '',
          password: null, // Google: sin contrasena local (el login por email ya lo bloquea)
          rating: "0.0",
          tasksPublished: 0,
          tasksCompleted: 0,
          status: "active",
          registrationDevice,
          registrationBrowser: 'Google OAuth',
          registrationOS: '',
          registrationIP: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || '',
          registrationCity: '',
          registrationCountry: '',
          supabaseUid: supabaseAuthUid || null,
        } as any);
        sendNewUserNotification(name || normalizedEmail, normalizedEmail, 'student', '').catch(() => {});
        sendWelcomeStudentEmail(normalizedEmail, name || normalizedEmail.split('@')[0])
          .catch(err => console.error('[EMAIL] Welcome email error (social):', err));
      }

      // Determine userType
      // Save supabaseUid for existing users who don't have it stored yet
      if (supabaseAuthUid && !(user as any).supabaseUid) {
        await storage.updateUser(user.id, { supabaseUid: supabaseAuthUid } as any);
        (user as any).supabaseUid = supabaseAuthUid;
      }

      const socialBlockedMsg = accountBlockedMessage(user);
      if (socialBlockedMsg) {
        return res.status(403).json({ message: socialBlockedMsg });
      }

      let userType = "student";
      if (user.email === MAIN_ADMIN_EMAIL) {
        userType = "admin";
      } else if ((user as any).role === "agent") {
        userType = "agent";
      } else {
        let tutorProfile = await storage.getTutorByUserId(user.id);

        // Fallback: if no tutor found by user_id, search by email.
        // This handles the case where the tutor was manually created with a
        // different user_id in the tutors table than the id in the users table.
        if (!tutorProfile) {
          tutorProfile = await storage.getTutorByEmail(normalizedEmail);
          if (tutorProfile) {
            // Repair the link so future lookups succeed without the fallback
            console.log(`[social-login] Repairing tutor user_id: tutor ${tutorProfile.id} → user ${user.id}`);
            await storage.updateTutor(tutorProfile.id, { user_id: user.id });
          }
        }

        userType = tutorProfile ? "tutor" : "student";
      }

      const userWithType = { ...user, userType };
      await storage.updateUserLastSeen(user.id);
      req.session.user = userWithType;
      await new Promise<void>((resolve) => {
        req.session.save((err) => {
          if (err) console.error('[social-login] Session save error:', err);
          resolve();
        });
      });
      logActivity(user.id, 'login', `Inicio de sesión social (Google) como ${userType}`, req);

      res.json({ user: userWithType, message: "Inicio de sesión exitoso", isNewUser });
    } catch (error) {
      console.error('[social-login] Error:', error);
      res.status(500).json({ message: "Error del servidor" });
    }
  });

  // Reset password in our DB after Supabase confirms it
  // Requires a valid Supabase access token (Bearer) to prevent unauthenticated account takeover
  app.post("/api/auth/reset-password-confirm", async (req, res) => {
    try {
      const { newPassword } = req.body;
      const authHeader = req.headers.authorization || '';
      const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!accessToken || !newPassword) {
        return res.status(400).json({ message: "Datos incompletos o token faltante" });
      }
      const resetIssue = passwordProblem(newPassword);
      if (resetIssue) {
        return res.status(400).json({ message: resetIssue });
      }

      // Verify the Supabase token and get the authenticated user's email
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        return res.status(500).json({ message: "Configuración de autenticación incompleta" });
      }

      const supabaseResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
        },
      });

      if (!supabaseResponse.ok) {
        return res.status(401).json({ message: "Token inválido o expirado. Solicita un nuevo enlace de recuperación." });
      }

      const supabaseUser = await supabaseResponse.json() as { email?: string };
      const verifiedEmail = supabaseUser.email?.toLowerCase().trim();

      if (!verifiedEmail) {
        return res.status(401).json({ message: "No se pudo verificar la identidad del usuario." });
      }

      const user = await storage.getUserByEmail(verifiedEmail);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      await storage.updateUser(user.id, { password: newPassword } as any);
      res.json({ message: "Contraseña actualizada" });
    } catch (error) {
      console.error('[reset-password-confirm] Error:', error);
      res.status(500).json({ message: "Error del servidor" });
    }
  });

  // ---- Definir o restablecer la contrasena con un enlace de un solo uso enviado por correo (Resend) ----
  // Respuesta SIEMPRE igual, exista o no la cuenta (no revela que correos estan registrados); el envio va despues de responder.
  app.post("/api/auth/request-activation", requestActivationIpLimiter, requestActivationAccountLimiter, async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
    res.json({ message: "Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa también el spam." });
    if (!email || email.length > 254) return;
    try {
      const user = await storage.getUserByEmail(email);
      if (!user || accountBlockedMessage(user)) return;
      await sendActivationLink(user, 'reset');
    } catch (error) {
      console.error("[POST /api/auth/request-activation] error:", error);
    }
  });

  // Canjea el enlace: fija la contrasena y lo invalida en un solo UPDATE. Valida la clave ANTES de gastar el token.
  app.post("/api/auth/activate", activateLimiter, async (req, res) => {
    const invalidLink = "El enlace no es válido o ya venció. Solicita uno nuevo.";
    try {
      const { token, password } = req.body ?? {};
      if (!isActivationTokenShape(token)) return res.status(400).json({ message: invalidLink });
      const issue = passwordProblem(password);
      if (issue) return res.status(400).json({ message: issue });
      const user = await storage.consumeActivationToken(hashActivationToken(token), password);
      if (!user) return res.status(400).json({ message: invalidLink });
      logActivity(user.id, 'password_set', 'Contraseña definida con enlace de activación', req);
      res.json({ message: "Contraseña restablecida. Ya puedes iniciar sesión.", email: user.email });
    } catch (error) {
      console.error("[POST /api/auth/activate] error:", error);
      res.status(500).json({ message: "Error del servidor" });
    }
  });

  // Get current user and update last_seen
  app.get("/api/user/current", async (req, res) => {
    try {
      // Use session for authentication
      const sessionUser = req.session.user;
      if (sessionUser) {
        // Always fetch fresh data from database to get latest avatar
        const freshUser = await storage.getUser(sessionUser.id);
        // Al impersonar, una cuenta pausada/suspendida se puede ver igual (no destruir la sesion del super admin).
        if (freshUser && !req.session.impersonatorId && accountBlockedMessage(freshUser)) {
          // Cuenta pausada/suspendida despues de iniciar sesion: cerrar la sesion
          return req.session.destroy(() => {
            res.status(401).json({ message: accountBlockedMessage(freshUser) });
          });
        }
        if (freshUser) {
          // Add userType based on email and tutor table
          let userType = "student"; // default
          console.log("Current user endpoint - User email:", freshUser.email);
          
          if (freshUser.email === MAIN_ADMIN_EMAIL) {
            userType = "admin";
            console.log("Current user detected as ADMIN");
          } else if ((freshUser as any).role === "agent") {
            userType = "agent";
            console.log("Current user detected as AGENT with permissions:", (freshUser as any).agentPermissions);
          } else {
            // Fast check: single query instead of loading all tutors
            const tutorProfile = await storage.getTutorByUserId(freshUser.id);
            
            if (tutorProfile) {
              userType = "tutor";
              console.log("Current user detected as TUTOR");
            } else {
              userType = "student";
              console.log("Current user detected as STUDENT");
            }
          }
          
          console.log("Final userType for current user:", userType);
          
          const userWithType = { ...freshUser, userType };

          // Las consultas de arriba tardan: si entre tanto se inicio o termino una impersonacion (o se cerro sesion), guardar
          // la copia leida al entrar desharia ese cambio. Se relee la sesion y, si ya es de otro usuario, no se escribe:
          // con el 409 el cliente reintenta y obtiene la identidad correcta.
          const sameUser = await new Promise<boolean>((resolve) => {
            req.session.reload((err) => resolve(!err && req.session.user?.id === sessionUser.id));
          });
          if (!sameUser) return res.status(409).json({ message: "La sesión cambió" });

          // Update session with fresh data including userType
          req.session.user = userWithType;
          res.json(req.session.impersonatorId
            ? { ...userWithType, impersonating: true, impersonationExpiresAt: (req.session.impersonationStartedAt ?? 0) + IMPERSONATION_MAX_MS }
            : userWithType);
        } else {
          // Sesion de un usuario que ya no existe (cuenta borrada): cerrarla y responder 401, para que el
          // cliente vaya a /login. Con 404 la app se quedaba en el spinner sin salida.
          req.session.destroy(() => {
            res.status(401).json({ message: "No user logged in" });
          });
        }
      } else {
        res.status(401).json({ message: "No user logged in" });
      }
    } catch (error) {
      console.error("Error getting current user:", error);
      res.status(500).json({ message: "Failed to get current user" });
    }
  });

  // Get current tutor profile
  app.get("/api/tutor/current", async (req, res) => {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser) {
        return res.status(401).json({ message: "No user logged in" });
      }

      // Fast: single query to find current user's tutor profile
      const tutorProfile = await storage.getTutorByUserId(sessionUser.id);

      if (!tutorProfile) {
        // Return default tutor data if not found in tutors table
        return res.json({
          id: sessionUser.id,
          profession: "Tutor Profesional",
          rating: "5.0",
          isVerified: false,
          specialties: [],
          hasGeneralAccess: false,
          assignedCourses: []
        });
      }

      // Get tutor's assigned courses
      const assignedCourses = await storage.getTutorCourses(tutorProfile.id);

      res.json({
        id: tutorProfile.id,
        profession: tutorProfile.profession || "Tutor Profesional",
        rating: tutorProfile.rating || "5.0",
        isVerified: tutorProfile.isVerified || false,
        specialties: tutorProfile.specialties || [],
        hasGeneralAccess: tutorProfile.hasGeneralAccess || false,
        assignedCourses: assignedCourses || [],
        bio: tutorProfile.bio || null,
        language: tutorProfile.language || null
      });
    } catch (error) {
      console.error("Error getting current tutor:", error);
      res.status(500).json({ message: "Failed to get tutor profile" });
    }
  });

  // Igual que /api/tutors/:tutorId/available-tasks pero resuelve el tutor
  // por sesion — evita que el cliente tenga que esperar la respuesta de
  // /api/tutor/current antes de poder pedir las tareas (waterfall de 2
  // round-trips en serie que causaba la demora al entrar como tutor).
  app.get("/api/tutor/available-tasks", async (req, res) => {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser) {
        return res.status(401).json({ message: "No user logged in" });
      }

      const tutor = await storage.getTutorByUserId(sessionUser.id);
      if (!tutor) return res.json([]);

      let since: Date | undefined;
      if (req.query.since && typeof req.query.since === 'string') {
        const parsed = new Date(req.query.since);
        if (!isNaN(parsed.getTime())) since = parsed;
      }

      const tasks = await storage.getAvailableTasksForTutor(tutor.id, {
        since,
        tutorUserId: tutor.user_id,
        tutor,
      });

      const annotatedTasks = tasks.map((task: any) => ({
        ...task,
        isInvited: Array.isArray(task.invitedTutorIds) && task.invitedTutorIds.includes(tutor.user_id),
      }));

      res.json(annotatedTasks);
    } catch (error) {
      console.error("Error getting available tasks for tutor:", error);
      res.status(500).json({ message: "Error al obtener pedidos disponibles" });
    }
  });

  // My tutors — must be registered BEFORE /api/users/:userId to avoid route conflict
  app.get('/api/users/my-tutors', async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      const userId = req.session.user.id;
      const seen = new Set<string>();
      const result: any[] = [];
      // 1. Favorites
      const favs = await storage.getUserFavorites(userId);
      for (const fav of favs) {
        if (fav.tutor && !seen.has(fav.tutor.user_id)) {
          seen.add(fav.tutor.user_id);
          result.push({ id: fav.tutor.id, slug: fav.tutor.slug ?? null, user_id: fav.tutor.user_id, name: fav.tutor.user?.name || '', avatar: fav.tutor.user?.avatar || null, profession: fav.tutor.profession || null, rating: fav.tutor.rating || '0', isFavorite: true });
        }
      }
      // 2. Previously hired (only in_progress or completed tasks)
      const studentTasks = await storage.getTasksByUserId(userId);
      const assignedUserIds = Array.from(new Set(
        studentTasks
          .filter((t: any) => t.assignedTutorId && ['in_progress', 'completed'].includes(t.status))
          .map((t: any) => t.assignedTutorId as string)
      ));
      for (const assignedUserId of assignedUserIds) {
        if (!seen.has(assignedUserId)) {
          const tutor = await storage.getTutorByUserId(assignedUserId);
          if (tutor) {
            seen.add(assignedUserId);
            result.push({ id: tutor.id, slug: tutor.slug ?? null, user_id: tutor.user_id, name: tutor.user?.name || '', avatar: tutor.user?.avatar || null, profession: tutor.profession || null, rating: tutor.rating || '0', isFavorite: false });
          }
        }
      }
      res.json(result);
    } catch (error) {
      console.error('Error getting my-tutors:', error);
      res.status(500).json({ message: "Failed to get tutors" });
    }
  });

  // Get user by ID (for chat profiles)
  app.get('/api/users/:userId', async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Determine user type
      let userType = "student"; // default
      
      if (user.email === MAIN_ADMIN_EMAIL) {
        userType = "admin";
      } else {
        // Fast check: single query instead of loading all tutors
        const tutorProfile = await storage.getTutorByUserId(user.id);
        
        if (tutorProfile) {
          userType = "tutor";
        } else {
          userType = "student";
        }
      }
      
      const userData = {
        ...user,
        userType
      };
      
      res.json(userData);
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", async (req, res) => {
    // Impersonando: cerrar sesion no debe tocar last_seen, presencia ni push del usuario impersonado.
    const userId = req.session.impersonatorId ? undefined : req.session.user?.id;

    // Update last_seen to current time when logging out. Sin await: son escrituras a la base (~150 ms cada una)
    // y el usuario no debe esperarlas para salir; se registran los fallos igual.
    if (userId) {
      storage.updateUserLastSeen(userId).catch((error) => console.error("Error updating last_seen on logout:", error));
      // Baja de la suscripcion push web en esta misma peticion (antes era otra ida y vuelta previa desde el cliente).
      const pushEndpoint = req.body?.pushEndpoint;
      if (typeof pushEndpoint === "string" && pushEndpoint) {
        storage.deletePushSubscription(userId, pushEndpoint).catch((error) => console.error("Error removing push subscription on logout:", error));
      }
    }

    if (userId) {
      logActivity(userId, 'logout', 'Cerró sesión', req);
    }
    
    // FORCE OFFLINE IMMEDIATELY ON LOGOUT
    if (userId) {
      console.log(`[AUTH_LOGOUT] 🚪 User ${userId.slice(0,8)} logging out - FORCE cleaning presence`);
      
      try {
        forceUserOffline(userId);
        console.log(`[AUTH_LOGOUT] ✅ Forced offline for ${userId.slice(0,8)}`);
      } catch (error) {
        console.log(`[AUTH_LOGOUT] ❌ Failed to force offline: ${error}`);
      }
    }
    
    // Responde dentro del callback; la cookie se limpia aunque la destruccion falle.
    // Mismos atributos que la cookie de sesion (server/index.ts) para que el navegador la reconozca.
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
      res.clearCookie('miltareas.session', {
        httpOnly: true,
        secure: req.secure,
        sameSite: req.secure ? 'none' : 'lax',
        path: '/',
      });
      res.json({ message: "Logout successful" });
    });
  });

  // Get tasks with candidates - SECURITY: Filter by user type
  app.get("/api/tasks", async (req, res) => {
    try {
      const user = req.session.user;
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // 🔒 SECURITY FIX: Filter tasks based on user type
      let tasks: any[] = [];
      
      if (user.userType === 'student' || user.email.includes('alumno')) {
        // Students: Only see their OWN tasks
        tasks = await storage.getTasksByUserId(user.id);
      } else if (user.userType === 'tutor' || user.email.includes('tutor')) {
        // Tutors: See only tasks matching their ADMIN-ASSIGNED courses (or all if hasGeneralAccess)
        const tutorProfile = await storage.getTutorByUserId(user.id);
        
        if (!tutorProfile) {
          console.log(`[TUTOR_FILTER] No tutor profile found for ${user.email}`);
          tasks = [];
        } else {
          // Use the new course-based filtering logic
          // Las 3 lecturas son independientes entre si: en paralelo (antes ~10 viajes en serie).
          const [availableTasks, tutorCourses, allTasks] = await Promise.all([
            storage.getAvailableTasksForTutor(tutorProfile.id, { tutor: tutorProfile }),
            storage.getTutorCourses(tutorProfile.id), // para filtrar tambien los pedidos ya postulados
            storage.getTasksWithCandidates(),
          ]);
          const availableTaskIds = new Set(availableTasks.map(t => t.id));
          const assignedCourseValues = tutorCourses.map(c => c.value);
          
          // Also include tasks where tutor has already applied (to see their status)
          // NOTE: candidates.tutorId references users.id, not tutors.id
          // IMPORTANT: Applied tasks MUST also respect course permissions
          const appliedButNotAvailable = allTasks.filter((task: any) => {
            // Must have applied to this task
            const hasApplied = task.candidates?.some((c: any) => c.tutorId === user.id);
            if (!hasApplied) return false;
            
            // Skip if already in available tasks
            if (availableTaskIds.has(task.id)) return false;
            
            // If tutor has general access, show all applied tasks
            if (tutorProfile.hasGeneralAccess) return true;
            
            // Otherwise, filter by assigned courses
            return task.studyArea && assignedCourseValues.includes(task.studyArea);
          });
          
          tasks = [...availableTasks, ...appliedButNotAvailable];
        }
        
        // Anonymize student info — avatar/lastSeen ya vienen en task.user
        // desde storage, evita que el front tenga que pedir /api/users
        // completo solo para armar un mapa de presencia.
        tasks = tasks.map((task: any) => ({
          ...task,
          studentName: getStudentAlias(task.userId),
          studentAvatar: task.user?.avatar || "",
          studentLastSeen: task.user?.lastSeen || null,
          university: "Universidad Privada",
        }));
      } else if (user.userType === 'agent') {
        // Agent: Enforce task-related permissions — always read from DB to avoid stale session
        const freshAgent = await storage.getUserById(user.id);
        const agentPerms: string[] = (freshAgent as any)?.agentPermissions || [];
        const hasTaskAccess = agentPerms.includes('view_tasks') || agentPerms.includes('manage_candidates') || agentPerms.includes('republish_tasks');
        if (!hasTaskAccess) {
          return res.status(403).json({ message: "No tienes permiso para ver pedidos" });
        }
        const rawTasks = await storage.getTasksWithCandidates();
        tasks = rawTasks.map((task: any) => ({
          ...task,
          // Anonymize student data — same as tutor view
          studentName: getStudentAlias(task.userId),
          studentAvatar: "",
          university: "Universidad Privada",
          // Strip user object to prevent student PII leakage
          user: task.user ? { id: task.user.id } : undefined,
        }));
      } else {
        // Admin: Full access - include delivery dates
        tasks = await storage.getTasksWithCandidates();
        
        // Add deliveredAt from task_deliveries table for each task
        const tasksWithDelivery = await Promise.all(tasks.map(async (task: any) => {
          const delivery = await storage.getTaskDelivery(task.id);
          return {
            ...task,
            deliveredAt: delivery?.createdAt || null
          };
        }));
        tasks = tasksWithDelivery;
      }
      
      res.json(tasks);
    } catch (error) {
      console.error('[SECURITY] Error in /api/tasks endpoint:', error);
      res.status(500).json({ message: "Failed to get tasks" });
    }
  });

  // Upload task files endpoint - Uses Object Storage for persistence
  app.post("/api/tasks/upload", (req, res, next) => {
    taskUpload.array('files', 5)(req, res, (err) => {
      if (err) {
        console.error("📁 [TASK_UPLOAD] Multer error:", err.message);
        return res.status(400).json({ message: err.message || "Error al subir archivos" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      console.log("📁 [TASK_UPLOAD] Files received:", req.files?.length || 0);
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const user = req.session.user;
      const files = req.files as Express.Multer.File[];
      
      const uploadPromises = files.map(async (file) => {
        try {
          const fileBuffer = fileBytes(file);
          const objectPath = await objectStorageService.uploadObjectEntity(
            fileBuffer,
            file.mimetype || 'application/octet-stream'
          );
          console.log(`📁 [TASK_UPLOAD] ✅ Uploaded to Object Storage: ${objectPath}`);
          try { discardFile(file); } catch (e) {}
          return {
            originalName: file.originalname,
            filename: objectPath,
            size: file.size,
            mimetype: file.mimetype
          };
        } catch (objStorageError) {
          console.error("📁 [TASK_UPLOAD] ❌ Object Storage upload failed:", objStorageError);
          try { discardFile(file); } catch (e) {}
          throw new Error(`Error al subir el archivo "${file.originalname}". Por favor intenta de nuevo.`);
        }
      });

      let uploadedFiles;
      try {
        uploadedFiles = await Promise.all(uploadPromises);
      } catch (uploadError: any) {
        console.error("[POST /api/tasks/upload] error:", uploadError);
        return res.status(500).json({ message: uploadError.message });
      }

      console.log("📁 [TASK_UPLOAD] ✅ All files uploaded successfully");
      res.json({ 
        message: "Files uploaded successfully", 
        files: uploadedFiles 
      });
    } catch (error) {
      console.error("📁 [TASK_UPLOAD] ❌ Upload error:", error);
      res.status(500).json({ message: "File upload failed" });
    }
  });

  // Create a new task
  app.post("/api/tasks", async (req, res) => {
    try {
      console.log("Received task data:", req.body);
      
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // CRITICAL SECURITY: Only students can publish tasks, NEVER tutors
      // Fast check: single DB query instead of loading all tutors
      const tutorProfile = await storage.getTutorByUserId(user.id);
      const isTutor = !!tutorProfile || user.userType === "tutor";
      
      if (isTutor) {
        console.log("🚫 BLOCKED: Tutor attempted to create task");
        return res.status(403).json({ 
          message: "Los tutores no pueden publicar tareas. Solo los estudiantes pueden publicar tareas." 
        });
      }
      
      // Look up currency from student's country settings
      let taskCurrency = "PEN"; // default
      if (user.country) {
        const countrySetting = await storage.getCountrySettingByCode(user.country);
        if (countrySetting) {
          taskCurrency = countrySetting.currencyCode || "PEN";
        }
      }
      
      // Convert deadline string to Date object preserving local timezone
      const processedData = {
        ...req.body,
        currency: taskCurrency,
        deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
        requestType: req.body.requestType || "tarea"
      };
      
      // Remove invitedTutorId if empty string (to avoid foreign key constraint violation)
      if (!processedData.invitedTutorId || processedData.invitedTutorId === '') {
        delete processedData.invitedTutorId;
      } else {
        // Validate invitedTutorId exists if provided
        const invitedTutor = await storage.getUser(processedData.invitedTutorId);
        if (!invitedTutor) {
          console.log("⚠️ invitedTutorId not found, removing from task data:", processedData.invitedTutorId);
          delete processedData.invitedTutorId;
        }
      }
      
      console.log("Processed task data:", processedData);
      const validatedData = insertTaskSchema.parse(processedData);
      console.log("Validated task data:", validatedData);
      
      const task = await storage.createTask(user.id, validatedData);
      console.log("✅ Task created successfully by student:", user.email);
      logActivity(user.id, 'publish_task', `Publicó: "${validatedData.title}"`, req);

      // Notify online tutors about new available task (for PWA install prompt trigger)
      broadcastMessage({ type: 'new_task_available', taskId: task.id });

      // Send WS invitation to specifically invited tutors
      const invitedIds: string[] = Array.isArray((validatedData as any).invitedTutorIds)
        ? (validatedData as any).invitedTutorIds
        : [];
      for (const tutorUserId of invitedIds) {
        if (tutorUserId) {
          sendToUser(tutorUserId, {
            type: 'task_invitation',
            taskId: task.id,
            taskTitle: validatedData.title,
            message: `${user.name} te ha invitado a su pedido: "${validatedData.title}"`,
          });
        }
      }

      // Notify admin about the new pedido
      sendNewPedidoNotification(user.name, validatedData.title, String(task.id)).catch(err =>
        console.error('[Push] Error notifying admin of new pedido:', err)
      );

      // Email + Push relevant tutors about the new task (fire-and-forget)
      ;(async () => {
        try {
          const allTutors = await storage.getTutors();
          const onlineSet = new Set(getOnlineUsers());
          const taskStudyArea = (task as any).studyArea as string | undefined;
          const taskSubject = (task as any).subject as string | undefined;

          // Determine which tutors are eligible by course/access
          const eligibleTutors: Array<{ userId: string; email: string; isOnline: boolean }> = [];
          for (const tutor of allTutors) {
            const userEmail = tutor.user?.email;
            if (!userEmail) continue;
            if (tutor.hasGeneralAccess) {
              eligibleTutors.push({ userId: tutor.user_id, email: userEmail, isOnline: onlineSet.has(tutor.user_id) });
            } else {
              const courses = await storage.getTutorCourses(tutor.id);
              const courseValues = courses.map(c => c.value);
              if (
                (taskStudyArea && courseValues.includes(taskStudyArea)) ||
                (taskSubject && courseValues.includes(taskSubject))
              ) {
                eligibleTutors.push({ userId: tutor.user_id, email: userEmail, isOnline: onlineSet.has(tutor.user_id) });
              }
            }
          }

          // Email — only offline tutors (online ones already see it in real-time)
          const emailTargets = eligibleTutors.filter(t => !t.isOnline).map(t => t.email);
          if (emailTargets.length > 0) {
            await sendNewTaskEmail(emailTargets, task.title, taskStudyArea, String(task.id));
            console.log(`[EMAIL] ✅ New task email sent to ${emailTargets.length} tutor(s)`);
          }

          // Push — all eligible tutors regardless of online status (reaches mobile PWA)
          const pushPromises = eligibleTutors.map(t =>
            sendPushNotification(t.userId, {
              title: '📋 Nueva tarea disponible',
              body: `${taskStudyArea ? `[${taskStudyArea}] ` : ''}${task.title}`,
              tag: `new-task-${task.id}`,
              data: { url: '/jobs', taskId: String(task.id), type: 'task' },
              actions: [{ action: 'view', title: 'Ver tarea' }],
            }).catch(err => console.error(`[Push] Error notifying tutor ${t.userId}:`, err.message))
          );
          await Promise.all(pushPromises);
          const pushCount = eligibleTutors.length;
          if (pushCount > 0) {
            console.log(`[Push] ✅ New task push sent to ${pushCount} tutor(s)`);
          }
        } catch (err) {
          console.error('[EMAIL/PUSH] Error sending new task notifications:', err);
        }
      })();

      res.json(task);

      // Non-blocking contact scan on title + description (fire and forget)
      const textToScan = [validatedData.title, validatedData.description].filter(Boolean).join(' ');
      if (textToScan.trim()) {
        (async () => {
          try {
            const rules = await loadFilterRules();
            const scan = scanContact(textToScan, rules);
            if (!scan.severity) return;

            const detectedSnippet = describeScan(scan);

            await storage.createAdminAlert({
              type: 'personal_contact',
              taskId: task.id,
              studentId: user.id,
              detectedContent: detectedSnippet,
              severity: scan.severity,
              status: 'pending',
            });

            console.log(`[TASK_SCAN] ⚠️  Contacto detectado en pedido ${task.id.slice(-6)} — "${detectedSnippet}"`);
          } catch (err) {
            console.error('[TASK_SCAN] Error:', err);
          }
        })();
      }
    } catch (error) {
      console.error("Task creation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: "Invalid task data", details: error.message });
      } else {
        res.status(400).json({ message: "Invalid task data" });
      }
    }
  });

  // Update task (for editing deadline, files, comments, status)
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (user.userType !== 'admin') {
        return res.status(403).json({ message: "Solo el administrador puede modificar tareas" });
      }
      
      const { id } = req.params;
      const updates = { ...req.body };
      
      // Remove empty string values to avoid overwriting with empty
      Object.keys(updates).forEach(key => {
        if (updates[key] === '' || updates[key] === undefined) {
          delete updates[key];
        }
      });
      
      // Validate that there are fields to update
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }
      
      // Convert deadline string to Date object if present
      if (updates.deadline) {
        updates.deadline = new Date(updates.deadline);
      }
      
      // Validate status if provided
      if (updates.status) {
        const validStatuses = ['active', 'payment_pending', 'payment_rejected', 'in_progress', 'completed', 'expired', 'in_review'];
        if (!validStatuses.includes(updates.status)) {
          return res.status(400).json({ message: "Invalid status" });
        }
      }
      
      console.log(`[TASK_UPDATE] Updating task ${id} with:`, Object.keys(updates));

      // For admin content edits, build audit entries atomically with the update
      const contentFields = ['title', 'description', 'comment', 'status'] as const;
      const isAdminEdit = user.userType === 'admin' && contentFields.some(f => f in updates);

      let task: Awaited<ReturnType<typeof storage.updateTask>>;

      if (isAdminEdit) {
        // Determine which content fields the update touches
        const fieldsToAudit = contentFields.filter(f => f in updates);
        // Update task + read old values + write audit rows in one atomic transaction
        task = await storage.updateTaskWithAuditLogs(id, updates, user.id, fieldsToAudit);
      } else {
        task = await storage.updateTask(id, updates);
      }

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json(task);
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Task audit log endpoint (admin only)
  app.get("/api/tasks/:id/audit-log", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.userType !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { id } = req.params;
      const logs = await storage.getTaskAuditLogs(id);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching task audit log:', error);
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });

  // Update task status endpoint
  app.patch("/api/tasks/:id/status", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      if (user.userType !== 'admin') return res.status(403).json({ message: "Solo el administrador puede cambiar el estado de tareas" });
      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ['active', 'payment_pending', 'payment_rejected', 'in_progress', 'in_review', 'completed', 'cancelled', 'expired'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const task = await storage.updateTaskWithAuditLogs(id, { status }, user.id, ['status']);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      // Avisar al alumno dueno y al tutor asignado para que su lista de pedidos se actualice sin recargar.
      // Se emite DESPUES de guardar: asi el refetch del cliente ya lee el estado nuevo.
      for (const uid of new Set([task.userId, task.assignedTutorId].filter(Boolean) as string[])) {
        sendToUser(uid, { type: 'task_status_changed', taskId: task.id, status: task.status });
      }
      res.json(task);
    } catch (error) {
      console.error("[PATCH /api/tasks/:id/status] error:", error);
      res.status(500).json({ message: "Failed to update task status" });
    }
  });

  // Mark task as viewed by tutor (for notification system)
  app.post("/api/tasks/:id/view", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { id } = req.params;
      await storage.markTaskAsViewed(user.id, id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking task as viewed:", error);
      res.status(500).json({ message: "Failed to mark task as viewed" });
    }
  });

  // Get viewer counts for all tasks (admin only)
  app.get("/api/tasks/views/counts", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.userType !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      const counts = await storage.getTaskViewerCounts();
      res.json(counts);
    } catch (error) {
      console.error("Error fetching task viewer counts:", error);
      res.status(500).json({ message: "Failed to fetch viewer counts" });
    }
  });

  // Get list of tutors who viewed a specific task (task owner or admin only)
  app.get("/api/tasks/:taskId/views", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });

      const { taskId } = req.params;

      if (user.userType !== 'admin') {
        const task = await storage.getTask(taskId);
        if (!task || task.userId !== user.id) {
          return res.status(403).json({ message: "Not authorized" });
        }
      }

      const viewers = await storage.getTaskViewers(taskId);
      res.json(viewers);
    } catch (error) {
      console.error("Error fetching task viewers:", error);
      res.status(500).json({ message: "Failed to fetch task viewers" });
    }
  });

  // Mark proposals as viewed by the student (first time only)
  app.patch("/api/tasks/:taskId/mark-proposals-viewed", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });

      const { taskId } = req.params;

      // Verify the requesting user is the task owner
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (task.userId !== user.id) return res.status(403).json({ message: "Not authorized" });

      // Only mark as viewed if the task actually has candidates
      if (!task.candidates || task.candidates.length === 0) {
        return res.json({ ok: true, skipped: true });
      }

      await storage.markProposalsViewed(taskId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Error marking proposals as viewed:", error);
      res.status(500).json({ message: "Failed to mark proposals as viewed" });
    }
  });

  // Get tutor's viewed task IDs
  app.get("/api/tutor/viewed-tasks", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const viewedTaskIds = await storage.getViewedTaskIds(user.id);
      res.json({ viewedTaskIds });
    } catch (error) {
      console.error("Error getting viewed tasks:", error);
      res.status(500).json({ message: "Failed to get viewed tasks" });
    }
  });

  // Get unviewed task count for tutor notifications
  app.post("/api/tutor/unviewed-count", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { taskIds } = req.body;
      if (!Array.isArray(taskIds)) {
        return res.status(400).json({ message: "taskIds must be an array" });
      }
      
      const count = await storage.getUnviewedTaskCount(user.id, taskIds);
      res.json({ unviewedCount: count });
    } catch (error) {
      console.error("Error getting unviewed count:", error);
      res.status(500).json({ message: "Failed to get unviewed count" });
    }
  });

  // Republish task - reopen with new deadline, same ID/number, clears all candidates
  app.post("/api/tasks/:id/republish", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      const isAdmin = user.userType === 'admin';
      if (user.userType === 'agent') {
        const freshAgent = await storage.getUserById(user.id);
        const agentPerms: string[] = (freshAgent as any)?.agentPermissions || [];
        if (!agentPerms.includes('republish_tasks')) {
          return res.status(403).json({ message: "No tienes permiso para republicar tareas" });
        }
      } else if (!isAdmin && user.userType !== 'student') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      const { deadline } = req.body;

      // Students can only republish their own tasks
      if (user.userType === 'student') {
        const task = await storage.getTask(id);
        if (!task || task.userId !== user.id) {
          return res.status(403).json({ message: "No puedes republicar esta tarea" });
        }
      }
      
      if (!deadline) {
        return res.status(400).json({ message: "Deadline is required" });
      }
      
      const newDeadline = new Date(deadline);
      if (isNaN(newDeadline.getTime())) {
        return res.status(400).json({ message: "Invalid deadline format" });
      }
      
      // Validate deadline is in the future
      const now = new Date();
      if (newDeadline <= now) {
        return res.status(400).json({ message: "Deadline must be in the future" });
      }
      
      const task = await storage.reopenTask(id, newDeadline);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      console.log(`[API] Task ${id} republished with deadline: ${newDeadline}`);
      res.json(task);
    } catch (error) {
      console.error("[API] Error republishing task:", error);
      res.status(500).json({ message: "Failed to republish task" });
    }
  });

  // Admin: get all chat messages for a task (read-only, no auth filtering)
  app.get("/api/admin/tasks/:taskId/chat", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      const isAdmin = user.userType === 'admin';
      if (!isAdmin) {
        if (user.userType !== 'agent') return res.status(403).json({ message: "Access denied" });
        const freshAgent = await storage.getUserById(user.id);
        const agentPerms: string[] = (freshAgent as any)?.agentPermissions || [];
        if (!agentPerms.includes('view_tasks')) {
          return res.status(403).json({ message: "Se requiere permiso 'Ver Pedidos' para acceder al chat" });
        }
      }
      const { taskId } = req.params;
      const messages = await storage.getAllChatMessagesByTask(taskId);
      // Enrich with sender name
      const enriched = await Promise.all(messages.map(async (m) => {
        const sender = await storage.getUserById(m.senderId);
        return { ...m, senderName: sender?.name ?? 'Desconocido' };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("[ADMIN_CHAT] Error:", error);
      res.status(500).json({ message: "Failed to get chat messages" });
    }
  });

  // Admin: select a tutor for a task (on behalf of student)
  app.post("/api/admin/tasks/:taskId/select-tutor", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      const isAdmin = user.userType === 'admin';
      if (!isAdmin) {
        if (user.userType !== 'agent') return res.status(403).json({ message: "Access denied" });
        const freshAgent = await storage.getUserById(user.id);
        const agentPerms: string[] = (freshAgent as any)?.agentPermissions || [];
        if (!agentPerms.includes('manage_candidates')) {
          return res.status(403).json({ message: "No tienes permiso para gestionar candidatos" });
        }
      }
      const { taskId } = req.params;
      const { tutorId } = req.body;
      if (!tutorId) return res.status(400).json({ message: "tutorId is required" });

      // Verify task exists and is in a selectable state
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (task.status !== 'active') {
        return res.status(400).json({ message: "Solo se puede seleccionar tutor en tareas activas" });
      }

      // Verify the tutor is an actual candidate for this task
      const candidates = await storage.getCandidatesByTask(taskId);
      const isCandidate = candidates.some((c: any) => c.tutorId === tutorId);
      if (!isCandidate) {
        return res.status(400).json({ message: "El tutor seleccionado no es candidato de esta tarea" });
      }

      const updated = await storage.updateTask(taskId, {
        assignedTutorId: tutorId,
        status: 'payment_pending',
      });
      res.json(updated);
    } catch (error) {
      console.error("[ADMIN_SELECT_TUTOR] Error:", error);
      res.status(500).json({ message: "Failed to select tutor" });
    }
  });

  // Admin: reject a candidate for a task (mark as inactive)
  app.post("/api/admin/tasks/:taskId/reject-candidate", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      const isAdmin = user.userType === 'admin';
      if (!isAdmin) {
        if (user.userType !== 'agent') return res.status(403).json({ message: "Access denied" });
        const freshAgent = await storage.getUserById(user.id);
        const agentPerms: string[] = (freshAgent as any)?.agentPermissions || [];
        if (!agentPerms.includes('manage_candidates')) {
          return res.status(403).json({ message: "No tienes permiso para gestionar candidatos" });
        }
      }
      const { taskId } = req.params;
      const { tutorId } = req.body;
      if (!tutorId) return res.status(400).json({ message: "tutorId is required" });

      // Verify task exists and is active
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      if (task.status !== 'active') {
        return res.status(400).json({ message: "Solo se puede rechazar candidatos en tareas activas" });
      }

      // Verify the tutor is an actual candidate
      const candidates = await storage.getCandidatesByTask(taskId);
      const candidate = candidates.find((c: any) => c.tutorId === tutorId);
      if (!candidate) {
        return res.status(400).json({ message: "El tutor no es candidato de esta tarea" });
      }

      // Mark candidate as inactive (rejected)
      await storage.rejectCandidate(taskId, tutorId);

      res.json({ message: "Candidato rechazado" });
    } catch (error) {
      console.error("[ADMIN_REJECT_CANDIDATE] Error:", error);
      res.status(500).json({ message: "Failed to reject candidate" });
    }
  });

  // El tutor actualiza el precio de su propia postulacion cuando manda
  // "Nueva cotizacion" por chat — mantiene candidates.proposedPrice al dia,
  // en vez de que quede pegado al monto con el que se postulo originalmente.
  app.patch("/api/candidates/:taskId/:tutorId/price", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });

      const { taskId, tutorId } = req.params;
      if (user.id !== tutorId) {
        return res.status(403).json({ message: "Solo puedes actualizar tu propia cotización" });
      }

      const { price } = req.body;
      if (!price || isNaN(parseFloat(price))) {
        return res.status(400).json({ message: "price invalido" });
      }

      const candidates = await storage.getCandidatesByTask(taskId);
      const candidate = candidates.find((c) => c.tutorId === tutorId);
      if (!candidate) {
        return res.status(404).json({ message: "No eres candidato de este pedido" });
      }

      const updated = await storage.updateCandidateProposedPrice(taskId, tutorId, String(price));

      // Avisar al alumno dueno del pedido para que su lista de candidatos refresque el precio.
      // Se emite DESPUES de guardar: asi el refetch del cliente ya lee el valor nuevo.
      const task = await storage.getTaskBasic(taskId);
      if (task?.userId) {
        sendToUser(task.userId, { type: 'candidate_price_updated', taskId, tutorId });
      }

      res.json(updated);
    } catch (error) {
      console.error("[UPDATE_CANDIDATE_PRICE] Error:", error);
      res.status(500).json({ message: "Failed to update candidate price" });
    }
  });

  // Un agente necesita permiso para ver tutores; el resto de roles no tiene restriccion.
  const callerCanViewTutors = async (user: any): Promise<boolean> => {
    if (user?.userType !== 'agent') return true;
    // Always read from DB to avoid stale session data
    const freshAgent = await storage.getUserById(user.id);
    const agentPerms: string[] = (freshAgent as any)?.agentPermissions || [];
    return agentPerms.includes('view_tutors') || agentPerms.includes('add_tutors');
  };

  // Tutores con isFavorite y completedTasksCount del usuario que llama (datos completos: NO se devuelven tal cual).
  const loadAnnotatedTutors = async (user: any) => {
    const [allTutors, completedCounts, favIds] = await Promise.all([
      storage.getTutors(),
      storage.getCompletedTaskCountPerTutor(),
      user?.id ? storage.getFavoriteTutorIds(user.id) : Promise.resolve([] as string[]),
    ]);
    const favTutorIds = new Set(favIds);
    return hideInactiveTutors(allTutors, user).map((t) => ({
      tutor: t,
      extra: { ...(user?.id ? { isFavorite: favTutorIds.has(t.id) } : {}), completedTasksCount: completedCounts.get(t.user_id) || 0 },
    }));
  };

  // Lista PUBLICA de tutores (sin sesion tambien): solo campos publicos, ver server/tutor-public.ts. Nunca devolver aqui
  // el usuario completo (correo, WhatsApp, IP de registro, supabaseUid): el panel de admin usa /api/admin/tutors.
  app.get("/api/tutors", async (req, res) => {
    try {
      const user = (req as any).session?.user;
      if (!(await callerCanViewTutors(user))) {
        return res.status(403).json({ message: "No tienes permiso para ver tutores" });
      }
      // Sin usuario asociado (huerfano) no hay nada que mostrar: la pantalla leeria tutor.user.name.
      res.json((await loadAnnotatedTutors(user)).filter(({ tutor }) => tutor.user).map(({ tutor, extra }) => toPublicTutor(tutor, extra)));
    } catch (error) {
      console.error("[GET /api/tutors] error:", error);
      res.status(500).json({ message: "Failed to get tutors" });
    }
  });

  // ---- Registro de errores (panel de admin > Errores): solo administrador. Los llena server/middleware/error-logger.ts ----
  const requireAdminUser = (req: any, res: any): boolean => {
    const user = req.session?.user;
    if (!user) { res.status(401).json({ message: "Authentication required" }); return false; }
    if (user.userType !== 'admin') { res.status(403).json({ message: "Acceso restringido al administrador" }); return false; }
    return true;
  };

  // Adjunto que fallo en el telefono/navegador (no llego a subirse): queda en el panel Errores como Advertencia,
  // con el usuario de la sesion. Siempre 204: el cliente lo dispara y lo olvida.
  app.post("/api/client-errors/attachment", clientErrorLimiter, async (req, res) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    const report = attachmentFailureSchema.safeParse(req.body);
    if (!report.success) return res.status(400).json({ message: "Datos invalidos" });
    await logError({
      level: "warning",
      message: attachmentFailureMessage(report.data),
      route: report.data.screen ? routeOf(report.data.screen) : undefined,
      method: "CLIENTE",
      userId: user.id,
    });
    res.status(204).end();
  });

  // Universidades para el selector del perfil (cualquier cuenta con sesion). Solo nombre, pais, siglas y estado.
  app.get("/api/universities", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Authentication required" });
    try {
      // Aprobadas para todos; las pendientes solo las ve quien las sugirio (para poder elegirla mientras el admin la revisa).
      const me = req.session.user.id;
      const list = (await storage.listUniversities()).filter((u) => u.status === "approved" || u.suggestedBy === me);
      res.json(list.map(({ id, name, country, acronym, status }) => ({ id, name, country, acronym, status })));
    } catch (error) {
      console.error("[GET /api/universities] error:", error);
      res.status(500).json({ message: "No se pudieron cargar las universidades" });
    }
  });

  // "Agregar mi universidad" (cualquier cuenta con sesion): si no existe se crea como PENDIENTE (solo la ve quien la sugirio hasta que el
  // admin la apruebe, edite o elimine en /dashboard/universities); si ya existe (sin distinguir mayusculas) devuelve la existente.
  app.post("/api/universities", async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: "Authentication required" });
    const name = universitySchema.safeParse(req.body?.name);
    if (!name.success || !name.data) return res.status(400).json({ message: name.success ? "Escribe el nombre de tu universidad" : (name.error.issues[0]?.message ?? "Texto no válido") });
    try {
      const existing = (await storage.listUniversities()).find((u) => u.name.toLowerCase() === name.data.toLowerCase());
      if (existing) return res.json({ id: existing.id, name: existing.name, country: existing.country, acronym: existing.acronym, status: existing.status });
      const created = await storage.createUniversity({ name: name.data, status: "pending", suggestedBy: req.session.user.id });
      res.status(201).json({ id: created.id, name: created.name, country: created.country, acronym: created.acronym, status: created.status });
    } catch (error) {
      console.error("[POST /api/universities] error:", error);
      res.status(500).json({ message: "No se pudo agregar la universidad" });
    }
  });

  // Catalogo completo del panel admin (con cuantas cuentas usan cada una) y su CRUD: solo administrador.
  const universityBodySchema = z.object({
    name: z.string().trim().min(2, "El nombre es muy corto").max(120, "El nombre es muy largo"),
    country: z.string().trim().max(8).nullish().transform((v) => v || null),
    acronym: z.string().trim().max(20, "Las siglas son muy largas").nullish().transform((v) => v || null),
    status: z.enum(["approved", "pending"]).optional(),
  });
  const isUniqueViolation = (error: any) => error?.code === "23505" || /universities_name_unique/.test(String(error?.message));

  app.get("/api/admin/universities", async (req, res) => {
    if (!requireAdminUser(req, res)) return;
    try {
      res.json(await storage.listUniversities());
    } catch (error) {
      console.error("[GET /api/admin/universities] error:", error);
      res.status(500).json({ message: "No se pudieron cargar las universidades" });
    }
  });

  app.post("/api/admin/universities", async (req, res) => {
    if (!requireAdminUser(req, res)) return;
    const body = universityBodySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? "Datos invalidos" });
    try {
      res.status(201).json(await storage.createUniversity({ name: body.data.name, country: body.data.country, acronym: body.data.acronym }));
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ message: "Esa universidad ya existe" });
      console.error("[POST /api/admin/universities] error:", error);
      res.status(500).json({ message: "No se pudo crear la universidad" });
    }
  });

  app.patch("/api/admin/universities/:id", async (req, res) => {
    if (!requireAdminUser(req, res)) return;
    const body = universityBodySchema.partial().safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? "Datos invalidos" });
    try {
      const updated = await storage.updateUniversity(req.params.id, body.data);
      if (!updated) return res.status(404).json({ message: "Universidad no encontrada" });
      res.json(updated);
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ message: "Esa universidad ya existe" });
      console.error("[PATCH /api/admin/universities/:id] error:", error);
      res.status(500).json({ message: "No se pudo actualizar la universidad" });
    }
  });

  app.delete("/api/admin/universities/:id", async (req, res) => {
    if (!requireAdminUser(req, res)) return;
    try {
      if (!(await storage.deleteUniversity(req.params.id))) return res.status(404).json({ message: "Universidad no encontrada" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[DELETE /api/admin/universities/:id] error:", error);
      res.status(500).json({ message: "No se pudo eliminar la universidad" });
    }
  });

  // Estadisticas de MI perfil (tutor con sesion; ?days=7|30|90): vistas del periodo y por dia, pedidos completados, calificacion, resenas publicadas,
  // veces guardado en favoritos y tiempo medio de entrega. Solo cifras: nunca quien vio el perfil ni quien lo guardo.
  app.get("/api/tutor/stats", async (req, res) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    try {
      const own = await storage.getTutorByUserId(user.id);
      if (!own) return res.status(404).json({ message: "Perfil de tutor no encontrado" });
      const requested = Number(req.query.days);
      const days = [7, 30, 90].includes(requested) ? requested : 30;
      const [viewStats, completedCounts, reviews, favorites, deliveryRows, daily] = await Promise.all([
        storage.getTutorProfileViewStats(days),
        storage.getCompletedTaskCountPerTutor(),
        storage.getTutorReviews(own.id),
        storage.countTutorFavorites(own.id),
        storage.getDeliveryRows(),
        storage.getTutorProfileViewsDaily(own.id, days),
      ]);
      const views = viewStats.find((s) => s.tutorId === own.id);
      const delivery = summarizeDeliveries(deliveryRows.filter((r) => r.tutorId === own.user_id))[0];
      res.json({
        days,
        views: views?.views ?? 0,
        viewers: views?.viewers ?? 0,
        completed: completedCounts.get(own.user_id) || 0,
        rating: Number(own.rating) || 0,
        reviews: reviews.length,
        favorites,
        avgDeliveryHours: delivery ? delivery.avgHours : null,
        daily,
      });
    } catch (error) {
      console.error("[GET /api/tutor/stats] error:", error);
      res.status(500).json({ message: "No se pudieron cargar tus estadísticas" });
    }
  });

  // Vistas de perfil de todos los tutores (clave = id de la tabla tutors), ultimos 30 dias: solo administrador.
  app.get("/api/admin/tutor-profile-views", async (req, res) => {
    if (!requireAdminUser(req, res)) return;
    try {
      res.json(await storage.getTutorProfileViewStats(30));
    } catch (error) {
      console.error("[GET /api/admin/tutor-profile-views] error:", error);
      res.status(500).json({ message: "No se pudieron cargar las vistas de perfil" });
    }
  });

  // Estadisticas de entrega por tutor (clave = id de usuario del tutor): a tiempo vs plazo, horas desde la aprobacion del pago.
  app.get("/api/admin/delivery-stats", async (req, res) => {
    if (!requireAdminUser(req, res)) return;
    try {
      res.json(summarizeDeliveries(await storage.getDeliveryRows()));
    } catch (error) {
      console.error("[GET /api/admin/delivery-stats] error:", error);
      res.status(500).json({ message: "No se pudieron calcular las estadísticas de entrega" });
    }
  });

  const errorLogsQuerySchema = z.object({
    status: z.enum(ERROR_LOG_STATUSES).optional(),
    level: z.enum(ERROR_LOG_LEVELS).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  });

  // Lista paginada, mas reciente primero. Filtros: ?status=pending|resolved &level=error|warning|critical &page= &pageSize=
  app.get("/api/admin/error-logs", async (req, res) => {
    if (!requireAdminUser(req, res)) return;
    const query = errorLogsQuerySchema.safeParse(req.query);
    if (!query.success) return res.status(400).json({ message: "Parametros invalidos" });
    try {
      const { items, total } = await storage.getErrorLogs(query.data);
      res.json({ items, total, page: query.data.page, pageSize: query.data.pageSize });
    } catch (error) {
      console.error("Error listing error logs:", error);
      res.status(500).json({ message: "No se pudo cargar el registro de errores" });
    }
  });

  // Cambia el estado: { "status": "resolved" } (o "pending" para reabrirlo).
  app.patch("/api/admin/error-logs/:id", async (req, res) => {
    if (!requireAdminUser(req, res)) return;
    const body = z.object({ status: z.enum(ERROR_LOG_STATUSES) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: "Estado invalido" });
    try {
      const updated = await storage.updateErrorLogStatus(req.params.id, body.data.status, req.session.user!.id);
      if (!updated) return res.status(404).json({ message: "Registro no encontrado" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating error log:", error);
      res.status(500).json({ message: "No se pudo actualizar el registro" });
    }
  });

  // Lista COMPLETA de tutores para el panel de administracion: solo admin o agente con permiso.
  app.get("/api/admin/tutors", async (req, res) => {
    try {
      const user = (req as any).session?.user;
      if (user?.userType !== 'admin' && user?.userType !== 'agent') {
        return res.status(403).json({ message: "Acceso restringido" });
      }
      if (!(await callerCanViewTutors(user))) {
        return res.status(403).json({ message: "No tienes permiso para ver tutores" });
      }
      // activationPending: invitacion enviada y sin clave definida (res.json oculta password y el hash del token)
      res.json((await loadAnnotatedTutors(user)).map(({ tutor, extra }) => ({
        ...tutor, ...extra,
        activationPending: !!tutor.user && !tutor.user.password && !!tutor.user.activationTokenHash,
      })));
    } catch (error) {
      console.error("[GET /api/admin/tutors] error:", error);
      res.status(500).json({ message: "Failed to get tutors" });
    }
  });

  // Enviar enlace de acceso: token nuevo (invalida el anterior) y correo por Resend. Solo admin (middleware /api/admin).
  // Pendiente = invitacion ('new'); con clave ya definida = enlace para restablecerla ('reset'), la clave actual sigue valida hasta que la cambie.
  app.post("/api/admin/tutors/:tutorId/resend-activation", async (req, res) => {
    try {
      const tutor = await storage.getTutorById(req.params.tutorId);
      if (!tutor?.user) return res.status(404).json({ message: "Tutor no encontrado" });
      await sendActivationLink(tutor.user, tutor.user.password ? 'reset' : 'new');
      res.json({ email: tutor.user.email });
    } catch (error) {
      console.error("[POST /api/admin/tutors/:tutorId/resend-activation] error:", error);
      res.status(500).json({ message: "No se pudo reenviar el correo de activación" });
    }
  });

  // Search tutors by name (for combobox) — filtered in SQL with ILIKE
  app.get("/api/tutors/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        const allTutors = hideInactiveTutors(await storage.getTutors(), (req as any).session?.user);
        return res.json(allTutors.map((t: any) => ({
          value: t.user_id,
          label: t.user?.name || 'Tutor',
          rating: t.rating,
          profession: t.profession,
        })));
      }
      const results = await storage.searchTutors(q, !canSeeInactiveAccounts((req as any).session?.user));
      res.json(results);
    } catch (error) {
      console.error('Error searching tutors:', error);
      res.status(500).json({ message: "Failed to search tutors" });
    }
  });

  // Perfil de un tutor por slug (/tutor/olga-perez) o por id (enlaces guardados antiguos). Va despues de /search.
  // Devuelve solo lo que pinta la pantalla "Perfil del tutor": datos publicos, estadisticas publicas y resenas publicadas.
  app.get("/api/tutors/:key", async (req, res) => {
    try {
      const user = (req as any).session?.user;
      if (!(await callerCanViewTutors(user))) {
        return res.status(403).json({ message: "No tienes permiso para ver tutores" });
      }
      const found = await storage.getTutorByIdOrSlug(req.params.key);
      const [tutor] = found?.user ? hideInactiveTutors([found], user) : [];
      if (!tutor) return res.status(404).json({ message: "Tutor no encontrado" });
      // Vista del perfil: solo cuentas con sesion que no sean el propio tutor, el admin ni un agente, y nunca mientras se impersona.
      if (user?.id && user.userType !== 'admin' && user.userType !== 'agent' && user.id !== tutor.user_id && !(req as any).session?.impersonatorId) {
        storage.recordTutorProfileView(tutor.id, user.id).catch((err) => console.error("[GET /api/tutors/:key] error al registrar la vista:", err));
      }
      const [completedCounts, favIds, reviews] = await Promise.all([
        storage.getCompletedTaskCountPerTutor(),
        user?.id ? storage.getFavoriteTutorIds(user.id) : Promise.resolve([] as string[]),
        storage.getTutorReviews(tutor.id),
      ]);
      res.json({
        ...toPublicTutor(tutor, {
          ...(user?.id ? { isFavorite: favIds.includes(tutor.id) } : {}),
          completedTasksCount: completedCounts.get(tutor.user_id) || 0,
        }),
        reviews: reviews.map(toPublicReview),
      });
    } catch (error) {
      console.error("Error getting tutor:", error);
      res.status(500).json({ message: "Failed to get tutor" });
    }
  });

  // Connection stats for dashboard chart (admin only)
  // Shared helper: resolve startDate/endDate from query params (period or from/to)
  function resolveDateRange(q: Record<string, string | undefined>): { startDate: Date; endDate: Date } {
    const now = new Date();
    const { period, from, to } = q;
    if (from && to) {
      const startDate = new Date(from + 'T00:00:00'); startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(to + 'T23:59:59'); endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
    let startDate: Date;
    let endDate: Date = new Date(now); endDate.setHours(23, 59, 59, 999);
    switch (period) {
      case 'today':      startDate = new Date(now); startDate.setHours(0,0,0,0); break;
      case 'yesterday':  startDate = new Date(now); startDate.setDate(startDate.getDate()-1); startDate.setHours(0,0,0,0); endDate = new Date(startDate); endDate.setHours(23,59,59,999); break;
      case '7d':         startDate = new Date(now); startDate.setDate(startDate.getDate()-6); startDate.setHours(0,0,0,0); break;
      case '15d':        startDate = new Date(now); startDate.setDate(startDate.getDate()-14); startDate.setHours(0,0,0,0); break;
      case '30d':        startDate = new Date(now); startDate.setDate(startDate.getDate()-29); startDate.setHours(0,0,0,0); break;
      case '60d':        startDate = new Date(now); startDate.setDate(startDate.getDate()-59); startDate.setHours(0,0,0,0); break;
      case '90d':        startDate = new Date(now); startDate.setDate(startDate.getDate()-89); startDate.setHours(0,0,0,0); break;
      case 'thisMonth':  startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'lastMonth':  startDate = new Date(now.getFullYear(), now.getMonth()-1, 1); endDate = new Date(now.getFullYear(), now.getMonth(), 0); endDate.setHours(23,59,59,999); break;
      case 'thisYear':   startDate = new Date(now.getFullYear(), 0, 1); break;
      case 'lastYear':   startDate = new Date(now.getFullYear()-1, 0, 1); endDate = new Date(now.getFullYear()-1, 11, 31); endDate.setHours(23,59,59,999); break;
      case 'allTime':    startDate = new Date(2020, 0, 1); break;
      default:           startDate = new Date(now); startDate.setDate(startDate.getDate()-6); startDate.setHours(0,0,0,0);
    }
    return { startDate, endDate };
  }

  app.get('/api/admin/connection-stats', async (req, res) => {
    try {
      const { startDate, endDate } = resolveDateRange(req.query as Record<string, string>);
      const stats = await storage.getConnectionStats(startDate, endDate);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching connection stats:', error);
      res.status(500).json({ message: 'Error al obtener estadísticas de conexión' });
    }
  });

  // Detailed visit log
  app.get('/api/admin/visit-details', async (req, res) => {
    try {
      const { startDate, endDate } = resolveDateRange(req.query as Record<string, string>);
      const details = await storage.getVisitDetails(startDate, endDate);
      res.json(details);
    } catch (error) {
      console.error('Error fetching visit details:', error);
      res.status(500).json({ message: 'Error al obtener detalles de visitas' });
    }
  });

  // Create agent user (admin only)
  app.post("/api/admin/agents", async (req, res) => {
    try {
      const caller = req.session.user;
      if (!caller || caller.userType !== 'admin') {
        return res.status(403).json({ message: "Solo el administrador puede crear agentes" });
      }
      const { name, email, password, agentPermissions, status: rawStatus } = req.body;
      if (!name || !email) {
        return res.status(400).json({ message: "Nombre y email son requeridos" });
      }
      const agentPasswordIssue = password ? passwordProblem(password) : null;
      if (agentPasswordIssue) {
        return res.status(400).json({ message: agentPasswordIssue });
      }
      const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return res.status(400).json({ message: "El correo ya está registrado" });
      }
      const user = await storage.createUser({
        name,
        email: email.toLowerCase().trim(),
        country: 'PE',
        status: rawStatus === 'paused' ? 'paused' : 'active',
      } as any);
      // Set role = 'agent' and initial permissions via direct DB update
      const updates: any = { role: 'agent' };
      if (Array.isArray(agentPermissions)) updates.agentPermissions = agentPermissions;
      if (password) updates.password = password;
      await storage.updateUser(user.id, updates);
      if (!password) sendActivationLink(user, 'new').catch(activationFailed(user.email));
      res.status(201).json({ ...user, role: 'agent', agentPermissions: agentPermissions || [] });
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ message: "Error al crear agente" });
    }
  });

  // Update agent permissions (admin only)
  app.patch("/api/admin/agents/:userId/permissions", async (req, res) => {
    try {
      const caller = req.session.user;
      if (!caller || caller.userType !== 'admin') {
        return res.status(403).json({ message: "Solo el administrador puede modificar permisos" });
      }
      const { userId } = req.params;
      const { permissions } = req.body; // array of permission strings
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: "permissions debe ser un array" });
      }
      const targetUser = await storage.getUser(userId);
      if (!targetUser || (targetUser as any).role !== 'agent') {
        return res.status(404).json({ message: "Agente no encontrado" });
      }
      await storage.updateUser(userId, { agentPermissions: permissions } as any);
      const updated = await storage.getUser(userId);
      res.json(updated);
    } catch (error) {
      console.error("Error updating agent permissions:", error);
      res.status(500).json({ message: "Error al actualizar permisos" });
    }
  });

  // Create a new tutor (admin or agent)
  app.post("/api/admin/tutors", async (req, res) => {
    try {
      const caller = req.session.user;
      if (!caller || (caller.userType !== 'admin' && caller.userType !== 'agent')) {
        return res.status(403).json({ message: "Solo el administrador o un agente pueden crear tutores" });
      }
      const { name, email: rawEmail, country, profession, hasGeneralAccess, assignedCourseIds, password, status: rawStatus, whatsapp, university, bio, isVerified, language } = req.body;
      // Cuenta nueva: activa por defecto; el admin puede crearla pausada (inactiva)
      const accountStatus = rawStatus === 'paused' ? 'paused' : 'active';

      if (!name || !rawEmail) {
        return res.status(400).json({ message: "Nombre y email son requeridos" });
      }
      const email = rawEmail.toLowerCase().trim();

      const tutorPasswordIssue = password ? passwordProblem(password) : null;
      if (tutorPasswordIssue) {
        return res.status(400).json({ message: tutorPasswordIssue });
      }

      const { studyAreaIds } = req.body;
      const existingUser = await storage.getUserByEmail(email);

      let user;
      if (existingUser) {
        // Email ya registrado (p. ej. como estudiante): otorgar acceso tutor
        // a ese mismo usuario en vez de crear una cuenta duplicada.
        const existingTutor = await storage.getTutorByUserId(existingUser.id);
        if (existingTutor) {
          return res.status(400).json({ message: "Este usuario ya tiene acceso de tutor" });
        }
        user = existingUser;
        if (password) {
          await storage.updateUser(user.id, { password } as any);
        }
      } else {
        user = await storage.createUser({
          name,
          email,
          country: country || 'PE',
          whatsapp: whatsapp || '',
          university: university || '',
          status: accountStatus,
        } as any);
        if (password) {
          await storage.updateUser(user.id, { password } as any);
        } else {
          sendActivationLink(user, 'new').catch(activationFailed(user.email)); // el tutor define su propia clave
        }
      }

      const tutor = await storage.createTutor({
        user_id: user.id,
        specialties: [],
        profession: profession || '',
        bio: bio || '',
        // Sin indicar: Español si el pais es de LATAM hispana.
        language: isTutorLanguage(language) ? language : defaultLanguageForCountry(country || (user as any)?.country),
        isVerified: isVerified === true,
        hasGeneralAccess: hasGeneralAccess || false,
        studyAreaIds: studyAreaIds || [],
      });

      if (assignedCourseIds && assignedCourseIds.length > 0) {
        await storage.setTutorCourses(tutor.id, assignedCourseIds);
      }

      res.status(existingUser ? 200 : 201).json({ user, tutor });
    } catch (error) {
      console.error("Error creating tutor:", error);
      res.status(500).json({ message: "Error al crear tutor" });
    }
  });

  // Create a new student (admin only)
  app.post("/api/admin/students", async (req, res) => {
    try {
      const { name, email: rawEmail, university, country, whatsapp, status: rawStatus } = req.body;

      if (!name || !rawEmail) {
        return res.status(400).json({ message: "Nombre y email son requeridos" });
      }
      const email = rawEmail.toLowerCase().trim();

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "El correo ya está registrado" });
      }

      // Create student user
      const user = await storage.createUser({
        name,
        email,
        university: university || '',
        country: country || 'PE',
        whatsapp: whatsapp || '',
        status: rawStatus === 'paused' ? 'paused' : 'active',
      });
      sendActivationLink(user, 'new').catch(activationFailed(user.email));

      res.status(201).json({ user });
    } catch (error) {
      console.error("Error creating student:", error);
      res.status(500).json({ message: "Error al crear estudiante" });
    }
  });

  // Update tutor information
  app.patch("/api/admin/tutors/:tutorId", async (req, res) => {
    try {
      const { tutorId } = req.params;
      const { name, email, country, whatsapp, university, profession, bio, isVerified, specialties, userId, studyAreaIds, status, language } = req.body;
      if (language !== undefined && language !== null && language !== "" && !isTutorLanguage(language)) {
        return res.status(400).json({ message: "Idioma no válido" });
      }

      // Update user info
      if (userId && (name || email || country || whatsapp !== undefined || university !== undefined)) {
        await storage.updateUser(userId, {
          ...(name && { name }),
          ...(email && { email }),
          ...(country && { country }),
          ...(whatsapp !== undefined && { whatsapp }),
          ...(university !== undefined && { university })
        });
      }

      // Estado de la cuenta (activa / pausada / suspendida) del usuario del tutor
      if (userId && ['active', 'paused', 'suspended'].includes(status)) {
        await storage.updateUser(userId, { status });
      }

      // Update tutor profile
      const updatedTutor = await storage.updateTutorProfile(tutorId, {
        ...(profession !== undefined && { profession }),
        ...(bio !== undefined && { bio }),
        ...(typeof isVerified === 'boolean' && { isVerified }),
        ...(specialties !== undefined && { specialties }),
        ...(language !== undefined && { language: language || null }),
        ...(studyAreaIds !== undefined && { studyAreaIds })
      });

      if (!updatedTutor) {
        return res.status(404).json({ message: "Tutor no encontrado" });
      }

      res.json(updatedTutor);
    } catch (error) {
      console.error("Error updating tutor:", error);
      res.status(500).json({ message: "Error al actualizar tutor" });
    }
  });

  // Toggle tutor status (active/paused)
  app.patch("/api/admin/tutors/:userId/status", async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;
      
      if (!['active', 'paused'].includes(status)) {
        return res.status(400).json({ message: "Estado inválido" });
      }

      const user = await storage.updateUserStatus(userId, status);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error updating tutor status:", error);
      res.status(500).json({ message: "Error al actualizar estado" });
    }
  });

  // ========== TUTOR COURSE ACCESS ENDPOINTS (Admin-assigned) ==========
  
  // Get courses assigned to a tutor
  app.get("/api/admin/tutors/:tutorId/courses", async (req, res) => {
    try {
      const { tutorId } = req.params;
      const courses = await storage.getTutorCourses(tutorId);
      res.json(courses);
    } catch (error) {
      console.error("Error getting tutor courses:", error);
      res.status(500).json({ message: "Error al obtener cursos del tutor" });
    }
  });

  // Set courses for a tutor (replaces all existing assignments)
  app.put("/api/admin/tutors/:tutorId/courses", async (req, res) => {
    try {
      const { tutorId } = req.params;
      const { courseIds } = req.body;
      
      if (!Array.isArray(courseIds)) {
        return res.status(400).json({ message: "courseIds debe ser un array" });
      }
      
      await storage.setTutorCourses(tutorId, courseIds);
      const updatedCourses = await storage.getTutorCourses(tutorId);
      res.json(updatedCourses);
    } catch (error) {
      console.error("Error setting tutor courses:", error);
      res.status(500).json({ message: "Error al asignar cursos al tutor" });
    }
  });

  // Admin upload tutor photo - Uses Object Storage for persistence
  app.post("/api/admin/tutors/:tutorId/upload-photo", upload.single('profilePhoto'), async (req, res) => {
    try {
      const { tutorId } = req.params;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No se ha proporcionado ninguna foto" });
      }

      // Get tutor to find user id
      const tutor = await storage.getTutorById(tutorId);
      if (!tutor) {
        return res.status(404).json({ message: "Tutor no encontrado" });
      }

      let avatarPath: string;
      
      // Upload to Object Storage for persistent storage
      try {
        const rawBuffer = fileBytes(file);
        const fileBuffer = await sharp(rawBuffer)
          .resize(400, 400, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 85 })
          .toBuffer();
        avatarPath = await objectStorageService.uploadObjectEntity(fileBuffer, 'image/jpeg');
        console.log(`[TUTOR_PHOTO_UPLOAD] ✅ Uploaded to Object Storage: ${avatarPath} (optimized ${rawBuffer.length} → ${fileBuffer.length} bytes)`);
        
        // Clean up local temp file
        discardFile(file);
      } catch (objStorageError) {
        console.error("[TUTOR_PHOTO_UPLOAD] ❌ Object Storage upload failed:", objStorageError);
        try { discardFile(file); } catch (e) {}
        return res.status(500).json({ message: "Error al subir la foto. Por favor intenta de nuevo." });
      }

      await storage.updateUser(tutor.user_id, { avatar: avatarPath });

      res.json({ success: true, avatar: avatarPath });
    } catch (error) {
      console.error("Error uploading tutor photo:", error);
      res.status(500).json({ message: "Error al subir la foto" });
    }
  });

  // Update tutor's general access toggle
  // Pedidos en curso de un tutor: el panel avisa antes de desactivarlo
  app.get("/api/admin/tutors/:tutorId/active-tasks", async (req, res) => {
    try {
      const tutor = await storage.getTutorById(req.params.tutorId);
      if (!tutor) {
        return res.status(404).json({ message: "Tutor no encontrado" });
      }
      const list = await storage.getActiveTasksForTutor(tutor.user_id);
      res.json({ count: list.length, tasks: list });
    } catch (error) {
      console.error("Error getting tutor active tasks:", error);
      res.status(500).json({ message: "Error al obtener pedidos activos del tutor" });
    }
  });

  app.patch("/api/admin/tutors/:tutorId/general-access", async (req, res) => {
    try {
      const { tutorId } = req.params;
      const { hasGeneralAccess } = req.body;
      
      if (typeof hasGeneralAccess !== 'boolean') {
        return res.status(400).json({ message: "hasGeneralAccess debe ser un booleano" });
      }
      
      const updated = await storage.updateTutorGeneralAccess(tutorId, hasGeneralAccess);
      if (!updated) {
        return res.status(404).json({ message: "Tutor no encontrado" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating tutor general access:", error);
      res.status(500).json({ message: "Error al actualizar acceso general" });
    }
  });

  // Get orphaned tutors (tutors whose user_id doesn't match any users record)
  app.get("/api/admin/orphaned-tutors", async (req, res) => {
    try {
      const orphaned = await storage.getOrphanedTutors();
      res.json(orphaned);
    } catch (error) {
      console.error("Error fetching orphaned tutors:", error);
      res.status(500).json({ message: "Error al obtener tutores huérfanos" });
    }
  });

  // Repair an orphaned tutor by linking it to a user via email
  app.post("/api/admin/repair-tutor/:tutorId", async (req, res) => {
    try {
      const { tutorId } = req.params;
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Se requiere el correo del usuario" });
      }
      const result = await storage.repairOrphanedTutor(tutorId, email.trim());
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.json({ message: result.message });
    } catch (error) {
      console.error("Error repairing orphaned tutor:", error);
      res.status(500).json({ message: "Error al reparar tutor" });
    }
  });

  // Admin endpoint to change any user's password
  app.patch("/api/admin/users/:userId/password", async (req, res) => {
    try {
      // Verify admin is logged in
      const currentUser = req.session.user;
      if (!currentUser || currentUser.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Solo el admin puede cambiar contraseñas" });
      }

      const { userId } = req.params;
      const { newPassword } = req.body;

      const adminPasswordIssue = passwordProblem(newPassword);
      if (adminPasswordIssue) {
        return res.status(400).json({ message: adminPasswordIssue });
      }

      const updated = await storage.updateUser(userId, { password: newPassword });
      if (!updated) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      res.json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
      console.error("Error updating user password:", error);
      res.status(500).json({ message: "Error al actualizar contraseña" });
    }
  });

  // =============================================
  // ADMIN ALERTS endpoints
  // =============================================

  app.get("/api/admin-alerts", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      const alertList = await storage.getAdminAlertsEnriched();
      res.json(alertList);
    } catch (error) {
      console.error("[GET /api/admin-alerts] error:", error);
      res.status(500).json({ message: "Error al obtener alertas" });
    }
  });

  app.patch("/api/admin-alerts/:id", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      const { id } = req.params;
      const { status, actionTaken } = req.body;
      if (!['reviewed', 'dismissed'].includes(status)) {
        return res.status(400).json({ message: "Estado inválido" });
      }
      if (actionTaken !== undefined && !['message_hidden', 'warned', 'suspended'].includes(actionTaken)) {
        return res.status(400).json({ message: "Acción inválida" });
      }
      const updated = await storage.updateAdminAlertStatus(id, status, user.id, actionTaken);
      if (!updated) return res.status(404).json({ message: "Alerta no encontrada" });
      res.json(updated);
    } catch (error) {
      console.error("[PATCH /api/admin-alerts/:id] error:", error);
      res.status(500).json({ message: "Error al actualizar alerta" });
    }
  });

  // Oculta el mensaje reportado en la conversacion de ambos usuarios (el original queda solo para el admin).
  app.post("/api/admin-alerts/:id/hide-message", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      const alert = await storage.getAdminAlertById(req.params.id);
      if (!alert) return res.status(404).json({ message: "Alerta no encontrada" });
      if (!alert.messageId) return res.status(400).json({ message: "La alerta no tiene un mensaje de chat asociado" });
      // El original queda en la alerta (solo admin) antes de reemplazar el texto del mensaje
      const current = await storage.getChatMessageById(alert.messageId);
      if (current && !alert.originalMessage) await storage.setAdminAlertOriginalIfMissing(alert.id, current.message);
      const hidden = await storage.hideChatMessage(alert.messageId);
      if (!hidden) return res.status(404).json({ message: "Mensaje no encontrado" });
      // Tiempo real: ambos participantes actualizan la burbuja sin recargar
      const event = { type: 'message_moderated', messageId: hidden.id, taskId: hidden.taskId, threadId: hidden.threadId, moderationStatus: 'hidden' };
      sendToUser(hidden.senderId, event);
      sendToUser(hidden.receiverId, event);
      const updated = await storage.updateAdminAlertStatus(alert.id, 'reviewed', user.id, 'message_hidden');
      res.json(updated);
    } catch (error) {
      console.error('[ADMIN_ALERT] hide-message:', error);
      res.status(500).json({ message: "Error al ocultar el mensaje" });
    }
  });

  // Advertencia formal: mensaje de sistema (admin-001) en el chat del infractor + push.
  app.post("/api/admin-alerts/:id/warn", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      const alert = await storage.getAdminAlertById(req.params.id);
      if (!alert) return res.status(404).json({ message: "Alerta no encontrada" });
      const original = alert.messageId ? await storage.getChatMessageById(alert.messageId) : undefined;
      const offenderId = original?.senderId ?? alert.studentId;
      const taskId = original?.taskId ?? alert.taskId ?? undefined;
      const task = taskId ? await storage.getTaskBasic(taskId) : undefined;
      // Sin pedido, el hilo del mensaje reportado es el unico lugar donde entregar el aviso
      const thread = !task && original?.threadId ? await storage.getThreadById(original.threadId) : undefined;
      if (!task && !thread) return res.status(400).json({ message: "No hay un pedido ni un hilo de chat donde enviar la advertencia" });
      const warningText = "Aviso de MilTareas: compartir datos de contacto externos (teléfono, enlaces o redes) incumple las normas de la plataforma y pone en riesgo la garantía de tus trabajos. Si se repite, tu cuenta podrá ser suspendida.";
      const saved = await storage.sendMessage({ taskId, senderId: 'admin-001', receiverId: offenderId, message: warningText }, task, thread);
      sendToUser(offenderId, { type: 'new_message', taskId: taskId ?? null, senderId: 'admin-001', receiverId: offenderId, message: saved });
      sendNewMessageNotification(offenderId, 'MilTareas', warningText, taskId ?? '', 'admin-001')
        .catch((err: any) => console.log('[Push] Error sending warning notification:', err.message));
      const updated = await storage.updateAdminAlertStatus(alert.id, 'reviewed', user.id, 'warned');
      res.json(updated);
    } catch (error) {
      console.error('[ADMIN_ALERT] warn:', error);
      res.status(500).json({ message: "Error al enviar la advertencia" });
    }
  });

  // =============================================
  // CONTACT FILTER RULES endpoints
  // =============================================

  app.get("/api/admin/contact-filter-rules", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      const rules = await storage.getFilterRules();
      res.json(rules);
    } catch (error) {
      console.error("[GET /api/admin/contact-filter-rules] error:", error);
      res.status(500).json({ message: "Error al obtener reglas" });
    }
  });

  app.post("/api/admin/contact-filter-rules", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      const { type, value, description } = req.body;
      if (!type || !value || !['blacklist', 'whitelist'].includes(type)) {
        return res.status(400).json({ message: "type y value son requeridos" });
      }
      const rule = await storage.createFilterRule({
        type,
        value: value.trim().toLowerCase(),
        description: description || null,
        isActive: true,
      });
      invalidateFilterCache();
      res.json(rule);
    } catch (error) {
      console.error("[POST /api/admin/contact-filter-rules] error:", error);
      res.status(500).json({ message: "Error al crear regla" });
    }
  });

  app.delete("/api/admin/contact-filter-rules/:id", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Acceso denegado" });
      }
      const deleted = await storage.deleteFilterRule(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Regla no encontrada" });
      invalidateFilterCache();
      res.json({ message: "Regla eliminada" });
    } catch (error) {
      console.error("[DELETE /api/admin/contact-filter-rules/:id] error:", error);
      res.status(500).json({ message: "Error al eliminar regla" });
    }
  });

  // =============================================
  // RETROACTIVE TASK SCAN endpoint
  // =============================================

  app.post("/api/admin/scan-existing-tasks", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const allTasks = await storage.getTasks();
      const activeTasks = allTasks.filter(t => t.status === 'active');
      const existingAlerts = await storage.getAdminAlerts();

      // Build a set of taskIds that already have a personal_contact alert (from task description, i.e. no messageId)
      const alreadyAlertedTaskIds = new Set(
        existingAlerts
          .filter(a => a.type === 'personal_contact' && !a.messageId)
          .map(a => a.taskId)
      );

      const rules = await loadFilterRules();
      let newAlertsCount = 0;

      for (const task of activeTasks) {
        if (alreadyAlertedTaskIds.has(task.id)) continue;

        const textToScan = [task.title, task.description].filter(Boolean).join(' ');
        if (!textToScan.trim()) continue;

        const scan = scanContact(textToScan, rules);
        if (!scan.severity) continue;

        const detectedSnippet = describeScan(scan);

        await storage.createAdminAlert({
          type: 'personal_contact',
          taskId: task.id,
          studentId: task.userId,
          detectedContent: detectedSnippet,
          severity: scan.severity,
          status: 'pending',
        });

        console.log(`[RETROACTIVE_SCAN] ⚠️  Contacto detectado en pedido ${task.id.slice(-6)} — "${detectedSnippet}"`);
        newAlertsCount++;
      }

      res.json({ scanned: activeTasks.length, newAlerts: newAlertsCount });
    } catch (error) {
      console.error('[RETROACTIVE_SCAN] Error:', error);
      res.status(500).json({ message: "Error al escanear pedidos" });
    }
  });

  // =============================================
  // RETROACTIVE MESSAGE SCAN endpoint
  // =============================================

  app.post("/api/admin/scan-existing-messages", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const days = Number(req.body?.days) || 1;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const messages = await storage.getChatMessagesSince(since);
      const existingAlerts = await storage.getAdminAlerts();
      const alreadyAlertedMessageIds = new Set(
        existingAlerts.filter(a => a.type === 'personal_contact' && a.messageId).map(a => a.messageId)
      );

      const rules = await loadFilterRules();
      let newAlertsCount = 0;

      for (const msg of messages) {
        if (alreadyAlertedMessageIds.has(msg.id) || !msg.message?.trim()) continue;

        const scan = scanContact(msg.message, rules);
        if (!scan.severity) continue;

        const detectedSnippet = describeScan(scan);

        // msg.taskOwnerId viene de un LEFT JOIN — null en mensajes directos
        // sin pedido en comun. resolveChatRoles solo lee task.userId, un
        // objeto minimo alcanza (evita traer el task completo).
        const fauxTask = msg.taskOwnerId ? ({ userId: msg.taskOwnerId } as Task) : undefined;
        const { studentId, tutorId } = await storage.resolveChatRoles(msg.senderId, msg.receiverId, fauxTask);
        await storage.createAdminAlert({
          type: 'personal_contact',
          messageId: msg.id,
          originalMessage: msg.message,
          taskId: msg.taskId || undefined,
          studentId,
          tutorId,
          detectedContent: detectedSnippet,
          severity: scan.severity,
          status: 'pending',
        });

        console.log(`[RETROACTIVE_MSG_SCAN] ⚠️  Contacto detectado en ${msg.taskId ? `mensaje de pedido ${msg.taskId.slice(-6)}` : 'mensaje directo'} — "${detectedSnippet}"`);
        newAlertsCount++;
      }

      res.json({ scanned: messages.length, newAlerts: newAlertsCount });
    } catch (error) {
      console.error('[RETROACTIVE_MSG_SCAN] Error:', error);
      res.status(500).json({ message: "Error al escanear mensajes" });
    }
  });

  // Get available tasks for a tutor (filtered by courses or general access)
  // Also includes tasks where the tutor has already applied (to see their status)
  app.get("/api/tutors/:tutorId/available-tasks", async (req, res) => {
    try {
      const { tutorId } = req.params;
      
      const tutor = await storage.getTutorById(tutorId);
      if (!tutor) return res.json([]);

      // Parse optional ?since= cursor (ISO timestamp)
      let since: Date | undefined;
      if (req.query.since && typeof req.query.since === 'string') {
        const parsed = new Date(req.query.since);
        if (!isNaN(parsed.getTime())) since = parsed;
      }

      // Single storage call now handles both course-filtered tasks AND
      // the tutor's own candidacies — no more getTasksWithCandidates() needed
      const tasks = await storage.getAvailableTasksForTutor(tutorId, {
        since,
        tutorUserId: tutor.user_id,
        tutor,
      });

      // Annotate tasks with isInvited flag for this tutor
      const tutorUserId = tutor.user_id;
      const annotatedTasks = tasks.map((task: any) => ({
        ...task,
        isInvited: Array.isArray(task.invitedTutorIds) && task.invitedTutorIds.includes(tutorUserId),
      }));

      res.json(annotatedTasks);
    } catch (error) {
      console.error("Error getting available tasks for tutor:", error);
      res.status(500).json({ message: "Error al obtener pedidos disponibles" });
    }
  });

  // Get user statistics (calculated from actual data)
  app.get("/api/users/:userId/stats", async (req, res) => {
    try {
      const { userId } = req.params;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
  });

  // ========== CAREERS / ÁREAS ACADÉMICAS ENDPOINTS ==========
  app.get("/api/careers", async (req, res) => {
    try {
      const careerList = await storage.getCareers();
      res.set('Cache-Control', 'public, max-age=300');
      res.json(careerList);
    } catch (error) {
      console.error("[GET /api/careers] error:", error);
      res.status(500).json({ message: "Error al obtener carreras" });
    }
  });

  app.post("/api/careers", async (req, res) => {
    try {
      const { name, category, description } = req.body;
      if (!name || !category) {
        return res.status(400).json({ message: "Nombre y categoría son requeridos" });
      }
      const career = await storage.createCareer({ name, category, description, isActive: true });
      res.status(201).json(career);
    } catch (error) {
      console.error("[POST /api/careers] error:", error);
      res.status(500).json({ message: "Error al crear carrera" });
    }
  });

  app.patch("/api/careers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const career = await storage.updateCareer(id, req.body);
      if (!career) {
        return res.status(404).json({ message: "Carrera no encontrada" });
      }
      res.json(career);
    } catch (error) {
      console.error("[PATCH /api/careers/:id] error:", error);
      res.status(500).json({ message: "Error al actualizar carrera" });
    }
  });

  app.delete("/api/careers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCareer(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/careers/:id] error:", error);
      res.status(500).json({ message: "Error al eliminar carrera" });
    }
  });

  // ========== COUNTRIES ENDPOINTS ==========
  app.get("/api/countries", async (req, res) => {
    try {
      const countries = await storage.getCountries();
      res.set('Cache-Control', 'public, max-age=600');
      res.json(countries);
    } catch (error) {
      console.error("[GET /api/countries] error:", error);
      res.status(500).json({ message: "Error al obtener países" });
    }
  });

  app.post("/api/countries", async (req, res) => {
    try {
      const { code, name, flag, phoneCode } = req.body;
      if (!code || !name) {
        return res.status(400).json({ message: "Código y nombre son requeridos" });
      }
      const country = await storage.createCountry({ code: code.toUpperCase(), name, flag, phoneCode, isActive: true });
      res.status(201).json(country);
    } catch (error) {
      console.error("[POST /api/countries] error:", error);
      res.status(500).json({ message: "Error al crear país" });
    }
  });

  app.patch("/api/countries/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const country = await storage.updateCountry(id, req.body);
      if (!country) {
        return res.status(404).json({ message: "País no encontrado" });
      }
      res.json(country);
    } catch (error) {
      console.error("[PATCH /api/countries/:id] error:", error);
      res.status(500).json({ message: "Error al actualizar país" });
    }
  });

  app.delete("/api/countries/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCountry(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/countries/:id] error:", error);
      res.status(500).json({ message: "Error al eliminar país" });
    }
  });

  // ========== BANK ACCOUNTS ENDPOINTS ==========
  app.get("/api/bank-accounts", async (req, res) => {
    try {
      const accounts = await storage.getBankAccounts();
      res.set('Cache-Control', 'public, max-age=300');
      res.json(accounts);
    } catch (error) {
      console.error("[GET /api/bank-accounts] error:", error);
      res.status(500).json({ message: "Error al obtener cuentas bancarias" });
    }
  });

  app.get("/api/bank-accounts/country/:countryCode", async (req, res) => {
    try {
      const { countryCode } = req.params;
      const accounts = await storage.getBankAccountsByCountry(countryCode.toUpperCase());
      res.set('Cache-Control', 'public, max-age=300');
      res.json(accounts);
    } catch (error) {
      console.error("[GET /api/bank-accounts/country/:countryCode] error:", error);
      res.status(500).json({ message: "Error al obtener cuentas bancarias" });
    }
  });

  app.post("/api/bank-accounts", async (req, res) => {
    try {
      const { countryCode, bankName, accountHolder, accountNumber, accountType, currency } = req.body;
      if (!countryCode || !bankName || !accountHolder || !accountNumber || !accountType) {
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }
      const account = await storage.createBankAccount({
        countryCode: countryCode.toUpperCase(),
        bankName,
        accountHolder,
        accountNumber,
        accountType,
        currency: currency || "PEN",
        isActive: true
      });
      res.status(201).json(account);
    } catch (error) {
      console.error("[POST /api/bank-accounts] error:", error);
      res.status(500).json({ message: "Error al crear cuenta bancaria" });
    }
  });

  app.patch("/api/bank-accounts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const account = await storage.updateBankAccount(id, req.body);
      if (!account) {
        return res.status(404).json({ message: "Cuenta bancaria no encontrada" });
      }
      res.json(account);
    } catch (error) {
      console.error("[PATCH /api/bank-accounts/:id] error:", error);
      res.status(500).json({ message: "Error al actualizar cuenta bancaria" });
    }
  });

  app.delete("/api/bank-accounts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBankAccount(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/bank-accounts/:id] error:", error);
      res.status(500).json({ message: "Error al eliminar cuenta bancaria" });
    }
  });

  // Country Settings (min budget per country)
  app.get("/api/country-settings", async (req, res) => {
    try {
      const settings = await storage.getCountrySettings();
      res.json(settings);
    } catch (error) {
      console.error("[GET /api/country-settings] error:", error);
      res.status(500).json({ message: "Error al obtener configuración de países" });
    }
  });

  app.get("/api/country-settings/:countryCode", async (req, res) => {
    try {
      const { countryCode } = req.params;
      const setting = await storage.getCountrySettingByCode(countryCode.toUpperCase());
      if (setting) {
        res.json(setting);
      } else {
        res.status(404).json({ message: "País no encontrado" });
      }
    } catch (error) {
      console.error("[GET /api/country-settings/:countryCode] error:", error);
      res.status(500).json({ message: "Error al obtener configuración del país" });
    }
  });

  app.post("/api/country-settings", async (req, res) => {
    try {
      const setting = await storage.createCountrySetting({
        countryCode: req.body.countryCode,
        countryName: req.body.countryName,
        flag: req.body.flag,
        currency: req.body.currency,
        minBudget: req.body.minBudget,
        isActive: req.body.isActive ?? true,
      });
      res.json(setting);
    } catch (error) {
      console.error("[POST /api/country-settings] error:", error);
      res.status(500).json({ message: "Error al crear configuración de país" });
    }
  });

  app.patch("/api/country-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const setting = await storage.updateCountrySetting(id, req.body);
      if (setting) {
        res.json(setting);
      } else {
        res.status(404).json({ message: "Configuración no encontrada" });
      }
    } catch (error) {
      console.error("[PATCH /api/country-settings/:id] error:", error);
      res.status(500).json({ message: "Error al actualizar configuración" });
    }
  });

  app.delete("/api/country-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCountrySetting(id);
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/country-settings/:id] error:", error);
      res.status(500).json({ message: "Error al eliminar configuración" });
    }
  });

  // Get all users (for admin and login quick access)
  app.get("/api/users", async (req, res) => {
    try {
      const caller = req.session.user;
      const isDev = process.env.NODE_ENV === 'development';
      if (!isDev && (!caller || caller.userType !== 'admin')) {
        return res.status(403).json({ message: "Acceso restringido al administrador" });
      }
      const users = await storage.getUsers();
      const tutors = await storage.getTutors();
      
      // Add userType to each user
      const usersWithType = users.map((user: any) => {
        let userType = "student"; // default
        
        if (user.email === MAIN_ADMIN_EMAIL) {
          userType = "admin";
        } else {
          // Check if user exists in tutors table
          const isTutor = tutors.some((t: any) => t.user && t.user.id === user.id);
          if (isTutor) {
            userType = "tutor";
          }
        }
        
        return { ...user, userType };
      });
      
      res.json(usersWithType);
    } catch (error) {
      console.error("[GET /api/users] error:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // Update user (admin CRUD)
  app.patch("/api/users/:userId", async (req, res) => {
    try {
      const caller = req.session.user;
      if (!caller || caller.userType !== 'admin') {
        return res.status(403).json({ message: "Acceso restringido al administrador" });
      }
      const { userId } = req.params;
      const updates = req.body;
      // El estado de cuenta solo puede ser active / paused / suspended (otro valor no lo reconoce el bloqueo de acceso)
      if (updates && 'status' in updates && !['active', 'paused', 'suspended'].includes(updates.status)) {
        return res.status(400).json({ message: "Estado de cuenta invalido" });
      }
      const user = await storage.updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Update user status (admin CRUD)
  app.patch("/api/users/:userId/status", async (req, res) => {
    try {
      const caller = req.session.user;
      if (!caller || caller.userType !== 'admin') {
        return res.status(403).json({ message: "Acceso restringido al administrador" });
      }
      const { userId } = req.params;
      const { status } = req.body;
      if (!['active', 'paused', 'suspended'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const user = await storage.updateUser(userId, { status });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Delete user (admin CRUD)
  app.delete("/api/users/:userId", async (req, res) => {
    try {
      const caller = req.session.user;
      if (!caller || caller.userType !== 'admin') {
        return res.status(403).json({ message: "Acceso restringido al administrador" });
      }
      const { userId } = req.params;

      // Get user before deletion so we can remove them from Supabase Auth
      const userToDelete = await storage.getUserById(userId);
      if (userToDelete) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && serviceKey) {
          try {
            // Use stored supabaseUid directly if available; otherwise search by email using ?filter=
            let supabaseUid = (userToDelete as any).supabaseUid as string | undefined;

            if (!supabaseUid) {
              const listRes = await fetch(
                `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(userToDelete.email)}&per_page=10`,
                { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
              );
              if (!listRes.ok) {
                console.error(`[ADMIN] Supabase Auth list failed (${listRes.status}) for ${userToDelete.email}:`, await listRes.text());
              } else {
                const listData = await listRes.json() as { users?: { id: string; email: string }[] };
                // Match exact email since ?filter= is a partial search
                supabaseUid = listData.users?.find(u => u.email?.toLowerCase() === userToDelete.email.toLowerCase())?.id;
                if (!supabaseUid) {
                  console.log(`[ADMIN] No Supabase Auth account found for: ${userToDelete.email}`);
                }
              }
            }

            if (supabaseUid) {
              const delRes = await fetch(
                `${supabaseUrl}/auth/v1/admin/users/${supabaseUid}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
              );
              if (delRes.ok) {
                console.log(`[ADMIN] Deleted Supabase Auth user: ${userToDelete.email} (uid: ${supabaseUid})`);
              } else {
                const errBody = await delRes.text();
                console.error(`[ADMIN] Supabase Auth delete failed (${delRes.status}) for ${userToDelete.email}: ${errBody}`);
              }
            }
          } catch (supaErr) {
            console.error(`[ADMIN] Exception deleting Supabase Auth user ${userToDelete.email}:`, supaErr);
          }
        } else {
          console.warn('[ADMIN] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase Auth deletion');
        }
      }

      const deleted = await storage.deleteUser(userId);
      if (!deleted) {
        return res.status(500).json({ message: "No se pudo eliminar el usuario" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.delete("/api/tutors/:tutorId", async (req, res) => {
    try {
      const caller = req.session.user;
      if (!caller || caller.userType !== 'admin') {
        return res.status(403).json({ message: "Acceso restringido al administrador" });
      }
      const { tutorId } = req.params;
      const deleted = await storage.deleteTutor(tutorId);
      if (!deleted) {
        return res.status(500).json({ message: "No se pudo eliminar el tutor" });
      }
      res.json({ message: "Tutor deleted successfully" });
    } catch (error) {
      console.error("Error deleting tutor:", error);
      res.status(500).json({ message: "Failed to delete tutor" });
    }
  });

  // Update tutor profile
  app.patch("/api/tutors/:tutorId", async (req, res) => {
    try {
      const { tutorId } = req.params;
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });

      let updates = req.body;
      if (user.userType !== 'admin') {
        const own = await storage.getTutorByUserId(user.id);
        if (!own || own.id !== tutorId) {
          return res.status(403).json({ message: "No puedes editar este perfil" });
        }
        // Tutor solo edita campos propios; rating/isVerified/etc. quedan fuera.
        updates = {
          ...(req.body.bio !== undefined && { bio: req.body.bio }),
          ...(req.body.specialties !== undefined && { specialties: req.body.specialties }),
        };
      }

      if (updates?.language !== undefined) {
        if (updates.language === "") updates.language = null;
        if (updates.language !== null && !isTutorLanguage(updates.language)) {
          return res.status(400).json({ message: "Idioma no válido" });
        }
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Sin campos editables" });
      }

      if (updates.specialties !== undefined) {
        const MAX_SPECIALTIES = 8;
        const sp = updates.specialties;
        if (!Array.isArray(sp) || sp.length > MAX_SPECIALTIES || sp.some((s: unknown) => typeof s !== 'string')) {
          return res.status(400).json({ message: `Máximo ${MAX_SPECIALTIES} especialidades` });
        }
        const validLabels = new Set((await storage.getStudyAreas()).map(a => a.label));
        if (!sp.every((s: string) => validLabels.has(s))) {
          return res.status(400).json({ message: "Especialidad no válida" });
        }
        updates.specialties = Array.from(new Set(sp));
      }

      const tutor = await storage.updateTutor(tutorId, updates);
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      res.json(tutor);
    } catch (error) {
      console.error("Error updating tutor:", error);
      res.status(500).json({ message: "Failed to update tutor" });
    }
  });

  // Get single task by ID - includes assignedTutorId for chat blocking logic
  app.get("/api/tasks/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const user = req.session.user;
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      // If task is completed, get delivery info for grace period calculation
      let delivery = null;
      if (task.status === 'completed') {
        delivery = await storage.getTaskDelivery(taskId);
      }
      
      // Return task with all properties including assignedTutorId and delivery info
      res.json({ ...task, delivery });
    } catch (error) {
      console.error("Error getting task:", error);
      res.status(500).json({ message: "Failed to get task" });
    }
  });

  // Delete task (admin CRUD)
  app.delete("/api/tasks/:taskId", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      if (user.userType !== 'admin') return res.status(403).json({ message: "Solo el administrador puede eliminar tareas" });
      const { taskId } = req.params;
      const deleted = await storage.deleteTask(taskId);
      if (!deleted) {
        return res.status(404).json({ message: "Pedido no encontrado o ya fue eliminado" });
      }
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error(`Error deleting task ${req.params.taskId}:`, error);
      res.status(500).json({
        message: "No se pudo eliminar el pedido por un error de base de datos",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Presence status endpoint
  app.get("/api/debug/presence", async (req, res) => {
    try {
      const { getOnlineUsers } = await import('./presence-system.js');
      const onlineUsers = getOnlineUsers();
      res.json({ onlineUsers, totalOnline: onlineUsers.length });
    } catch (error) {
      console.error("[GET /api/debug/presence] error:", error);
      res.status(500).json({ message: "Failed to get presence info" });
    }
  });

  // Create a candidate application
  app.post("/api/candidates", async (req, res) => {
    try {
      const user = req.session.user;
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if task is still accepting applications
      const taskId = req.body.taskId;
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ message: "Tarea no encontrada" });
      }
      
      // Block new applications if payment is pending or tutor already assigned
      if (task.status === 'payment_pending' || task.assignedTutorId) {
        console.log(`[CANDIDATE] ❌ Blocked application - task ${taskId} has assignedTutorId or payment_pending`);
        return res.status(400).json({ 
          message: "Esta tarea ya tiene un tutor seleccionado y no acepta nuevas postulaciones" 
        });
      }
      
      // Block if task is not active
      if (task.status !== 'active') {
        return res.status(400).json({ 
          message: "Esta tarea no está aceptando postulaciones" 
        });
      }

      // Add the tutorId from the current user
      const candidateData = {
        ...req.body,
        tutorId: user.id
      };
      
      const validatedData = insertCandidateSchema.parse(candidateData);
      const candidate = await storage.createCandidate(validatedData);

      // Notify the task owner (student) in real-time via WebSocket
      if (task.userId) {
        sendToUser(task.userId, {
          type: 'new_candidate',
          taskId: task.id,
          tutorId: user.id,
        });
      }

      // Email the student if they're offline (fire-and-forget)
      if (task.userId && !getOnlineUsers().includes(task.userId)) {
        storage.getUser(task.userId).then(student => {
          if (student?.email) {
            sendNewApplicantEmail(student.email, task.title, String(task.id))
              .catch(err => console.error('[EMAIL] Error sending new applicant email:', err));
          }
        }).catch(err => console.error('[EMAIL] Error fetching student for applicant email:', err));
      }

      // NOTE: Chat message is handled by frontend to avoid duplication
      console.log("✅ Candidate created successfully - message handled by frontend");
      
      res.json(candidate);
    } catch (error) {
      console.error("Candidate creation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: "Invalid candidate data", details: error.message });
      } else {
        res.status(400).json({ message: "Invalid candidate data" });
      }
    }
  });

  // Update current user profile
  // Solo estos campos los puede editar el propio usuario (lo que envian profile-section y
  // tutor-profile-simple). role, status, agentPermissions, password, rating, contadores, etc. NO.
  // El email NO es editable aqui: el login vive en supabase.auth y editarlo solo en la BD lo desincroniza (se cambia via soporte).
  const EDITABLE_PROFILE_FIELDS = ['name', 'university', 'whatsapp', 'country'] as const;

  app.put("/api/user/current", async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const updates: Record<string, string> = {};
      for (const field of EDITABLE_PROFILE_FIELDS) {
        const value = req.body?.[field];
        if (value === undefined) continue;
        if (typeof value !== 'string' || value.length > 200) {
          return res.status(400).json({ message: `Valor invalido en "${field}"` });
        }
        updates[field] = value.trim();
      }
      if ('university' in updates) {
        const university = universitySchema.safeParse(updates.university);
        if (!university.success) {
          return res.status(400).json({ message: university.error.issues[0]?.message ?? "Universidad no valida" });
        }
        updates.university = university.data; // normalizada (espacios colapsados, sin caracteres de control)
        // Solo se puede elegir una universidad del catalogo (o dejarla vacia). Un valor antiguo escrito a mano se acepta mientras no cambie.
        const current = await storage.getUser(req.session.user.id);
        const changed = updates.university !== (current?.university ?? "");
        if (changed && updates.university && !(await storage.universityExists(updates.university))) {
          return res.status(400).json({ message: "Elige una universidad de la lista" });
        }
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No hay campos validos para actualizar" });
      }
      if ('name' in updates && !updates.name) {
        return res.status(400).json({ message: "El nombre no puede estar vacio" });
      }

      const user = await storage.updateUser(req.session.user.id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("[PUT /api/user/current] error:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Upload profile photo - Uses Object Storage for persistence
  app.post("/api/user/upload-photo", upload.single('profilePhoto'), async (req, res) => {
    try {
      const currentUser = req.session.user;
      console.log(`[PHOTO_UPLOAD] 📷 Request received for user: ${currentUser?.id || 'NO_USER'}`);
      
      if (!currentUser) {
        console.log(`[PHOTO_UPLOAD] ❌ No user in session`);
        return res.status(401).json({ message: "Sesión expirada" });
      }
      
      console.log(`[PHOTO_UPLOAD] 📁 File received: ${req.file ? req.file.originalname : 'NO_FILE'}`);
      
      let profilePhotoUrl: string;
      
      if (req.file) {
        // Upload to Object Storage for persistent storage
        try {
          console.log(`[PHOTO_UPLOAD] 🔄 Uploading to Object Storage...`);
          
          const rawBuffer = fileBytes(req.file);
          console.log(`[PHOTO_UPLOAD] 📦 File buffer size: ${rawBuffer.length} bytes`);
          const fileBuffer = await sharp(rawBuffer)
            .resize(400, 400, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 85 })
            .toBuffer();
          console.log(`[PHOTO_UPLOAD] 🗜️ Optimized: ${rawBuffer.length} → ${fileBuffer.length} bytes`);

          const objectPath = await objectStorageService.uploadObjectEntity(fileBuffer, 'image/jpeg');
          
          profilePhotoUrl = objectPath;
          console.log(`[PHOTO_UPLOAD] ✅ Uploaded to Object Storage: ${objectPath}`);
          
          // Clean up local temp file
          discardFile(req.file);
        } catch (objStorageError) {
          console.error("[PHOTO_UPLOAD] ❌ Object Storage upload failed:", objStorageError);
          try { discardFile(req.file); } catch (e) {}
          return res.status(500).json({ message: "Error al subir la foto. Por favor intenta de nuevo." });
        }
      } else {
        profilePhotoUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}&backgroundColor=59BC7A`;
      }
      
      console.log(`[PHOTO_UPLOAD] 💾 Saving avatar URL to database: ${profilePhotoUrl}`);
      const updatedUser = await storage.updateUser(currentUser.id, { 
        avatar: profilePhotoUrl 
      });
      
      console.log(`[PHOTO_UPLOAD] 📝 Database updated, user avatar: ${updatedUser?.avatar}`);
      
      if (updatedUser) {
        const userWithType = { ...updatedUser, userType: currentUser.userType };
        req.session.user = userWithType;
        console.log(`[PHOTO_UPLOAD] 🔄 Session updated with new avatar`);
      }
      
      console.log(`[PHOTO_UPLOAD] ✅ SUCCESS - Sending response with photoUrl: ${profilePhotoUrl}`);
      logActivity(currentUser.id, 'upload_file', 'Subió foto de perfil', req);
      res.json({ photoUrl: profilePhotoUrl, user: updatedUser });
    } catch (error) {
      console.error("[PHOTO_UPLOAD] ❌ Error:", error);
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  // Delete profile photo
  app.delete("/api/user/delete-photo", async (req, res) => {
    try {
      const currentUser = req.session.user;
      
      console.log("[PHOTO_DELETE] Request received");
      console.log("[PHOTO_DELETE] Current user:", currentUser?.id, currentUser?.name);
      
      if (!currentUser) {
        console.log("[PHOTO_DELETE] ERROR: No authenticated user");
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Update user to remove avatar (set to null)
      const updatedUser = await storage.updateUser(currentUser.id, { 
        avatar: null 
      });
      
      // CRITICAL: Update session and memory with fresh data immediately
      if (updatedUser) {
        // Preserve userType from current session
        const userWithType = { ...updatedUser, userType: currentUser.userType };
        req.session.user = userWithType;
        console.log("[PHOTO_DELETE] Session updated - avatar removed");
      }
      
      console.log("[PHOTO_DELETE] User photo deleted successfully");
      
      res.json({ 
        message: "Photo deleted successfully", 
        user: updatedUser 
      });
    } catch (error) {
      console.error("[PHOTO_DELETE] Error:", error);
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });

  // Change password (demo mode - password is fixed at "123456")
  app.post("/api/user/change-password", changePasswordLimiter, async (req, res) => {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser) {
        return res.status(401).json({ message: "Debes iniciar sesión" });
      }

      const { currentPassword, newPassword } = req.body ?? {};
      if (typeof currentPassword !== "string" || !currentPassword || typeof newPassword !== "string" || !newPassword) {
        return res.status(400).json({ message: "Faltan campos requeridos" });
      }

      const user = await storage.getUser(sessionUser.id);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      const stored = (user as any).password as string | null | undefined;
      if (!stored) {
        // Cuenta de Google o aun sin activar: no hay clave actual que comprobar; se define con un enlace al correo.
        return res.status(400).json({ message: "Tu cuenta no tiene contraseña. Usa «Olvidé mi contraseña» para definir una." });
      }
      if (currentPassword === DEFAULT_PASSWORD || !verifyPassword(currentPassword, stored)) {
        return res.status(400).json({ message: "La contraseña actual es incorrecta" });
      }
      const issue = passwordProblem(newPassword);
      if (issue) {
        return res.status(400).json({ message: issue });
      }

      await storage.updateUser(user.id, { password: newPassword } as any);
      logActivity(user.id, 'password_change', 'Cambio de contraseña', req);
      res.json({ message: "Contraseña actualizada exitosamente" });
    } catch (error) {
      console.error("[POST /api/user/change-password] error:", error);
      res.status(500).json({ message: "Error al cambiar la contraseña" });
    }
  });

  // Get user's favorite tutors
  app.get("/api/favorites", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const favorites = await storage.getUserFavorites(req.session.user.id);
      // Un tutor que pasa a inactivo deja de aparecer en los favoritos del alumno
      res.json(favorites.filter((f: any) => !f.tutor?.user?.status || f.tutor.user.status === 'active'));
    } catch (error) {
      console.error('Error getting favorites:', error);
      res.status(500).json({ message: "Failed to get favorites" });
    }
  });

  // Add tutor to favorites
  app.post("/api/favorites", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      const favorite = await storage.addFavorite({
        userId: req.session.user.id,
        tutorId: req.body.tutorId,
      });
      res.json(favorite);
    } catch (error) {
      res.status(400).json({ message: "Invalid favorite data" });
    }
  });

  // Get student's "my tutors" — favorites + previously hired tutors
  app.get("/api/my-tutors", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      const userId = req.session.user.id;
      const seen = new Set<string>();
      const result: any[] = [];

      // 1. Favorites
      const favs = await storage.getUserFavorites(userId);
      for (const fav of favs) {
        if (fav.tutor && !seen.has(fav.tutor.user_id)) {
          seen.add(fav.tutor.user_id);
          result.push({
            id: fav.tutor.id,
            slug: fav.tutor.slug ?? null,
            user_id: fav.tutor.user_id,
            name: fav.tutor.user?.name || '',
            avatar: fav.tutor.user?.avatar || null,
            profession: fav.tutor.profession || null,
            rating: fav.tutor.rating || '0',
            isFavorite: true,
          });
        }
      }

      // 2. Previously hired (only in_progress or completed tasks)
      const studentTasks = await storage.getTasksByUserId(userId);
      const assignedUserIds = Array.from(new Set(
        studentTasks
          .filter((t: any) => t.assignedTutorId && ['in_progress', 'completed'].includes(t.status))
          .map((t: any) => t.assignedTutorId as string)
      ));
      for (const assignedUserId of assignedUserIds) {
        if (!seen.has(assignedUserId)) {
          const tutor = await storage.getTutorByUserId(assignedUserId);
          if (tutor) {
            seen.add(assignedUserId);
            result.push({
              id: tutor.id,
              slug: tutor.slug ?? null,
              user_id: tutor.user_id,
              name: tutor.user?.name || '',
              avatar: tutor.user?.avatar || null,
              profession: tutor.profession || null,
              rating: tutor.rating || '0',
              isFavorite: false,
            });
          }
        }
      }

      res.json(result);
    } catch (error) {
      console.error('Error getting my-tutors:', error);
      res.status(500).json({ message: "Failed to get tutors" });
    }
  });

  // Remove tutor from favorites
  app.delete("/api/favorites/:tutorId", async (req, res) => {
    try {
      const { tutorId } = req.params;
      if (!req.session.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const removed = await storage.removeFavorite(req.session.user.id, tutorId);
      if (!removed) {
        return res.status(404).json({ message: "Favorite not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/favorites/:tutorId] error:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  // Get tutor reviews
  app.get("/api/tutors/:tutorId/reviews", async (req, res) => {
    try {
      const { tutorId } = req.params;
      const reviews = await storage.getTutorReviews(tutorId);
      res.json(reviews.map(toPublicReview));
    } catch (error) {
      console.error("Error fetching tutor reviews:", error);
      res.status(500).json({ error: "Failed to fetch tutor reviews" });
    }
  });

  // Chat routes
  // NEW: Get last messages for all conversations for current user
  app.get("/api/chat/last-messages", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "No user logged in" });
      }

      const lastMessages = await storage.getLastMessagesForAllConversations(user.id);
      const result: Record<string, { message: string; timestamp: string; fromCurrentUser: boolean; unreadCount: number; isDelivered: boolean; isReadByRecipient: boolean }> = {};
      
      for (const [key, value] of Array.from(lastMessages.entries())) {
        result[key] = {
          message: value.message,
          timestamp: value.timestamp.toISOString(),
          fromCurrentUser: value.fromCurrentUser,
          unreadCount: value.unreadCount,
          isDelivered: value.isDelivered,
          isReadByRecipient: value.isReadByRecipient
        };
      }

      // Removed verbose logging for performance
      res.json(result);
    } catch (error) {
      console.error("[LAST_MESSAGES_API] Error:", error);
      res.status(500).json({ message: "Failed to get last messages" });
    }
  });

  // --- Chat threads (user-centric: un hilo continuo por par estudiante-tutor) ---
  // Fase 1: lado estudiante. Conviven con las rutas task-scoped de arriba,
  // que el lado tutor sigue usando sin cambios.

  app.get("/api/chat/threads", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const threads = await storage.getThreadsForUser(user.id);
      const threadIds = threads.map(t => t.id);
      const otherIdOf = (t: typeof threads[number]) => (t.studentId === user.id ? t.tutorId : t.studentId);
      // 3 consultas en paralelo para N hilos (antes 2-3 por hilo, incluido getThreadById).
      const [lastMessages, usersById, sendableByThread] = await Promise.all([
        storage.getLastMessagesForThreads(threadIds),
        storage.getUsersByIds(Array.from(new Set(threads.map(otherIdOf)))),
        storage.getSendableTasksForThreads(threadIds),
      ]);
      const enriched = await Promise.all(
        threads.map(async (t) => {
          const otherUserId = otherIdOf(t);
          const otherUser = usersById.get(otherUserId);
          const sendableTask = sendableByThread.get(t.id);
          // Adjuntos: tipo + texto del preview. Sin nombre original (mensajes
          // anteriores a attachment_names) el tipo se resuelve por Content-Type.
          const last = lastMessages.get(t.id);
          let lastMessageKind = chatAttachmentKind(last?.attachments, last?.attachmentNames);
          if (last?.attachments?.length && !lastMessageKind) {
            lastMessageKind = await attachmentKindByContentType(last.attachments);
          }
          const lastMessageText = last?.attachments?.length
            ? chatPreviewText(last.message, last.attachments, last.attachmentNames, lastMessageKind)
            : t.lastMessage;
          return {
            id: t.id,
            otherUserId,
            otherUserName: otherUser?.name || "Usuario",
            otherUserAvatar: otherUser?.avatar || null,
            otherUserLastSeen: otherUser?.lastSeen || null,
            // Cuenta pausada/suspendida: el hilo se conserva, pero el chat avisa y no deja escribir
            otherUserInactive: !!accountBlockedMessage(otherUser),
            lastMessage: lastMessageText,
            lastMessageKind,
            lastMessageAt: t.lastMessageAt,
            unreadCount: t.unreadCount,
            // Si es null, el frontend deshabilita el composer: no hay pedido
            // activo/reciente a traves del cual seguir escribiendo (decision
            // confirmada: no se inventa un taskId para mensajes "sueltos").
            sendableTaskId: sendableTask?.id || null,
            sendableTask: toSendableTaskPreview(sendableTask),
          };
        })
      );
      res.json(enriched);
    } catch (error) {
      console.error("[CHAT_THREADS] Error:", error);
      res.status(500).json({ message: "Failed to get chat threads" });
    }
  });

  // Iniciar (o retomar) chat con un tutor desde su perfil, sin pedido de por
  // medio — reusa getOrCreateThread, el mismo que usa el envio de mensajes.
  app.post("/api/chat/threads/with/:tutorId", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (user.userType !== 'student') {
        return res.status(403).json({ message: "Solo estudiantes pueden iniciar chat desde el perfil de tutor" });
      }
      const { tutorId } = req.params;
      const tutorProfile = await storage.getTutorByUserId(tutorId);
      if (!tutorProfile) {
        return res.status(404).json({ message: "Tutor no encontrado" });
      }
      const thread = await storage.getOrCreateThread(user.id, tutorId);
      res.json({ threadId: thread.id });
    } catch (error) {
      console.error("[CHAT_THREAD_WITH] Error:", error);
      res.status(500).json({ message: "Failed to get or create thread" });
    }
  });

  // Mismo get-or-create de arriba, con cuerpo JSON en vez de param de ruta
  // (usado por el boton "Chatear" del perfil de tutor). tutorId = user_id
  // del tutor, igual que /threads/with/:tutorId.
  app.post("/api/chat/get-or-create", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (user.userType !== 'student') {
        return res.status(403).json({ message: "Solo estudiantes pueden iniciar chat desde el perfil de tutor" });
      }
      const { tutorId } = req.body as { tutorId?: string };
      if (!tutorId) {
        return res.status(400).json({ message: "tutorId is required" });
      }
      const tutorProfile = await storage.getTutorByUserId(tutorId);
      if (!tutorProfile) {
        return res.status(404).json({ message: "Tutor no encontrado" });
      }
      // Solo verifica, NO crea — un thread vacio (sin mensaje) queda con
      // lastMessageAt null, que ordena PRIMERO en el listado (DESC pone
      // NULL arriba), rompiendo el orden de /mensajes. El thread real se
      // crea recien en storage.sendMessage cuando el usuario manda el
      // primer mensaje.
      const thread = await storage.findThreadByPair(user.id, tutorId);
      res.json({ threadId: thread?.id ?? null });
    } catch (error) {
      console.error("[CHAT_GET_OR_CREATE] Error:", error);
      res.status(500).json({ message: "Failed to get or create thread" });
    }
  });

  app.get("/api/chat/threads/:threadId", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { threadId } = req.params;
      const thread = await storage.getThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      if (thread.studentId !== user.id && thread.tutorId !== user.id) {
        return res.status(403).json({ message: "Not a participant of this thread" });
      }

      const otherUserId = thread.studentId === user.id ? thread.tutorId : thread.studentId;
      const [otherUser, sendableTask] = await Promise.all([
        storage.getUser(otherUserId),
        storage.getSendableTaskForThread(threadId),
      ]);

      res.json({
        id: thread.id,
        otherUserId,
        otherUserName: otherUser?.name || "Usuario",
        otherUserAvatar: otherUser?.avatar || null,
        otherUserInactive: !!accountBlockedMessage(otherUser),
        sendableTaskId: sendableTask?.id || null,
        sendableTask: toSendableTaskPreview(sendableTask),
      });
    } catch (error) {
      console.error("[CHAT_THREADS] Error fetching thread:", error);
      res.status(500).json({ message: "Failed to get thread" });
    }
  });

  app.get("/api/chat/threads/:threadId/messages", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { threadId } = req.params;
      const thread = await storage.getThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      if (thread.studentId !== user.id && thread.tutorId !== user.id) {
        return res.status(403).json({ message: "Not a participant of this thread" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const before = req.query.before as string | undefined;
      const messages = await storage.getMessagesByThread(threadId, user.id, limit, before);
      const hasMore = messages.length === limit;
      res.json({ messages, hasMore, tasks: await getTasksForMessages(messages) });
    } catch (error) {
      console.error("[CHAT_THREADS] Error fetching messages:", error);
      res.status(500).json({ message: "Failed to get thread messages" });
    }
  });

  app.post("/api/chat/threads/:threadId/mark-read", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { threadId } = req.params;
      const thread = await storage.getThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      if (thread.studentId !== user.id && thread.tutorId !== user.id) {
        return res.status(403).json({ message: "Not a participant of this thread" });
      }

      const updatedMessageIds = await storage.markMessagesAsReadByThread(threadId, user.id);
      if (updatedMessageIds.length > 0) {
        try {
          const otherUserId = thread.studentId === user.id ? thread.tutorId : thread.studentId;
          const payload = {
            type: 'messages_read',
            threadId,
            readByUserId: user.id,
            messageIds: updatedMessageIds,
            readAt: new Date().toISOString()
          };
          sendToUser(user.id, payload);
          sendToUser(otherUserId, payload);
        } catch (wsError) {
          console.error("[CHAT_THREADS_WS] Error broadcasting read receipt:", wsError);
        }
      }
      res.json({ success: true, updatedCount: updatedMessageIds.length });
    } catch (error) {
      console.error("[CHAT_THREADS] Error marking read:", error);
      res.status(500).json({ message: "Failed to mark thread as read" });
    }
  });

  // Logica compartida por las 2 variantes de abajo (por URL params y por
  // JSON body) -- eran el mismo handler duplicado dos veces, solo cambiaba
  // de donde salian taskId/otherUserId.
  const handleMarkRead = async (req: Request, res: Response, taskId: string, otherUserId: string) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const updatedMessageIds = await storage.markMessagesAsRead(taskId, user.id, otherUserId);

      if (updatedMessageIds.length > 0) {
        try {
          const payload = {
            type: 'messages_read',
            taskId,
            readByUserId: user.id,
            messageIds: updatedMessageIds,
            readAt: new Date().toISOString()
          };
          sendToUser(user.id, payload);
          sendToUser(otherUserId, payload);
        } catch (wsError) {
          console.error("[MARK_READ_WS] Error broadcasting read receipt:", wsError);
        }
      }

      res.json({ success: true, updatedCount: updatedMessageIds.length });
    } catch (error) {
      console.error("[MARK_READ] Error:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  };

  // Mark messages as read when user opens a conversation (URL params version)
  app.post("/api/chat/mark-read/:taskId/:otherUserId", async (req, res) => {
    const { taskId, otherUserId } = req.params;
    await handleMarkRead(req, res, taskId, otherUserId);
  });

  // Mark messages as read when user opens a conversation (JSON body version)
  app.post("/api/chat/mark-read", async (req, res) => {
    const { taskId, otherUserId } = req.body;
    await handleMarkRead(req, res, taskId, otherUserId);
  });

  app.get("/api/chat/messages/:taskId/:otherUserId", async (req, res) => {
    try {
      const { taskId, otherUserId } = req.params;
      const currentUser = req.session.user;
      
      if (!currentUser) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const before = req.query.before as string | undefined;
      
      const messages = await storage.getChatMessages(taskId, currentUser.id, otherUserId, limit, before);
      const hasMore = messages.length === limit;
      res.json({ messages, hasMore, tasks: await getTasksForMessages(messages) });
    } catch (error) {
      console.error("[CHAT] ERROR:", error);
      res.status(500).json({ message: "Failed to get chat messages", error: String(error) });
    }
  });

  // Mark file as downloaded
  app.post("/api/chat/messages/:messageId/downloaded", async (req, res) => {
    try {
      const currentUser = req.session.user;
      if (!currentUser) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { messageId } = req.params;
      const updated = await storage.markFileDownloaded(messageId, currentUser.id);
      if (!updated) {
        return res.status(404).json({ message: "Message not found or already marked" });
      }
      res.json({ success: true, fileDownloadedAt: updated.fileDownloadedAt });
    } catch (error) {
      console.error("[CHAT] Error marking file downloaded:", error);
      res.status(500).json({ message: "Failed to mark file as downloaded" });
    }
  });


  // Configure multer for chat files (different from profile uploads)
  const chatUpload = multer({
    storage: IS_VERCEL ? multer.memoryStorage() : multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'chat');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `chat-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        cb(null, filename);
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for chat files
    }
  });

  // OPTIMIZED: Fast chat send endpoint
  // Dedup: guarda la Promise en vuelo (no el id ya resuelto) -- ver
  // comentario grande en el handler de /api/chat/send sobre por que.
  type ChatSendResult = { savedMessage: ChatMessage; task: Task | undefined; receiver: User; scan: ContactScan | null; censored: boolean };
  const recentMessages = new Map<string, Promise<ChatSendResult>>(); // hash -> send en curso
  
  // Ventana corta: solo para absorber doble-click/retry de red, no para
  // bloquear un reenvio real del mismo texto al mismo destinatario.
  setInterval(() => {
    recentMessages.clear();
  }, 5000);

  // ---- Contact Filter Rules in-memory cache (5-min TTL) ----
  // El motor (clasificacion por gravedad, censura, patrones {N}) vive en shared/contact-filter.ts.
  let filterRulesCache: { blacklist: FilterRule[]; whitelist: FilterRule[]; loadedAt: number } | null = null;

  async function loadFilterRules() {
    const now = Date.now();
    if (filterRulesCache && now - filterRulesCache.loadedAt < 5 * 60 * 1000) {
      return filterRulesCache;
    }
    const rules = await storage.getFilterRules();
    filterRulesCache = {
      blacklist: rules.filter(r => r.type === 'blacklist').map(r => compileFilterRule(r.value)),
      whitelist: rules.filter(r => r.type === 'whitelist').map(r => compileFilterRule(r.value)),
      loadedAt: now,
    };
    return filterRulesCache;
  }

  function invalidateFilterCache() {
    filterRulesCache = null;
  }

  // Seed default filter rules on startup (non-blocking)
  storage.seedFilterRulesIfEmpty().catch((e: any) => console.error('[FILTER_SEED] Error:', e));
  
  app.post("/api/chat/send", chatUpload.array('files', 5), async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { taskId, receiverId, message, replyToId, clientMsgId } = req.body;

      // Quick validation — taskId es opcional: mensaje directo sin pedido en comun.
      if (!receiverId) {
        return res.status(400).json({ message: "Missing receiverId" });
      }

      if (user.id === receiverId) {
        return res.status(400).json({ message: "Cannot send message to yourself", error: "SELF_MESSAGE_BLOCKED" });
      }

      // Bloqueo entre usuarios (en cualquier direccion): no se entregan mensajes.
      if (await storage.isBlockedBetween(user.id, String(receiverId))) {
        return res.status(403).json({ message: "No puedes enviar mensajes a este usuario.", error: "USER_BLOCKED" });
      }

      // Dedup: el check-then-set original ponia recentMessages.set() recien
      // DESPUES del insert a DB — entre el .has() y ese .set() habia varios
      // `await` (fetch de task/receiver, upload de archivos, insert), asi
      // que 2 requests concurrentes (doble-click, retry de red) pasaban el
      // .has() ambas ANTES de que la primera llegara al .set(), y creaban 2
      // filas distintas (confirmado con test real: 2 POSTs en Promise.all
      // -> 2 ids distintos en DB). Fix: reservar el slot con una Promise de
      // forma SINCRONICA, antes del primer await — un segundo request que
      // llegue mientras el primero sigue en vuelo encuentra la promesa ya
      // puesta y espera su resultado en vez de arrancar su propio insert.
      // Con clientMsgId (id del envio en el cliente) solo se deduplica el mismo envio
      // (doble-click/retry); sin el, cae al hash por texto de los otros clientes.
      const msgHash = clientMsgId
        ? `${user.id}:${receiverId}:id:${String(clientMsgId).slice(0, 80)}`
        : `${user.id}:${taskId || 'direct'}:${receiverId}:${(message || '').trim().slice(0, 50)}`;
      const existingSend = recentMessages.get(msgHash);
      if (existingSend) {
        try {
          const dup = await existingSend;
          return res.json({ ...dup.savedMessage, isDuplicate: true });
        } catch {
          // El intento original fallo (validacion/upload) -- dejar que
          // este intento reintente desde cero en vez de repetir el mismo error.
        }
      }

      type ChatSendFailure = { httpStatus: number; body: any };
      const sendPromise: Promise<ChatSendResult> = (async (): Promise<ChatSendResult> => {
        // PARALLEL: Fetch task (basic, no candidates) and receiver at the same time
        // El hilo se busca en el mismo viaje: pairKey ordena los ids, no
        // depende de quien es alumno/tutor. Con admin-001 el par del hilo es
        // otro (alumno/tutor reales), por eso se omite y createChatMessage
        // lo resuelve. Si no existe, createChatMessage lo crea como antes.
        const involvesAdmin = user.id === 'admin-001' || receiverId === 'admin-001';
        const [task, receiver, existingThread] = await Promise.all([
          taskId ? storage.getTaskBasic(taskId) : Promise.resolve(undefined),
          storage.getUserById(receiverId),
          involvesAdmin ? Promise.resolve(undefined) : storage.findThreadByPair(user.id, receiverId)
        ]);

        if (taskId && !task) {
          throw { httpStatus: 400, body: { message: "Task not found", taskId } } satisfies ChatSendFailure;
        }

        if (!receiver) {
          throw { httpStatus: 400, body: { message: "Receiver not found", receiverId } } satisfies ChatSendFailure;
        }

        if (!canSeeInactiveAccounts(user) && accountBlockedMessage(receiver)) {
          throw { httpStatus: 403, body: { message: "Este usuario está inactivo y no puede recibir mensajes por ahora.", error: "RECEIVER_INACTIVE" } } satisfies ChatSendFailure;
        }

        if (task) {
          // Modelo user-centric: ningun estado de un pedido puntual (expirado,
          // pago pendiente, asignado a otro tutor, completado) bloquea el envio
          // de mensajes — el hilo es del par, no del pedido. Esas etiquetas de
          // estado van a mostrarse mas adelante en la tarjeta de cotizacion, no
          // como un bloqueo global del chat.
          const isTaskOwner = task.userId === user.id;

          // Pedidos "active" (negociacion abierta): el remitente debe ser el
          // dueño del pedido, admin, o un tutor que realmente se postulo.
          // Hueco de autorizacion confirmado en la investigacion de la migracion
          // de chat: antes, cualquier usuario autenticado podia mandar mensajes
          // a cualquier taskId activo sin ser parte del pedido.
          if (task.status === 'active' && !isTaskOwner && user.id !== 'admin-001') {
            const candidates = await storage.getCandidatesByTask(taskId);
            const isCandidate = candidates.some(c => c.tutorId === user.id);
            if (!isCandidate) {
              throw { httpStatus: 403, body: { message: "No tienes acceso a este pedido.", error: "NOT_A_PARTICIPANT" } } satisfies ChatSendFailure;
            }
          }
        }

        // Process files - Upload to Object Storage for persistence
        let attachmentPaths: string[] | null = null;
        // Nombre original de cada adjunto, alineado con attachmentPaths. multer
        // entrega originalname como latin1: se re-decodifica a UTF-8 (tildes, ñ).
        let attachmentNames: string[] | null = null;
        let attachmentSizes: number[] | null = null;
        let attachmentDims: Array<{ w: number; h: number } | null> | null = null;

        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          // Promise.all en vez de loop secuencial: cada upload a Object
          // Storage es independiente, no hay razon para esperar uno para
          // empezar el siguiente. Promise.all preserva el orden de
          // `uploadedPaths` igual que req.files, aunque resuelvan en otro
          // orden.
          try {
            const dims: Array<{ w: number; h: number } | null> = [];
            attachmentPaths = await Promise.all(req.files.map(async (file, idx) => {
              try {
                const fileBuffer = fileBytes(file);
                // Dimensiones de la imagen (con EXIF orientation 5-8 ancho y alto se intercambian);
                // null si no es imagen o sharp no la entiende: el cliente usa su caja provisional.
                dims[idx] = null;
                if ((file.mimetype || '').startsWith('image/')) {
                  try {
                    const meta = await sharp(fileBuffer).metadata();
                    if (meta.width && meta.height) {
                      const swap = (meta.orientation ?? 1) >= 5;
                      dims[idx] = swap ? { w: meta.height, h: meta.width } : { w: meta.width, h: meta.height };
                    }
                  } catch { /* adjunto no decodificable: sin dimensiones */ }
                }
                const objectPath = await objectStorageService.uploadObjectEntity(
                  fileBuffer,
                  file.mimetype || 'application/octet-stream'
                );
                console.log(`[CHAT_FILE_UPLOAD] ✅ Uploaded to Object Storage: ${objectPath}`);
                discardFile(file);
                return objectPath;
              } catch (objStorageError) {
                try { discardFile(file); } catch (e) {}
                throw Object.assign(objStorageError as Error, { originalname: file.originalname });
              }
            }));
            attachmentNames = req.files.map(f => Buffer.from(f.originalname, 'latin1').toString('utf8'));
            attachmentSizes = req.files.map(f => f.size);
            attachmentDims = dims;
          } catch (objStorageError: any) {
            console.error("[CHAT_FILE_UPLOAD] ❌ Object Storage upload failed:", objStorageError);
            throw { httpStatus: 500, body: { message: `Error al subir "${objStorageError.originalname || 'archivo'}". Por favor intenta de nuevo.` } } satisfies ChatSendFailure;
          }
        }

        const { existingFiles } = req.body;
        if (existingFiles) {
          const existingList = Array.isArray(existingFiles) ? existingFiles : [existingFiles];
          const existingPaths = existingList.map((f: string) => {
            // Handle both local and Object Storage paths
            if (f.startsWith('/objects/') || f.startsWith('/uploads/')) return f;
            return `/uploads/${f}`;
          });
          attachmentPaths = attachmentPaths ? [...attachmentPaths, ...existingPaths] : existingPaths;
          attachmentNames = [...(attachmentNames || []), ...existingPaths.map(() => '')];
          attachmentSizes = [...(attachmentSizes || []), ...existingPaths.map(() => 0)];
          attachmentDims = [...(attachmentDims || []), ...existingPaths.map(() => null)];
        }

        // Respuesta: el mensaje citado debe existir y ser de esta misma conversacion
        // (autor y destinatario entre {remitente, receptor}); si no, se rechaza.
        let validReplyToId: string | null = null;
        if (replyToId) {
          const target = await storage.getChatMessageById(String(replyToId));
          const pair = [user.id, receiverId];
          if (!target || !pair.includes(target.senderId) || !pair.includes(target.receiverId)) {
            throw { httpStatus: 400, body: { message: "El mensaje citado no es valido." } } satisfies ChatSendFailure;
          }
          validReplyToId = target.id;
        }

        // Prevencion activa de contacto privado: un dato de ALTA gravedad (telefono, enlace, email) se censura aqui,
        // ANTES de guardar y de entregar: el destinatario, el push y la vista previa del hilo reciben solo el texto con
        // asteriscos; el original queda en original_message para el admin. Si el filtro falla, el mensaje pasa (no se
        // bloquea el chat) y el fallo queda en el log.
        let outgoingText: string | undefined = message;
        let scan: ContactScan | null = null;
        let censored = false;
        if (message && message.trim() && user.id !== 'admin-001') {
          try {
            const rules = await loadFilterRules();
            scan = scanContact(message, rules);
            if (scan.severity === 'high') {
              const masked = maskContact(message, rules);
              if (masked !== message) {
                outgoingText = masked;
                censored = true;
              }
            }
          } catch (err) {
            console.error('[CONTACT_FILTER] Error al filtrar mensaje (se entrega sin filtrar):', err);
          }
        }

        // Save message (task ya se trajo arriba, no repetir la query)
        const savedMessage = await storage.sendMessage({
          taskId,
          senderId: user.id,
          receiverId,
          message: outgoingText || "📎 Archivo adjunto",
          ...(censored ? { moderationStatus: 'masked' } : {}),
          attachments: attachmentPaths,
          attachmentNames,
          attachmentSizes,
          attachmentDims,
          replyToId: validReplyToId
        }, task, existingThread);
        return { savedMessage, task, receiver, scan, censored };
      })();

      // Reserva SINCRONICA del slot -- ver comentario arriba, esto es lo
      // que cierra la race. Nada de trabajo async corre entre el .get() de
      // arriba y este .set().
      recentMessages.set(msgHash, sendPromise);

      let savedMessage: ChatMessage, task: Task | undefined, receiver: User, scan: ContactScan | null, censored: boolean;
      try {
        ({ savedMessage, task, receiver, scan, censored } = await sendPromise);
      } catch (err: any) {
        recentMessages.delete(msgHash); // no cachear fallos, el proximo intento debe poder reintentar
        if (err && typeof err.httpStatus === 'number') {
          return res.status(err.httpStatus).json(err.body);
        }
        throw err;
      }

      logActivity(user.id, 'send_message', taskId ? `Mensaje en pedido ${taskId.slice(-6)}` : 'Mensaje directo', req);

      // Alerta para el admin (fire and forget): ALTA = ya censurada arriba; MEDIA = se entrego y requiere revision manual
      if (scan?.severity) {
        const alertScan = scan;
        (async () => {
          try {
            // Determine tutor vs student roles (sin task: por perfil de tutor real, ver resolveChatRoles)
            const { studentId: alertStudentId, tutorId: alertTutorId } = await storage.resolveChatRoles(user.id, receiverId, task);
            const detectedSnippet = describeScan(alertScan);

            await storage.createAdminAlert({
              type: 'personal_contact',
              messageId: savedMessage.id,
              taskId: taskId || undefined,
              studentId: alertStudentId,
              tutorId: alertTutorId,
              detectedContent: detectedSnippet,
              severity: alertScan.severity,
              originalMessage: message,
              status: 'pending',
            });

            console.log(`[CONTACT_SCAN] ⚠️  Alerta ${alertScan.severity} (${censored ? 'censurado' : 'entregado'}) para ${taskId ? `pedido ${taskId.slice(-6)}` : 'mensaje directo'} — "${detectedSnippet}"`);
          } catch (err) {
            console.error('[CONTACT_SCAN] Error:', err);
          }
        })();
      }

      // Con la cita embebida (replyTo) para que ambos lados la pinten al instante
      const [savedWithReply] = await storage.withReplyPreviews([savedMessage]);

      // Notify only the 2 participants (not the whole platform)
      const chatMessagePayload = {
        type: 'new_message',
        taskId,
        senderId: user.id,
        receiverId,
        message: savedWithReply
      };
      sendToUser(receiverId, chatMessagePayload);
      sendToUser(user.id, chatMessagePayload);
      
      // Send push notification to recipient (non-blocking)
      const messagePreview = chatPreviewText(savedMessage.message, savedMessage.attachments, savedMessage.attachmentNames);
      sendNewMessageNotification(
        receiverId,
        user.name,
        messagePreview,
        taskId,
        user.id
      ).catch((err: any) => console.log('[Push] Error sending notification:', err.message));

      // Email the receiver if offline and sender is not admin (fire-and-forget)
      // Solo para mensajes con pedido: el template enlaza a la pagina del
      // pedido y menciona su titulo, no aplica a un mensaje directo.
      if (task && user.id !== 'admin-001' && !getOnlineUsers().includes(receiverId)) {
        sendNewMessageEmail(
          receiver.email,
          receiver.name || 'Usuario',
          user.name,
          task.title,
          taskId,
          receiverId === task.userId ? 'student' : 'tutor'
        ).catch(err => console.error('[EMAIL] Error sending new message email:', err));
      }
      
      // `moderation` solo viaja al emisor para avisarle de la censura; no se guarda.
      res.json(censored ? { ...savedWithReply, moderation: { censored: true, notice: CONTACT_CENSORSHIP_NOTICE } } : savedWithReply);
    } catch (error) {
      console.error("[CHAT_SEND] Error:", error);
      res.status(500).json({ message: "Failed to send message", error: String(error) });
    }
  });

  // Payment verification routes
  app.post("/api/payment-verifications", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (user.userType !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { taskId, studentId, tutorId, paymentMethod, amount, receiptUrl, adminNotes } = req.body;
      if (!taskId || !studentId || !tutorId || !paymentMethod || !amount) {
        return res.status(400).json({ error: 'Missing required fields: taskId, studentId, tutorId, paymentMethod, amount' });
      }
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
      const verification = await storage.createPaymentVerification({
        taskId,
        studentId,
        tutorId,
        paymentMethod,
        amount: String(amount),
        receiptUrl: receiptUrl || "",
        adminNotes: adminNotes || null,
      });
      res.json(verification);
    } catch (error) {
      console.error('Error creating payment verification:', error);
      res.status(500).json({ error: 'Failed to create payment verification' });
    }
  });

  app.get("/api/payment-verifications", async (req, res) => {
    try {
      const caller = req.session.user;
      if (!caller || caller.userType !== 'admin') {
        return res.status(403).json({ message: "Acceso restringido al administrador" });
      }
      const verifications = await storage.getPaymentVerifications();
      
      // Enrich verifications with task, student and tutor info
      const enrichedVerifications = await Promise.all(verifications.map(async (v) => {
        const task = await storage.getTask(v.taskId);
        const student = await storage.getUser(v.studentId);
        const tutor = await storage.getUser(v.tutorId);
        
        return {
          ...v,
          taskTitle: task?.title || 'Tarea eliminada',
          taskNumber: task?.taskNumber || 'N/A',
          taskCurrency: task?.currency || 'PEN',
          studentName: student?.name || 'Usuario eliminado',
          tutorName: tutor?.name || 'Usuario eliminado',
        };
      }));
      
      res.json(enrichedVerifications);
    } catch (error) {
      console.error('Error fetching payment verifications:', error);
      res.status(500).json({ error: 'Failed to fetch payment verifications' });
    }
  });

  // Payment creation route - FLUJO COMPLETO DE PAGOS - Uses Object Storage
  app.post("/api/payments/create", paymentReceiptUpload.single('receipt'), async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Receipt file is required" });
      }

      const { taskId, tutorId, paymentMethod, amount } = req.body;

      // No se puede contratar a un tutor si el pedido ya quedo asignado a
      // OTRO tutor — el chat sigue abierto siempre, pero pagar/contratar es
      // una accion de este pedido puntual, y solo puede haber un asignado.
      const taskForPayment = await storage.getTaskBasic(taskId);
      if (taskForPayment?.assignedTutorId && taskForPayment.assignedTutorId !== tutorId) {
        try { discardFile(req.file); } catch (e) {}
        return res.status(400).json({ message: "Este pedido ya tiene un tutor asignado.", error: "TASK_ALREADY_ASSIGNED" });
      }
      // Cierre del pedido tambien bloquea, aunque assignedTutorId haya
      // quedado null (datos legacy) — no se contrata en un pedido cerrado.
      const taskClosedStatuses = ['completed', 'cancelled', 'expired'];
      if (taskForPayment && taskClosedStatuses.includes(taskForPayment.status)) {
        try { discardFile(req.file); } catch (e) {}
        return res.status(400).json({ message: "Este pedido ya esta cerrado.", error: "TASK_CLOSED" });
      }

      // Upload receipt to Object Storage for persistence
      let receiptUrl: string;
      try {
        const fileBuffer = fileBytes(req.file);
        receiptUrl = await objectStorageService.uploadObjectEntity(
          fileBuffer,
          req.file.mimetype || 'image/jpeg'
        );
        console.log(`[PAYMENT_RECEIPT_UPLOAD] ✅ Uploaded to Object Storage: ${receiptUrl}`);
        discardFile(req.file);
      } catch (objStorageError) {
        console.error("[PAYMENT_RECEIPT_UPLOAD] ❌ Object Storage upload failed:", objStorageError);
        try { discardFile(req.file); } catch (e) {}
        return res.status(500).json({ message: "Error al subir el comprobante. Por favor intenta de nuevo." });
      }

      console.log(`[PAYMENT_CREATE] Received payment data: TaskID=${taskId}, TutorID=${tutorId}, Method=${paymentMethod}, Amount=${amount}, Receipt=${receiptUrl}`);

      // CREATE PAYMENT VERIFICATION RECORD
      const verificationData = {
        taskId,
        studentId: user.id, // Sender is the student
        tutorId,
        paymentMethod,
        amount,
        receiptUrl,
        status: "pending", // Initial status
      };

      const createdVerification = await storage.createPaymentVerification(verificationData);
      console.log("[PAYMENT_CREATE] Payment verification created:", createdVerification.id);
      const paymentTask = await storage.getTask(taskId);
      const paymentCurrency = paymentTask?.currency || 'PEN';
      logActivity(user.id, 'payment', `Pago de ${amount} ${paymentCurrency} en pedido ${taskId.slice(-6)}`, req);

      const paymentMessage = `Pago enviado: ${amount} ${paymentCurrency}.

Adjunto el comprobante para la verificación de la transferencia.`;

      try {
        const chatMessage = await storage.sendMessage({
          taskId,
          senderId: user.id,
          receiverId: tutorId,
          message: paymentMessage,
          attachments: [receiptUrl] // Use Object Storage path for persistence
        });

        // INSTANT WEBSOCKET NOTIFICATION TO TUTOR - Same as quotation system
        try {
          // Send the same message format as regular chat messages
          const messageData = {
            type: 'new_message',
            taskId: taskId,
            senderId: user.id,
            receiverId: tutorId,
            message: paymentMessage,
            senderName: user.name || 'Estudiante',
            messageId: chatMessage.id,
            timestamp: new Date().toISOString(),
            attachments: [receiptUrl] // Use Object Storage path for persistence
          };
          
          // Broadcast to all connected clients
          broadcastMessage(messageData);
          console.log(`[PAYMENT_WEBSOCKET] ✅ Real-time payment notification sent - Type: ${messageData.type}, TaskID: ${taskId}, From: ${user.id} to ${tutorId}`);
          console.log(`[PAYMENT_WEBSOCKET] Message content: "${paymentMessage}"`);
        } catch (wsError) {
          console.error(`[PAYMENT_WEBSOCKET] Error broadcasting to tutor:`, wsError);
        }

        console.log("[PAYMENT_CHAT] ✅ Payment message sent to chat successfully");
      } catch (chatError) {
        console.error("[PAYMENT_CHAT] Error sending payment message to chat:", chatError);
        // Continue even if chat message fails - payment is still created
      }

      // MARK TASK AS PAYMENT PENDING AND ASSIGN TUTOR IMMEDIATELY
      // This locks out other tutors right away (anti-sabotage protection)
      try {
        await storage.updateTask(taskId, { 
          status: 'payment_pending',
          assignedTutorId: tutorId  // BLOQUEO INMEDIATO: Otros tutores → SOLO LECTURA
        });
        console.log(`[PAYMENT_CREATE] ✅ Task ${taskId} marked as payment_pending + assignedTutorId=${tutorId} - other tutors BLOCKED`);
        
        // NOTIFY OTHER CANDIDATES THAT PAYMENT IS PENDING (CHAT FROZEN)
        try {
          const taskCandidates = await storage.getCandidatesByTask(taskId);
          const otherCandidates = taskCandidates.filter((candidate: any) => candidate.tutorId !== tutorId);
          
          console.log(`[PAYMENT_NOTIFY] Found ${otherCandidates.length} other candidates to notify about payment pending for task ${taskId}`);
          
          // Send notification to each other candidate about BLOCKED status
          // NO revelamos quién fue seleccionado (privacidad)
          for (const candidate of otherCandidates) {
            try {
              const notificationMessage = {
                type: 'chat_blocked',
                taskId: taskId,
                userId: candidate.tutorId,
                reason: 'tutor_selected',
                timestamp: new Date().toISOString()
              };
              
              broadcastMessage(notificationMessage);
              
              console.log(`[PAYMENT_NOTIFY] ✅ Candidate ${candidate.tutorId} chat BLOCKED for task ${taskId}`);
            } catch (notifyError) {
              console.error(`[PAYMENT_NOTIFY] Error notifying candidate ${candidate.tutorId}:`, notifyError);
            }
          }
        } catch (candidatesError) {
          console.error("[PAYMENT_NOTIFY] Error getting task candidates:", candidatesError);
        }
        
      } catch (statusError) {
        console.error("[PAYMENT_CREATE] Error updating task status:", statusError);
      }
      
      res.status(201).json(createdVerification);
    } catch (error) {
      console.error('Error creating payment verification:', error);
      res.status(500).json({ error: 'Failed to create payment verification' });
    }
  });

  app.delete("/api/payment-verifications/:id", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.userType !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { id } = req.params;
      const deleted = await storage.deletePaymentVerification(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Payment verification not found' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting payment verification:', error);
      return res.status(500).json({ error: 'Failed to delete payment verification' });
    }
  });

  app.patch("/api/payment-verifications/:id", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.userType !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { id } = req.params;
      const { status, adminNotes, amount, paymentMethod } = req.body;

      // Fetch current payment to enforce state rules
      const current = await storage.getPaymentVerification(id);
      if (!current) {
        return res.status(404).json({ error: 'Payment verification not found' });
      }

      // Reject amount/paymentMethod changes for non-pending payments
      if ((amount !== undefined || paymentMethod !== undefined) && current.status !== 'pending') {
        return res.status(400).json({ error: 'Cannot change amount or payment method for non-pending payments' });
      }
      const extraFields: { amount?: string; paymentMethod?: string } = {};
      if (current.status === 'pending') {
        if (amount !== undefined) extraFields.amount = String(amount);
        if (paymentMethod !== undefined) extraFields.paymentMethod = paymentMethod;
      }

      const effectiveStatus = status ?? current.status;
      const previousStatus = current.status;

      const verification = await storage.updatePaymentVerification(id, effectiveStatus, adminNotes, extraFields, previousStatus);
      if (!verification) {
        return res.status(404).json({ error: 'Payment verification not found' });
      }

      // AUTO-SEND VERIFICATION MESSAGE WHEN ADMIN APPROVES (only on status transition)
      if (effectiveStatus === 'approved' && previousStatus !== 'approved') {
        try {
          // 1. CHANGE TASK STATUS TO "IN_PROGRESS"
          console.log(`[PAYMENT_APPROVED] Updating task ${verification.taskId} status to "in_progress"`);
          await storage.updateTaskStatus(verification.taskId, 'in_progress');
          
          // 2. ASSIGN TUTOR TO TASK OFFICIALLY AND SET AGREED PRICE
          console.log(`[PAYMENT_APPROVED] Assigning tutor ${verification.tutorId} to task ${verification.taskId}, agreed price: ${verification.amount}`);
          await storage.updateTask(verification.taskId, { 
            assignedTutorId: verification.tutorId,
            currentPrice: String(verification.amount),
            priceLastUpdated: new Date()
          });

          // 3. SEND NOTIFICATION MESSAGE TO STUDENT (owner of task)
          const task = await storage.getTask(verification.taskId);
          const studentId = task?.userId;
          
          if (studentId) {
            const studentMessage = `Tu pago fue verificado.`;
            await storage.sendMessage({
              taskId: verification.taskId,
              senderId: 'admin-001',
              receiverId: studentId,
              message: studentMessage,
              attachments: null
            });
            console.log(`[PAYMENT_APPROVED] ✅ Sent notification message to student ${studentId}`);
            
            // Send WebSocket notification to student for real-time update
            const studentNotification = {
              type: 'new_message',
              taskId: verification.taskId,
              message: studentMessage,
              senderId: 'admin-001'
            };
            sendToUser(studentId, studentNotification);
          }
          
          // 4. SEND TARGETED WEBSOCKET NOTIFICATION TO WINNING TUTOR ONLY - PRIVACY SAFE
          try {
            const taskTitle = task?.title || 'Nuevo pedido';
            
            const notificationData = {
              type: 'task_assigned',
              tutorId: verification.tutorId,
              taskId: verification.taskId,
              taskTitle: taskTitle,
              amount: verification.amount,
              currency: task?.currency || 'PEN',
              message: '¡Tienes un nuevo pedido asignado!',
              timestamp: new Date().toISOString()
            };
            
            // PRIVACY: Send only to the winning tutor, not broadcast to everyone
            const sent = sendToUser(verification.tutorId, notificationData);
            if (sent) {
              console.log(`[PAYMENT_APPROVED] 🎯 Targeted WebSocket notification sent to tutor ${verification.tutorId} for task assignment`);
            } else {
              console.log(`[PAYMENT_APPROVED] ⚠️ Tutor ${verification.tutorId} not online, notification not sent via WebSocket`);
            }
          } catch (wsError) {
            console.error(`[PAYMENT_APPROVED] Error sending WebSocket notification:`, wsError);
          }

          // 4. NOTIFY LOSING TUTORS - Send WebSocket notification for immediate UI update
          try {
            // Get all candidates for this task to find losing tutors
            const taskWithCandidates = await storage.getTask(verification.taskId);
            const allTutorIds = taskWithCandidates?.candidates?.map((c: any) => c.tutorId) || [];
            const losingTutors = allTutorIds.filter((tutorId: string) => tutorId !== verification.tutorId);
            
            console.log(`[PAYMENT_APPROVED] Found ${losingTutors.length} losing tutors - sending UI refresh notifications`);
            
            // Send WebSocket notification to losing tutors for immediate UI update
            for (const losingTutorId of losingTutors) {
              const loserNotification = {
                type: 'task_status_changed',
                taskId: verification.taskId,
                newStatus: 'in_progress',
                message: 'El pedido ya fue asignado a otro tutor',
                timestamp: new Date().toISOString()
              };
              
              const sent = sendToUser(losingTutorId, loserNotification);
              if (sent) {
                console.log(`[PAYMENT_APPROVED] 📤 Sent UI refresh notification to losing tutor ${losingTutorId}`);
              }
            }
          } catch (tutorsError) {
            console.error("[PAYMENT_APPROVED] Error getting/notifying losing tutors:", tutorsError);
          }

          console.log("[PAYMENT_APPROVED] ✅ Payment approval process completed");

          // Email student and tutor if offline (fire-and-forget)
          ;(async () => {
            try {
              const taskTitle = task?.title || 'Tu pedido';
              const onlineSet = new Set(getOnlineUsers());
              const [studentUser, tutorUser] = await Promise.all([
                studentId ? storage.getUser(studentId) : Promise.resolve(undefined),
                storage.getUser(verification.tutorId),
              ]);
              if (studentUser?.email && !onlineSet.has(studentId!)) {
                await sendPaymentApprovedStudent(studentUser.email, studentUser.name || 'Alumno', taskTitle, verification.taskId)
                  .catch(err => console.error('[EMAIL] payment student:', err));
              }
              if (tutorUser?.email && !onlineSet.has(verification.tutorId)) {
                await sendPaymentApprovedTutor(tutorUser.email, tutorUser.name || 'Tutor', taskTitle, verification.taskId)
                  .catch(err => console.error('[EMAIL] payment tutor:', err));
              }
            } catch (err) {
              console.error('[EMAIL] Error sending payment approved emails:', err);
            }
          })();
        } catch (chatError) {
          console.error("[PAYMENT_APPROVED] Error in payment approval process:", chatError);
        }
      }

      res.json(verification);
    } catch (error) {
      console.error('Error updating payment verification:', error);
      res.status(500).json({ error: 'Failed to update payment verification' });
    }
  });

  // User payment history route
  app.get("/api/users/:userId/payment-history", async (req, res) => {
    try {
      const { userId } = req.params;
      const history = await storage.getUserPaymentHistory(userId);
      res.json(history);
    } catch (error) {
      console.error('Error fetching user payment history:', error);
      res.status(500).json({ error: 'Failed to fetch payment history' });
    }
  });

  // Contact detection test endpoint
  app.post("/api/test-contact-detection", async (req, res) => {
    try {
      const { message, tutorId, studentId, taskId } = req.body;
      
      console.log(`[CONTACT_TEST] Testing message: "${message}"`);
      
      const detection = detectContactAttempt(message);
      
      if (detection.detected) {
        // Create test alert
        const alert = await storage.createAdminAlert({
          type: 'personal_contact',
          tutorId: tutorId || 'test-tutor-id',
          studentId: studentId || 'test-student-id', 
          taskId: taskId || 'test-task-id',
          messageId: 'test-message-id',
          detectedContent: detection.keywords.join(', '),
          status: 'pending'
        });
        
        console.log(`[CONTACT_TEST] ⚠️  Alert created:`, alert);
        
        res.json({
          detected: true,
          keywords: detection.keywords,
          alert: alert,
          message: 'Contact attempt detected and alert created'
        });
      } else {
        res.json({
          detected: false,
          keywords: [],
          message: 'No contact information detected'
        });
      }
    } catch (error) {
      console.error('[CONTACT_TEST] Error:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Contact detection system
  const CONTACT_KEYWORDS = [
    'cel', 'celular', 'whatsapp', 'wsp', 'wasap', 'whats', 
    'numero', 'número', 'num', 'fijo', 'tel', 'telf', 
    'telefono', 'teléfono', 'llámame', 'llamame', 
    'contáctame', 'contactame', 'llamar', 'llamame',
    'mi número', 'mi numero', 'escríbeme', 'escribeme',
    'correo', 'email', 'gmail', 'hotmail', 'yahoo',
    '@', '.com', '.net', '.org', 'mi correo', 'mi email'
  ];

  const detectContactAttempt = (message: string): { detected: boolean; keywords: string[] } => {
    const lowerMessage = message.toLowerCase();
    const detectedKeywords: string[] = [];
    
    // Check for keywords
    for (const keyword of CONTACT_KEYWORDS) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        detectedKeywords.push(keyword);
      }
    }
    
    // Check for phone number patterns (Peruvian format)
    const phonePatterns = [
      /\b9\d{8}\b/g,           // 9XXXXXXXX (mobile)
      /\b\d{3}-\d{3}-\d{3}\b/g, // XXX-XXX-XXX
      /\b\d{9}\b/g,            // XXXXXXXXX
      /\+51\s*9\d{8}/g,        // +51 9XXXXXXXX
      /\(\d{3}\)\s*\d{3}-\d{4}/g // (XXX) XXX-XXXX
    ];
    
    for (const pattern of phonePatterns) {
      if (pattern.test(lowerMessage)) {
        detectedKeywords.push('número_detectado');
        break;
      }
    }
    
    // Check for email patterns
    const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    if (emailPattern.test(lowerMessage)) {
      detectedKeywords.push('email_detectado');
    }
    
    return {
      detected: detectedKeywords.length > 0,
      keywords: detectedKeywords
    };
  };

  // =============================
  // UNIFIED PRICE SYSTEM ENDPOINTS - Single source of truth
  // =============================
  
  // GET current price for a task
  app.get("/api/tasks/:taskId/price", async (req, res) => {
    try {
      const { taskId } = req.params;
      console.log(`[PRICE_API] Getting current price for task ${taskId}`);
      
      const priceData = await storage.getTaskCurrentPrice(taskId);
      
      if (!priceData) {
        return res.status(404).json({ 
          error: "Task not found or no price available",
          taskId 
        });
      }
      
      console.log(`[PRICE_API] Current price for task ${taskId}: ${priceData.currentPrice}`);
      
      res.json({
        taskId,
        currentPrice: priceData.currentPrice,
        lastUpdated: priceData.lastUpdated,
        success: true
      });
    } catch (error) {
      console.error(`[PRICE_API] Error getting price for task ${req.params.taskId}:`, error);
      res.status(500).json({ 
        error: "Failed to get current price",
        taskId: req.params.taskId
      });
    }
  });

  // UPDATE current price for a task (used when tutor sends new quote)
  app.put("/api/tasks/:taskId/price", async (req, res) => {
    try {
      const { taskId } = req.params;
      const { newPrice } = req.body;
      
      console.log(`[PRICE_UPDATE] Updating price for task ${taskId} to ${newPrice}`);
      
      if (!newPrice || isNaN(parseFloat(newPrice))) {
        return res.status(400).json({ 
          error: "Valid newPrice is required",
          received: newPrice
        });
      }
      
      // ATOMIC UPDATE: Single source of truth
      const updatedPrice = await storage.updateTaskCurrentPrice(taskId, newPrice);
      
      console.log(`[PRICE_UPDATE] Price updated for task ${taskId}: ${updatedPrice.currentPrice}`);
      
      // TODO: Broadcast PRICE_UPDATE event via WebSocket to all connected clients
      // This will ensure real-time synchronization across all UI components
      
      res.json({
        taskId,
        currentPrice: updatedPrice.currentPrice,
        lastUpdated: updatedPrice.lastUpdated,
        success: true,
        message: `Price updated to ${updatedPrice.currentPrice}`
      });
    } catch (error) {
      console.error(`[PRICE_UPDATE] Error updating price for task ${req.params.taskId}:`, error);
      res.status(500).json({ 
        error: "Failed to update current price",
        taskId: req.params.taskId
      });
    }
  });

  const httpServer = createServer(app);

  // Check if payment verification already exists for task+tutor combination
  app.get("/api/payment-verifications/check", async (req, res) => {
    try {
      const { taskId, tutorId } = req.query;
      const user = req.session.user;
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!taskId || !tutorId) {
        return res.status(400).json({ message: "taskId and tutorId are required" });
      }
      
      // Check if a payment verification already exists for this task+tutor+user combination
      const existingPayment = await storage.getPaymentVerificationByTaskAndTutor(taskId as string, user.id, tutorId as string);
      
      // Sin pago todavia es el caso normal (no un error): 200 con null, para no llenar la consola de 404.
      res.json(existingPayment ?? null);
    } catch (error) {
      console.error("Error checking payment verification:", error);
      res.status(500).json({ message: "Failed to check payment verification" });
    }
  });

  // NEW ENDPOINT: Get selected tutor for a task (who received payment)
  app.get('/api/tasks/:taskId/selected-tutor', async (req, res) => {
    try {
      const { taskId } = req.params;
      const user = req.session.user;
      
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      console.log(`[SELECTED_TUTOR_API] Checking selected tutor for task ${taskId}, user ${user.id}`);

      // Only allow students to query this (task owners)
      const task = await storage.getTask(taskId);
      if (!task || task.userId !== user.id) {
        console.log(`[SELECTED_TUTOR_API] Unauthorized: User ${user.id} is not owner of task ${taskId}`);
        return res.status(403).json({ error: 'Not authorized' });
      }

      // The selected tutor is stored in the task's assignedTutorId field
      const selectedTutorId = task.assignedTutorId || null;
      res.json({ selectedTutorId });
    } catch (error) {
      console.error('Error getting selected tutor:', error);
      res.status(500).json({ error: 'Failed to get selected tutor' });
    }
  });

  // =============================
  // TASK DELIVERY SYSTEM - 7 Day Grace Period
  // =============================
  
  // Tutor marks task as completed (starts grace period)
  app.post("/api/tasks/:taskId/mark-completed", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { taskId } = req.params;
      const { deliveryMessage } = req.body;

      // Get task details
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Verify user is the assigned tutor
      if (task.assignedTutorId !== user.id) {
        return res.status(403).json({ message: "Only assigned tutor can mark task as completed" });
      }

      // Update task status to completed
      await storage.updateTask(taskId, { status: 'completed' });

      // Email student asking for review if offline (fire-and-forget)
      if (!getOnlineUsers().includes(task.userId)) {
        storage.getUser(task.userId).then(student => {
          if (student?.email) {
            sendRequestReviewEmail(student.email, student.name || 'Alumno', task.title, taskId)
              .catch(err => console.error('[EMAIL] Error sending request review email:', err));
          }
        }).catch(err => console.error('[EMAIL] Error fetching student for review email:', err));
      }

      // Check if there's an existing delivery (re-delivery case)
      const existingDelivery = await storage.getTaskDelivery(taskId);
      let delivery;
      
      if (existingDelivery) {
        // Re-delivery: update existing record to reset grace period
        delivery = await storage.updateTaskDelivery(taskId, {
          status: 'delivered',
          deliveryMessage: deliveryMessage || 'Tarea completada y entregada.',
          createdAt: new Date(),
        });
      } else {
        // First delivery
        const deliveryData = {
          taskId,
          tutorId: user.id,
          studentId: task.userId,
          status: 'delivered' as const,
          deliveryMessage: deliveryMessage || 'Tarea completada y entregada.'
        };
        delivery = await storage.createTaskDelivery(deliveryData);
      }

      const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Send notification to student about grace period
      const graceMessage = `Tu tarea ha sido marcada como completada. Tienes 7 días (hasta el ${gracePeriodEnd.toLocaleDateString('es-PE')}) para revisar y solicitar cambios si es necesario.`;

      try {
        await storage.sendMessage({
          taskId,
          senderId: 'admin-001',
          receiverId: task.userId,
          message: graceMessage
        });
      } catch (error) {
        console.error('Error sending grace period message:', error);
      }

      // Create admin alert
      try {
        await storage.createAdminAlert({
          type: 'task_completed',
          messageId: `Tarea ${taskId} marcada como completada por tutor. Período de gracia iniciado.`,
          taskId,
          studentId: user.id,
          tutorId: task.userId || 'unknown',
          detectedContent: `Tarea completada`
        });
      } catch (error) {
        console.error('Error creating admin alert:', error);
      }

      res.json({
        success: true,
        delivery,
        message: "Task marked as completed. Grace period started."
      });
    } catch (error) {
      console.error('Error marking task as completed:', error);
      res.status(500).json({ message: "Failed to mark task as completed" });
    }
  });

  // Get delivery status for a task
  app.get("/api/tasks/:taskId/delivery", async (req, res) => {
    try {
      const { taskId } = req.params;
      const delivery = await storage.getTaskDelivery(taskId);
      
      if (!delivery) {
        return res.status(404).json({ message: "No delivery found for this task" });
      }

      res.json(delivery);
    } catch (error) {
      console.error('Error getting task delivery:', error);
      res.status(500).json({ message: "Failed to get task delivery" });
    }
  });

  // Student confirms delivery (ends grace period)
  app.post("/api/tasks/:taskId/confirm-delivery", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { taskId } = req.params;
      const delivery = await storage.confirmTaskDelivery(taskId, user.id);

      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found or unauthorized" });
      }

      res.json({
        success: true,
        delivery,
        message: "Delivery confirmed successfully"
      });
    } catch (error) {
      console.error('Error confirming delivery:', error);
      res.status(500).json({ message: "Failed to confirm delivery" });
    }
  });

  // Student disputes delivery
  app.post("/api/tasks/:taskId/dispute-delivery", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { taskId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Dispute reason is required" });
      }

      const delivery = await storage.disputeTaskDelivery(taskId, user.id, reason);

      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found or unauthorized" });
      }

      // Create admin alert for dispute
      try {
        await storage.createAdminAlert({
          type: 'delivery_disputed',
          messageId: `Entrega de tarea ${taskId} disputada por estudiante. Razón: ${reason}`,
          taskId,
          studentId: user.id,
          tutorId: delivery.tutorId || 'unknown',
          detectedContent: reason || 'Disputa de entrega'
        });
      } catch (error) {
        console.error('Error creating dispute alert:', error);
      }

      res.json({
        success: true,
        delivery,
        message: "Delivery dispute submitted successfully"
      });
    } catch (error) {
      console.error('Error disputing delivery:', error);
      res.status(500).json({ message: "Failed to submit dispute" });
    }
  });

  // ===== REVIEWS SYSTEM =====

  // Get student's review for a specific task
  app.get("/api/tasks/:taskId/review", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { taskId } = req.params;
      const review = await storage.getReviewByTaskAndStudent(taskId, user.id);
      if (!review) {
        return res.json(null);
      }
      const delivery = await storage.getTaskDelivery(taskId);
      const gracePeriodEnd = delivery?.createdAt
        ? new Date(new Date(delivery.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;
      res.json({ ...review, gracePeriodEnd });
    } catch (error) {
      console.error('Error getting review:', error);
      res.status(500).json({ message: "Failed to get review" });
    }
  });

  // Create a review (student only, frozen until grace period ends)
  app.post("/api/tasks/:taskId/review", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { taskId } = req.params;
      const { rating, comment } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (task.userId !== user.id) {
        return res.status(403).json({ message: "Only the student who created the task can leave a review" });
      }
      if (task.status !== 'completed') {
        return res.status(400).json({ message: "Task must be completed to leave a review" });
      }
      if (!task.assignedTutorId) {
        return res.status(400).json({ message: "No tutor assigned to this task" });
      }

      const existingReview = await storage.getReviewByTaskAndStudent(taskId, user.id);
      if (existingReview) {
        return res.status(400).json({ message: "Review already exists. Use PUT to update." });
      }

      const tutorRecord = await storage.getTutorByUserId(task.assignedTutorId);
      if (!tutorRecord) {
        return res.status(404).json({ message: "Tutor not found" });
      }

      const review = await storage.createReview({
        taskId,
        tutorId: tutorRecord.id,
        studentId: user.id,
        rating,
        comment: comment || null,
      });

      // Email the tutor about the new review if offline (fire-and-forget)
      if (!getOnlineUsers().includes(task.assignedTutorId)) {
        storage.getUser(task.assignedTutorId).then(tutorUser => {
          if (tutorUser?.email) {
            sendNewReviewEmail(tutorUser.email, tutorUser.name || 'Tutor', task.title, taskId)
              .catch(err => console.error('[EMAIL] Error sending new review email:', err));
          }
        }).catch(err => console.error('[EMAIL] Error fetching tutor for review email:', err));
      }

      res.json({ success: true, review });
    } catch (error) {
      console.error('Error creating review:', error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Update a review (student only, during grace period)
  app.put("/api/tasks/:taskId/review", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { taskId } = req.params;
      const { rating, comment } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      const existingReview = await storage.getReviewByTaskAndStudent(taskId, user.id);
      if (!existingReview) {
        return res.status(404).json({ message: "No review found to update" });
      }

      if (existingReview.published) {
        return res.status(400).json({ message: "Cannot edit a published review" });
      }

      // Verify still within grace period
      const delivery = await storage.getTaskDelivery(taskId);
      if (delivery?.createdAt) {
        const gracePeriodEnd = new Date(new Date(delivery.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
        if (new Date() > gracePeriodEnd) {
          return res.status(400).json({ message: "Grace period has expired. Review can no longer be edited." });
        }
      }

      const updated = await storage.updateReview(existingReview.id, {
        rating,
        comment: comment || null,
      });

      res.json({ success: true, review: updated });
    } catch (error) {
      console.error('Error updating review:', error);
      res.status(500).json({ message: "Failed to update review" });
    }
  });

  // Auto-publish reviews: run immediately on startup, then every hour
  (async () => {
    if (!sideEffectsEnabled || IS_VERCEL) return; // en Vercel lo hace el cron (/api/cron/jobs)
    try {
      const count = await storage.publishDueReviews();
      if (count > 0) {
        console.log(`[STARTUP] Auto-published ${count} reviews after grace period`);
      }
    } catch (error) {
      console.error('[STARTUP] Error auto-publishing reviews:', error);
    }
  })();
  setInterval(async () => {
    if (!sideEffectsEnabled || getOnlineUsers().length === 0) return; // sin usuarios conectados: dejar dormir a Neon
    try {
      const count = await storage.publishDueReviews();
      if (count > 0) {
        console.log(`Auto-published ${count} reviews after grace period`);
      }
    } catch (error) {
      console.error('Error auto-publishing reviews:', error);
    }
  }, 3 * 60 * 60 * 1000); // Check every 3 hours

  // Background job: expire overdue tasks — runs every 30 min, skipped when no users online
  (async () => {
    if (!sideEffectsEnabled || IS_VERCEL) return; // en Vercel lo hace el cron (/api/cron/jobs)
    try {
      const count = await storage.updateExpiredTasks();
      if (count > 0) console.log(`[STARTUP] Expired ${count} overdue tasks`);
    } catch (error) {
      console.error('[STARTUP] Error expiring tasks:', error);
    }
  })();
  setInterval(async () => {
    if (!sideEffectsEnabled || getOnlineUsers().length === 0) return; // sin usuarios conectados: dejar dormir a Neon
    try {
      await storage.updateExpiredTasks();
    } catch (error) {
      console.error('[BACKGROUND] Error expiring tasks:', error);
    }
  }, 30 * 60 * 1000); // Every 30 minutes

  // Avisos de vencimiento (24 h / 50% del plazo): cada 3 h. NO se salta cuando no hay
  // usuarios online: el aviso es push y justo importa con la app cerrada.
  // Cada corrida despierta Neon (autosuspend ~5 min). Un aviso puede llegar hasta 3 h tarde.
  const runDeadlineReminders = async () => {
    if (!sideEffectsEnabled) return;
    try {
      const n = await sendDeadlineReminders();
      if (n > 0) console.log(`[DEADLINE_REMINDERS] ${n} avisos enviados`);
    } catch (error) {
      console.error('[DEADLINE_REMINDERS] Error:', error);
    }
  };
  if (!IS_VERCEL) {
    void runDeadlineReminders();
    setInterval(runDeadlineReminders, 3 * 60 * 60 * 1000);
  }

  // Tareas programadas en Vercel (cron): no hay un proceso encendido que ejecute los setInterval de arriba. Vercel llama a este GET
  // con "Authorization: Bearer <CRON_SECRET>". Sin CRON_SECRET configurado el endpoint queda cerrado (503).
  app.get("/api/cron/jobs", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ message: "CRON_SECRET no configurado" });
    if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ message: "No autorizado" });
    const result: Record<string, string> = {};
    const run = async (name: string, fn: () => Promise<unknown>) => {
      try { result[name] = String((await fn()) ?? "ok"); } catch (error) { console.error(`[CRON] ${name}:`, error); result[name] = "error"; }
    };
    await run("reservas_vencidas", () => releaseExpiredHolds());
    if (sideEffectsEnabled) {
      await run("resenas_publicadas", () => storage.publishDueReviews());
      await run("pedidos_vencidos", () => storage.updateExpiredTasks());
      await run("avisos_vencimiento", () => sendDeadlineReminders());
    }
    res.json({ ok: true, ...result });
  });

  // TEST ENDPOINT: Send real-time message to test WebSocket  
  app.post("/api/test-message", async (req, res) => {
    try {
      const { fromUserId, toUserId, taskId, message } = req.body;
      res.json({ success: true, message: "Test endpoint - old WebSocket removed" });
    } catch (error) {
      console.error("[POST /api/test-message] error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Study Areas endpoints
  app.get("/api/study-areas", async (req, res) => {
    try {
      const { q } = req.query;
      if (q && typeof q === 'string' && q.trim()) {
        const areas = await storage.searchStudyAreas(q.trim());
        return res.json(areas);
      }
      const areas = await storage.getStudyAreas();
      res.set('Cache-Control', 'public, max-age=300');
      res.json(areas);
    } catch (error) {
      console.error('Error getting study areas:', error);
      res.status(500).json({ message: "Error fetching study areas" });
    }
  });

  app.get("/api/study-areas/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }
      const areas = await storage.searchStudyAreas(q);
      res.json(areas);
    } catch (error) {
      console.error('Error searching study areas:', error);
      res.status(500).json({ message: "Error searching study areas" });
    }
  });

  app.post("/api/study-areas", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }
      const studyArea = await storage.createStudyArea({ name });
      res.json(studyArea);
    } catch (error) {
      console.error('Error creating study area:', error);
      res.status(500).json({ message: "Error creating study area" });
    }
  });

  app.delete("/api/study-areas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteStudyArea(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting study area:', error);
      res.status(500).json({ message: "Error deleting study area" });
    }
  });

  app.patch("/api/study-areas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      await storage.updateStudyArea(id, name);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating study area:', error);
      res.status(500).json({ message: "Error updating study area" });
    }
  });

  // Request Types endpoints
  app.get("/api/request-types", async (req, res) => {
    try {
      const { q } = req.query;
      if (q && typeof q === 'string' && q.trim()) {
        const types = await storage.searchRequestTypes(q.trim());
        return res.json(types);
      }
      const types = await storage.getRequestTypes();
      res.set('Cache-Control', 'public, max-age=300');
      res.json(types);
    } catch (error) {
      console.error('Error getting request types:', error);
      res.status(500).json({ message: "Error fetching request types" });
    }
  });

  app.get("/api/request-types/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }
      const types = await storage.searchRequestTypes(q);
      res.json(types);
    } catch (error) {
      console.error('Error searching request types:', error);
      res.status(500).json({ message: "Error searching request types" });
    }
  });

  // Create request type (service)
  app.post("/api/request-types", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }
      const requestType = await storage.createRequestType({ name });
      res.json(requestType);
    } catch (error) {
      console.error('Error creating request type:', error);
      res.status(500).json({ message: "Error creating request type" });
    }
  });

  // Delete request type (service)
  app.delete("/api/request-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRequestType(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting request type:', error);
      res.status(500).json({ message: "Error deleting request type" });
    }
  });

  // Update request type (service)
  app.patch("/api/request-types/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      await storage.updateRequestType(id, name);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating request type:', error);
      res.status(500).json({ message: "Error updating request type" });
    }
  });

  // Seed study areas and request types on startup
  try {
    await storage.seedStudyAreasAndRequestTypes();
    console.log('[SERVER] Study areas and request types seeded');
  } catch (error) {
    console.error('[SERVER] Error seeding study areas and request types:', error);
  }

  // =====================================================
  // PUSH NOTIFICATIONS ENDPOINTS
  // =====================================================
  
  // Get VAPID public key for client subscription
  app.get("/api/push/vapid-public-key", (req, res) => {
    const publicKey = getVapidPublicKey();
    if (publicKey) {
      res.json({ publicKey });
    } else {
      res.status(503).json({ message: "Push notifications not configured" });
    }
  });

  // Subscribe to push notifications - uses session for security
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { subscription } = req.body;
      
      if (!subscription) {
        return res.status(400).json({ message: "Missing subscription" });
      }

      const { endpoint, keys } = subscription;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: "Invalid subscription format" });
      }

      const saved = await storage.savePushSubscription({
        userId: user.id, // Use authenticated user ID, not client-provided
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.get('User-Agent') || null,
      });

      console.log(`[Push] Subscription saved for user ${user.id}`);
      res.json({ success: true, subscriptionId: saved.id });
    } catch (error) {
      console.error('[Push] Error saving subscription:', error);
      res.status(500).json({ message: "Error saving subscription" });
    }
  });

  // Unsubscribe from push notifications - uses session for security
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({ message: "Missing endpoint" });
      }

      const deleted = await storage.deletePushSubscription(user.id, endpoint);
      console.log(`[Push] Subscription removed for user ${user.id}: ${deleted}`);
      res.json({ success: deleted });
    } catch (error) {
      console.error('[Push] Error removing subscription:', error);
      res.status(500).json({ message: "Error removing subscription" });
    }
  });

  // =====================================================
  // SEGURIDAD DE LA COMUNIDAD Y CUENTA (requisitos de App Store / Google Play)
  // =====================================================

  // Bloquear a un usuario: ninguno de los dos puede escribirle al otro.
  app.post("/api/user/blocks/:userId", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      const blockedId = req.params.userId;
      if (blockedId === user.id) return res.status(400).json({ message: "No puedes bloquearte a ti mismo" });
      if (!(await storage.getUser(blockedId))) return res.status(404).json({ message: "Usuario no encontrado" });
      await storage.blockUser(user.id, blockedId);
      res.json({ success: true });
    } catch (error) {
      console.error('[Safety] Error blocking user:', error);
      res.status(500).json({ message: "Error al bloquear al usuario" });
    }
  });

  app.delete("/api/user/blocks/:userId", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      const removed = await storage.unblockUser(user.id, req.params.userId);
      res.json({ success: removed });
    } catch (error) {
      console.error('[Safety] Error unblocking user:', error);
      res.status(500).json({ message: "Error al desbloquear al usuario" });
    }
  });

  app.get("/api/user/blocks", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      res.json(await storage.getBlockedUsers(user.id));
    } catch (error) {
      console.error('[Safety] Error listing blocks:', error);
      res.status(500).json({ message: "Error al cargar los bloqueos" });
    }
  });

  // Reportar a un usuario: llega al panel de alertas del admin (tipo "user_report").
  app.post("/api/user/reports", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      const parsed = reportUserSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Reporte invalido" });
      const { reportedUserId, reason, details, taskId } = parsed.data;
      if (reportedUserId === user.id) return res.status(400).json({ message: "No puedes reportarte a ti mismo" });
      const reported = await storage.getUser(reportedUserId);
      if (!reported) return res.status(404).json({ message: "Usuario no encontrado" });

      const taskExists = taskId ? !!(await storage.getTaskBasic(taskId)) : false;
      await storage.createAdminAlert({
        type: 'user_report',
        studentId: user.id, // quien reporta
        tutorId: reportedUserId, // a quien se reporta
        taskId: taskExists ? taskId : null,
        messageId: null,
        detectedContent: `Reporte de ${user.name} (${user.email}) contra ${reported.name} (${reported.email}) · motivo: ${reason}${details ? ` · ${details}` : ''}`,
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
      } as any);
      res.json({ success: true });
    } catch (error) {
      console.error('[Safety] Error creating report:', error);
      res.status(500).json({ message: "Error al enviar el reporte" });
    }
  });

  // Eliminar la propia cuenta (Apple 5.1.1(v) / Google Play). Anonimiza al usuario y cierra la sesion; ver storage.anonymizeUser.
  app.delete("/api/user/account", async (req, res) => {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser) return res.status(401).json({ message: "Authentication required" });
      if (sessionUser.email === MAIN_ADMIN_EMAIL || ['admin', 'agent'].includes(sessionUser.userType)) {
        return res.status(403).json({ message: "Las cuentas de administración no se pueden eliminar desde la app." });
      }
      if (req.body?.confirmation !== 'ELIMINAR') {
        return res.status(400).json({ message: "Escribe ELIMINAR para confirmar." });
      }
      if ((await storage.countOpenTasksForUser(sessionUser.id)) > 0) {
        return res.status(409).json({
          code: 'OPEN_TASKS',
          message: "Tienes pedidos con pago o trabajo en curso. Finalízalos o contacta a soporte antes de eliminar tu cuenta.",
        });
      }

      const user = await storage.getUser(sessionUser.id);
      await storage.anonymizeUser(sessionUser.id);

      // Supabase Auth: se borra el usuario del proveedor para que el correo pueda volver a registrarse. Best effort.
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUid = (user as any)?.supabaseUid;
      if (supabaseUrl && serviceKey && supabaseUid) {
        fetch(`${supabaseUrl}/auth/v1/admin/users/${supabaseUid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        }).catch((err) => console.error('[Account] No se pudo borrar el usuario de Supabase Auth:', err.message));
      }

      req.session.destroy(() => {
        res.clearCookie('miltareas.session');
        res.json({ success: true });
      });
    } catch (error) {
      console.error('[Account] Error deleting account:', error);
      res.status(500).json({ message: "No se pudo eliminar la cuenta" });
    }
  });

  // Registrar el token de push nativo (FCM/APNs) del dispositivo. El usuario sale de la sesion, nunca del cuerpo.
  app.post("/api/push/native-token", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const parsed = insertNativePushTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid token payload" });
      }
      await storage.saveNativePushToken({ ...parsed.data, userId: user.id });
      res.json({ success: true });
    } catch (error) {
      console.error('[Push] Error saving native token:', error);
      res.status(500).json({ message: "Error saving token" });
    }
  });

  // Quitar el token nativo (desactivar avisos o cerrar sesion). Solo borra tokens del usuario autenticado.
  app.delete("/api/push/native-token", async (req, res) => {
    try {
      const user = req.session.user;
      const parsed = deleteNativeTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Missing token" });
      }
      // Con sesion: solo borra tokens propios. Sin sesion: se acepta poseer el token (es un secreto del dispositivo,
      // imposible de adivinar) para reintentar el borrado de un logout hecho sin conexion, cuando la sesion ya no existe.
      const deleted = user
        ? await storage.deleteNativePushToken(user.id, parsed.data.token)
        : await storage.deleteNativePushTokenByValue(parsed.data.token);
      res.json({ success: deleted });
    } catch (error) {
      console.error('[Push] Error removing native token:', error);
      res.status(500).json({ message: "Error removing token" });
    }
  });

  // Test push notification (admin only)
  app.post("/api/push/test", async (req, res) => {
    try {
      const user = req.session.user;
      if (!user || user.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId, title, body } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "Missing userId" });
      }

      const result = await sendPushNotification(userId, {
        title: title || 'Prueba de notificación',
        body: body || 'Esta es una notificación de prueba de MilTareas',
        tag: 'test',
      });

      res.json({ ...result, success: true });
    } catch (error) {
      console.error('[Push] Error sending test notification:', error);
      res.status(500).json({ message: "Error sending notification" });
    }
  });

  // Activity Logs API
  app.get("/api/activity-logs/:userId", async (req, res) => {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser || sessionUser.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const logs = await storage.getActivityLogs(req.params.userId, 200);
      res.json(logs);
    } catch (error) {
      console.error("[GET /api/activity-logs/:userId] error:", error);
      res.status(500).json({ message: "Error fetching activity logs" });
    }
  });

  app.get("/api/activity-logs", async (req, res) => {
    try {
      const sessionUser = req.session.user;
      if (!sessionUser || sessionUser.email !== MAIN_ADMIN_EMAIL) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const logs = await storage.getAllActivityLogs(500);
      res.json(logs);
    } catch (error) {
      console.error("[GET /api/activity-logs] error:", error);
      res.status(500).json({ message: "Error fetching activity logs" });
    }
  });

  // Exchange rates cache (24-hour TTL)
  let exchangeRatesCache: { rates: Record<string, number>; lastUpdated: Date } | null = null;

  app.get("/api/exchange-rates", async (req, res) => {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      if (exchangeRatesCache && exchangeRatesCache.lastUpdated > oneDayAgo) {
        return res.json({ rates: exchangeRatesCache.rates, lastUpdated: exchangeRatesCache.lastUpdated, cached: true });
      }

      const response = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await response.json();

      if (data.result !== "success") throw new Error("API error");

      const currencies = ["PEN", "COP", "MXN", "ARS", "CLP", "EUR", "USD"];
      const filteredRates: Record<string, number> = { USD: 1 };
      currencies.forEach(c => { if (data.rates[c]) filteredRates[c] = data.rates[c]; });

      exchangeRatesCache = { rates: filteredRates, lastUpdated: now };
      return res.json({ rates: filteredRates, lastUpdated: now, cached: false });
    } catch (error) {
      console.error("[GET /api/exchange-rates] error:", error);
      if (exchangeRatesCache) {
        return res.json({ rates: exchangeRatesCache.rates, lastUpdated: exchangeRatesCache.lastUpdated, cached: true });
      }
      return res.status(503).json({ message: "Tasas de cambio no disponibles" });
    }
  });

  // Clean server without old WebSocket conflicts
  console.log('[SERVER] HTTP server created for new presence system');

  return httpServer;
}

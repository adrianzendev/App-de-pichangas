import type { Express, Request, RequestHandler } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "./db";
import { storage } from "./storage";
import { SUPERADMIN_AUDIT_ACTIONS, superadminAuditLog, users } from "@shared/schema";
import { isSuperAdmin } from "@shared/admin";
import {
  AUDIT_TABLE_DDL, READ_AUDIT_WINDOW_MS, createOnceEvery, impersonationExpired, impersonationRule, isSameOrigin, routeWithoutQuery, shouldAudit, shouldAuditRead,
} from "./superadmin-rules";

declare module "express-session" {
  interface SessionData {
    // Id del super admin real mientras la sesion muestra a otro usuario. Si existe, hay impersonacion.
    impersonatorId?: string;
    impersonationStartedAt?: number;
  }
}

// req.ip respeta `trust proxy`: el primer valor de x-forwarded-for lo escribe el cliente y se podria falsificar.
const clientIp = (req: Request) => req.ip || req.socket?.remoteAddress || "";

const auditLogQuerySchema = z.object({
  action: z.enum(SUPERADMIN_AUDIT_ACTIONS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// false si no se pudo escribir: inicio de impersonacion exige que el registro exista.
async function audit(row: { actorId: string; action: string; targetUserId?: string | null; detail?: object; ip: string }): Promise<boolean> {
  try {
    await db.insert(superadminAuditLog).values({ ...row, targetUserId: row.targetUserId ?? null });
    return true;
  } catch (e) {
    console.error("[SuperadminAudit] error:", e);
    return false;
  }
}

const saveSession = (req: Request) =>
  new Promise<Error | null>((resolve) => req.session.save((err) => resolve(err ?? null)));

const reloadSession = (req: Request) =>
  new Promise<Error | null>((resolve) => req.session.reload((err) => resolve(err ?? null)));

async function userTypeOf(u: any): Promise<string> {
  if (isSuperAdmin(u.email)) return "admin";
  if (u.role === "agent") return "agent";
  return (await storage.getTutorByUserId(u.id)) ? "tutor" : "student";
}

// Vuelve a la cuenta del super admin y registra el cierre. false si esa cuenta ya no es super admin. Lanza si no se guarda.
async function endImpersonation(req: Request, reason: "stop" | "logout" | "expired"): Promise<boolean> {
  const adminId = req.session.impersonatorId!;
  const admin = await storage.getUser(adminId);
  if (!admin || !isSuperAdmin(admin.email)) return false;
  const targetUserId = req.session.user?.id;
  req.session.user = { ...admin, userType: "admin" };
  delete req.session.impersonatorId;
  delete req.session.impersonationStartedAt;
  const saveError = await saveSession(req);
  if (saveError) throw saveError;
  await audit({ actorId: adminId, action: "impersonate_end", targetUserId, detail: { reason }, ip: clientIp(req) });
  return true;
}

// Sin esperarla para no frenar el arranque. Si falla, la impersonacion sigue sin iniciar y el error queda en el registro.
async function ensureAuditTable() {
  try {
    for (const statement of AUDIT_TABLE_DDL) await db.execute(sql.raw(statement));
  } catch (error) {
    console.error("[SuperadminAudit] no se pudo crear la tabla:", error);
  }
}

// Registrar ANTES del middleware RBAC de /api/admin (el usuario impersonado no es admin, y "stop" debe poder salir).
export function registerSuperadmin(app: Express) {
  void ensureAuditTable();

  const requireSameOrigin: RequestHandler = (req, res, next) => {
    if (isSameOrigin(req.get("origin"), [req.get("host"), req.hostname])) return next();
    res.status(403).json({ message: "Origen no permitido" });
  };

  // Idempotente: si ya vencio en el servidor, el cliente igual puede limpiar su estado y volver al panel.
  app.post("/api/admin/impersonate/stop", requireSameOrigin, async (req, res) => {
    if (!req.session.impersonatorId) return res.json({ ok: true });
    try {
      if (!(await endImpersonation(req, "stop"))) return res.status(403).json({ message: "Acceso restringido" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[POST /api/admin/impersonate/stop] error:", error);
      res.status(500).json({ message: "Error al guardar la sesión, intenta de nuevo" });
    }
  });

  app.post("/api/admin/impersonate/:id", requireSameOrigin, async (req, res) => {
    const me = req.session.user;
    if (!me || !isSuperAdmin(me.email) || req.session.impersonatorId) {
      return res.status(403).json({ message: "Acceso restringido al super administrador" });
    }
    try {
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "Usuario no encontrado" });
      if (isSuperAdmin(target.email)) return res.status(400).json({ message: "No puedes verte como tú mismo" });
      const logged = await audit({ actorId: me.id, action: "impersonate_start", targetUserId: target.id, ip: clientIp(req) });
      if (!logged) return res.status(500).json({ message: "No se pudo registrar la auditoría; no se inició" });
      req.session.impersonatorId = me.id;
      req.session.impersonationStartedAt = Date.now();
      req.session.user = { ...target, userType: await userTypeOf(target) };
      const saveError = await saveSession(req);
      if (saveError) {
        console.error("Session save error:", saveError);
        return res.status(500).json({ message: "Error al guardar la sesión, intenta de nuevo" });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[POST /api/admin/impersonate/:id] error:", error);
      res.status(500).json({ message: "Error del servidor" });
    }
  });

  // Cerrar sesion impersonando vuelve a la cuenta del super admin: no destruye su sesion ni toca la del usuario.
  // Si esa cuenta ya no es super admin, sigue a la ruta normal, que cierra la sesion sin tocar al usuario impersonado.
  app.post("/api/auth/logout", async (req, res, next) => {
    if (!req.session.impersonatorId) return next();
    try {
      if (await endImpersonation(req, "logout")) return res.json({ message: "Logout successful" });
      next();
    } catch (error) {
      console.error("[POST /api/auth/logout] error:", error);
      res.status(500).json({ message: "Error al guardar la sesión, intenta de nuevo" });
    }
  });

  // Registro de auditoria, solo lectura (no hay ruta para editarlo ni borrarlo). Solo el super admin con su propia sesion.
  app.get("/api/admin/audit-log", async (req, res) => {
    if (!isSuperAdmin(req.session.user?.email) || req.session.impersonatorId) {
      return res.status(403).json({ message: "Acceso restringido al super administrador" });
    }
    const query = auditLogQuerySchema.safeParse(req.query);
    if (!query.success) return res.status(400).json({ message: "Parametros invalidos" });
    try {
      const { action, page, pageSize } = query.data;
      const where = action ? eq(superadminAuditLog.action, action) : undefined;
      const actor = alias(users, "actor");
      const target = alias(users, "target");
      const [items, [{ total }]] = await Promise.all([
        db.select({
          id: superadminAuditLog.id,
          action: superadminAuditLog.action,
          detail: superadminAuditLog.detail,
          ip: superadminAuditLog.ip,
          createdAt: superadminAuditLog.createdAt,
          actorName: actor.name,
          targetName: target.name,
          targetEmail: target.email,
        })
          .from(superadminAuditLog)
          .leftJoin(actor, eq(superadminAuditLog.actorId, actor.id))
          .leftJoin(target, eq(superadminAuditLog.targetUserId, target.id))
          .where(where)
          .orderBy(desc(superadminAuditLog.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ total: sql<number>`count(*)::int` }).from(superadminAuditLog).where(where),
      ]);
      res.json({ items, total, page, pageSize });
    } catch (error) {
      console.error("[GET /api/admin/audit-log] error:", error);
      res.status(500).json({ message: "No se pudo cargar el registro de auditoría" });
    }
  });

  // Peticiones simultaneas tras el vencimiento: una sola cierra y registra; las demas esperan y releen la sesion.
  const ending = new Map<string, Promise<boolean>>();
  const readOnce = createOnceEvery(READ_AUDIT_WINDOW_MS);

  // Todas las rutas registradas despues de esta pasan por aqui.
  app.use("/api", async (req, res, next) => {
    if (req.session?.impersonatorId && impersonationExpired(req.session.impersonationStartedAt, Date.now())) {
      try {
        let closing = ending.get(req.sessionID);
        if (!closing) {
          closing = endImpersonation(req, "expired").finally(() => ending.delete(req.sessionID));
          ending.set(req.sessionID, closing);
        }
        const ended = await closing;
        // Sin una cuenta a la que volver no se sirve nada mas con la sesion del usuario.
        if (!ended) return req.session.destroy(() => res.status(401).json({ message: "No user logged in" }));
        const reloadError = await reloadSession(req);
        if (reloadError) throw reloadError;
      } catch (error) {
        console.error("[impersonation expiry] error:", error);
        return res.status(500).json({ message: "Error del servidor" });
      }
    }
    const impersonatorId = req.session?.impersonatorId;
    const rule = impersonatorId ? impersonationRule(req.method, req.originalUrl) : "allow";
    if (rule === "noop") return res.json({ success: true, ok: true, updatedCount: 0 });
    const actorId = impersonatorId ?? (isSuperAdmin(req.session?.user?.email) ? req.session?.user?.id : undefined);
    const isAuditedRead = !!actorId && shouldAuditRead(req.method, req.originalUrl, !!impersonatorId);
    if (actorId && (isAuditedRead || shouldAudit(req.method, req.originalUrl, !!impersonatorId))) {
      const targetUserId = impersonatorId ? req.session.user?.id : null;
      const ip = clientIp(req);
      const method = req.method;
      const route = routeWithoutQuery(req.originalUrl); // sin query (puede llevar tokens) y sin cuerpo
      res.on("finish", () => {
        // Una lectura rechazada no entrego datos; las repetidas por la consulta periodica no aportan.
        if (isAuditedRead && (res.statusCode >= 400 || !readOnce(`${actorId}|${targetUserId}|${route.toLowerCase()}`, Date.now()))) return;
        void audit({ actorId, action: isAuditedRead ? "read" : "request", targetUserId, detail: { method, route, status: res.statusCode }, ip });
      });
    }
    // Despues de armar la auditoria: los intentos bloqueados tambien quedan registrados.
    if (rule === "block") {
      return res.status(403).json({ message: "Solo lectura: no puedes hacer cambios mientras ves la cuenta de otro usuario" });
    }
    next();
  });
}

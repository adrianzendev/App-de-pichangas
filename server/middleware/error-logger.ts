import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, Response } from "express";
import type { ErrorLogLevel } from "@shared/schema";
import { storage } from "../storage";
import { redact, routeOf } from "./redact";

export { redact, routeOf };

// Registro de errores del servidor (panel de administracion > Errores).
//
// Como la mayoria de los endpoints atrapan su propio error y responden 500 SIN llamar a next(err), el manejador global
// de Express no los ve. Por eso la captura es en tres capas:
//   1. errorCapture: por peticion, al terminar la respuesta, registra cualquier 5xx. Recupera el Error real que el endpoint
//      imprimio con console.error (via AsyncLocalStorage) o, si no hay, el mensaje del JSON de respuesta.
//   2. errorHandler: el manejador de errores de Express (next(err)); deja el Error para que errorCapture lo registre.
//   3. installProcessErrorLogging: excepciones no capturadas y promesas rechazadas del proceso (nivel critical).
// logError() es el helper para registrar a mano desde cualquier endpoint. Nunca lanza: registrar un error no puede
// tumbar la peticion ni el proceso.

const MESSAGE_MAX = 2000;
const STACK_MAX = 10_000;
const DEDUPE_MS = 60_000; // el mismo error en la misma ruta no se vuelve a guardar durante 1 minuto (evita inundar la tabla)
const DEDUPE_MAX_KEYS = 500;
const SKIP_ROUTE_PREFIX = "/api/admin/error-logs"; // si el propio registro falla, no se registra a si mismo en bucle

// Error o algo que se comporta como uno (errores de librerias que no extienden Error pero traen message y stack).
function isErrorLike(value: unknown): value is Error {
  return value instanceof Error || (!!value && typeof value === "object" && typeof (value as any).message === "string" && typeof (value as any).stack === "string");
}

const recent = new Map<string, number>();
function isDuplicate(key: string, now = Date.now()): boolean {
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return true;
  if (recent.size >= DEDUPE_MAX_KEYS) for (const [k, t] of recent) if (now - t >= DEDUPE_MS) recent.delete(k);
  if (recent.size >= DEDUPE_MAX_KEYS) recent.clear();
  recent.set(key, now);
  return false;
}

export interface ErrorLogInput {
  level?: ErrorLogLevel;
  /** El error capturado (o cualquier valor lanzado). */
  error?: unknown;
  /** Sobrescribe el mensaje que se deduce de `error`. */
  message?: string;
  /** Con `req` se toman ruta, metodo y usuario de la peticion. */
  req?: Request;
  route?: string;
  method?: string;
  userId?: string | null;
}

/**
 * Registra un error en `error_logs`. Uso manual desde un endpoint:
 *   catch (error) { void logError({ error, req, level: "warning" }); res.status(400)... }
 * Nunca lanza.
 */
export async function logError(input: ErrorLogInput): Promise<void> {
  try {
    const err = input.error;
    const rawMessage = input.message ?? (isErrorLike(err) ? err.message : err !== undefined ? String(err) : "Error sin mensaje");
    const route = input.route ?? (input.req ? routeOf(input.req.originalUrl || input.req.url) : null);
    if (route?.startsWith(SKIP_ROUTE_PREFIX)) return;
    const method = input.method ?? input.req?.method ?? null;
    const level: ErrorLogLevel = input.level ?? "error";
    const message = redact(rawMessage).slice(0, MESSAGE_MAX) || "Error sin mensaje";
    if (isDuplicate(`${level}|${method}|${route}|${message.slice(0, 200)}`)) return;
    const stack = isErrorLike(err) && err.stack ? redact(err.stack).slice(0, STACK_MAX) : null;
    await storage.createErrorLog({
      level,
      message,
      stack,
      route,
      method,
      userId: input.userId ?? (input.req as any)?.session?.user?.id ?? null,
      status: "pending",
    });
  } catch (loggingError) {
    console.error("[ERROR_LOGGER] no se pudo guardar el error:", (loggingError as Error)?.message);
  }
}

// ---- Captura por peticion -------------------------------------------------------------------------------------------

type RequestStore = { errors: Error[] };
const requestStore = new AsyncLocalStorage<RequestStore>();
let consolePatched = false;

// Los endpoints suelen hacer `console.error("...", error)` antes de responder 500: se guarda ese Error (maximo 5 por
// peticion) para registrar su mensaje y stack reales en vez de un "500" sin contexto.
function patchConsoleError() {
  if (consolePatched) return;
  consolePatched = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const store = requestStore.getStore();
    if (store && store.errors.length < 5) for (const a of args) if (isErrorLike(a)) store.errors.push(a);
    original(...args);
  };
}

/** Middleware global: va despues de la sesion y antes de las rutas. Registra toda respuesta 5xx al terminar. */
export function errorCapture(req: Request, res: Response, next: NextFunction) {
  patchConsoleError();
  const store: RequestStore = { errors: [] };

  let bodyMessage = "";
  const originalJson = res.json.bind(res);
  res.json = (body?: any) => {
    if (res.statusCode >= 500 && body && typeof body === "object") bodyMessage = String(body.message ?? body.error ?? "");
    return originalJson(body);
  };

  res.on("finish", () => {
    if (res.statusCode < 500) return;
    const error: Error | undefined = res.locals.loggedError ?? store.errors[0];
    // Mensaje de la respuesta + causa real; sin repetir cuando son el mismo texto (errorHandler responde err.message).
    const message = [...new Set([bodyMessage, error?.message].filter(Boolean))].join(": ") || `HTTP ${res.statusCode}`;
    void logError({ level: "error", error, message, req });
  });

  requestStore.run(store, next);
}

/** Manejador de errores de Express (next(err)): responde igual que antes y deja el Error para errorCapture. */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.locals.loggedError = err;
  console.error("[ERROR_HANDLER]", message, err.stack);
  if (!res.headersSent) res.status(status).json({ message });
}

/** Excepciones no capturadas y promesas rechazadas: nivel critical, sin ruta. Mantiene el proceso vivo como antes. */
export function installProcessErrorLogging() {
  process.on("unhandledRejection", (reason) => {
    console.error("[PROCESS] unhandledRejection:", reason);
    void logError({ level: "critical", error: reason, message: `unhandledRejection: ${reason instanceof Error ? reason.message : String(reason)}` });
  });
  process.on("uncaughtException", (err) => {
    console.error("[PROCESS] uncaughtException:", err);
    void logError({ level: "critical", error: err, message: `uncaughtException: ${err.message}` });
  });
}

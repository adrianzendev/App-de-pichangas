import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { hashPassword } from "./password";

// Piezas de seguridad de la autenticacion: contrasenas debiles, mensaje unico de login, tokens de activacion y limitacion
// de intentos. Las usan server/routes.ts (login, registro, activacion, cambio de contrasena) y tests/auth-security.test.ts.

/** Contrasena que `createUser` asignaba a TODA cuenta sin clave (agentes, tutores y alumnos creados por el admin). Nunca mas. */
export const DEFAULT_PASSWORD = "123456";

/** Unico mensaje de login fallido: no distingue "no existe", "clave incorrecta", "cuenta de Google" ni "clave provisional". */
export const GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos";
export const TOO_MANY_ATTEMPTS = "Demasiados intentos. Intenta de nuevo en unos minutos.";

const PASSWORD_MIN = 6;
const PASSWORD_MAX = 200;
const COMMON_PASSWORDS = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "000000", "654321", "123123", "121212",
  "password", "contraseña", "contrasena", "qwerty", "qwerty123", "abc123", "iloveyou", "admin", "miltareas",
]);

/** Motivo por el que una contrasena no se acepta, o null si es valida. Mensaje apto para mostrar al usuario. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string") return "Contraseña inválida";
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (password.length > PASSWORD_MAX) return "La contraseña es demasiado larga";
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) return "Elige una contraseña menos común";
  return null;
}

// Hash de relleno: cuando la cuenta no existe o no tiene clave local, el login igual hace un scrypt contra este para que
// el tiempo de respuesta no delate si el correo esta registrado.
export const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(12).toString("hex"));

// ---- Tokens de activacion (definir o restablecer contrasena por correo) --------------------------------------------------
// En la base solo se guarda el SHA-256 del token: un volcado de la tabla no sirve para activar cuentas.
export const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;

export const hashActivationToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export function newActivationToken(now = Date.now()): { token: string; hash: string; expires: Date } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashActivationToken(token), expires: new Date(now + ACTIVATION_TTL_MS) };
}

export const isActivationTokenShape = (token: unknown): token is string => typeof token === "string" && /^[a-f0-9]{64}$/.test(token);

// ---- Limitacion de intentos (en memoria: una sola instancia; con varias, pasar a un almacen compartido) --------------------
const tooMany = (_req: Request, res: Response) => res.status(429).json({ message: TOO_MANY_ATTEMPTS });
const emailOf = (req: Request): string => (typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim().slice(0, 254) : "");
const common = { standardHeaders: true, legacyHeaders: false, handler: tooMany } as const;
const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/** Login: 8 fallos por IP + correo cada 15 min (frena la adivinanza sobre una cuenta). Los exitosos no cuentan. */
export const loginAccountLimiter = rateLimit({ ...common, windowMs: FIFTEEN_MIN, limit: 8, skipSuccessfulRequests: true, keyGenerator: (req) => `${req.ip}|${emailOf(req)}` });
/** Login: 40 fallos por IP cada 15 min (frena el barrido de muchos correos con la misma clave). */
export const loginIpLimiter = rateLimit({ ...common, windowMs: FIFTEEN_MIN, limit: 40, skipSuccessfulRequests: true });
export const registerLimiter = rateLimit({ ...common, windowMs: ONE_HOUR, limit: 10 });
/** Pedir el enlace de activacion: 5 por IP + correo y 20 por IP cada hora (evita inundar de correos a una persona). */
export const requestActivationAccountLimiter = rateLimit({ ...common, windowMs: ONE_HOUR, limit: 5, keyGenerator: (req) => `${req.ip}|${emailOf(req)}` });
export const requestActivationIpLimiter = rateLimit({ ...common, windowMs: ONE_HOUR, limit: 20 });
export const activateLimiter = rateLimit({ ...common, windowMs: FIFTEEN_MIN, limit: 10 });
export const changePasswordLimiter = rateLimit({ ...common, windowMs: FIFTEEN_MIN, limit: 10, keyGenerator: (req) => (req as any).session?.user?.id ?? req.ip ?? "anon" });
/** Avisos de fallos del cliente (adjuntos): 20 por usuario cada 15 min, para que un bucle del navegador no llene el panel Errores. */
export const clientErrorLimiter = rateLimit({ ...common, windowMs: FIFTEEN_MIN, limit: 20, keyGenerator: (req) => (req as any).session?.user?.id ?? req.ip ?? "anon" });

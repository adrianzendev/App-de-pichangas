// Reglas puras (sin BD) del super admin: que se permite y que se audita durante la impersonacion.
// Las usa server/superadmin.ts; tests/impersonation.test.ts las prueba sin levantar nada.

export const routeWithoutQuery = (url: string): string => url.split(/[?#]/)[0];

// Igual que migrations/025. El servidor lo corre al arrancar porque `npm start` no aplica migraciones: sin esta tabla
// la impersonacion no inicia. Aditivo e idempotente; una columna nueva sigue necesitando su migracion.
export const AUDIT_TABLE_DDL = [
  `CREATE TABLE IF NOT EXISTS superadmin_audit_log (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
    detail jsonb,
    ip text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS superadmin_audit_log_created_idx ON superadmin_audit_log (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS superadmin_audit_log_actor_idx ON superadmin_audit_log (actor_id)`,
];

// Una impersonacion olvidada no sigue abierta: la cookie de sesion dura 30 dias.
export const IMPERSONATION_MAX_MS = 30 * 60 * 1000;

// Sin hora de inicio (sesion anterior a este limite) cuenta como vencida.
export const impersonationExpired = (startedAt: number | undefined, now: number): boolean =>
  !startedAt || now - startedAt >= IMPERSONATION_MAX_MS;

// Express ignora mayusculas y la barra final al enrutar: las reglas deben comparar igual, o /api/USER/... se las salta.
const normalizedPath = (url: string): string => routeWithoutQuery(url).toLowerCase().replace(/\/+$/, "");

const isRead = (method: string): boolean => method === "GET" || method === "HEAD" || method === "OPTIONS";

// Impersonar es SOLO VER: toda escritura se bloquea salvo lo que aparece aqui. Una ruta nueva queda bloqueada por defecto.
// POST que no escriben nada (lecturas con cuerpo) y cerrar sesion.
const ALLOWED_WHILE_IMPERSONATING = [
  /^\/api\/auth\/logout$/,
  /^\/api\/tutor\/unviewed-count$/,
  /^\/api\/chat\/get-or-create$/, // solo busca el hilo, no lo crea
];

// Efectos de "abrir" algo: el cliente los lanza solo al navegar. Se responde OK sin tocar nada, para no borrar los
// no leidos del usuario real ni mandar el doble check a la otra persona.
const SILENT_WHILE_IMPERSONATING = [
  /^\/api\/chat\/threads\/[^/]+\/mark-read$/,
  /^\/api\/chat\/mark-read(\/[^/]+\/[^/]+)?$/,
  /^\/api\/chat\/messages\/[^/]+\/downloaded$/,
  /^\/api\/tasks\/[^/]+\/view$/,
  /^\/api\/tasks\/[^/]+\/mark-proposals-viewed$/,
  /^\/api\/client-errors\/attachment$/, // un fallo del admin mirando no debe quedar a nombre del usuario
];

export type ImpersonationRule = "allow" | "noop" | "block";

export function impersonationRule(method: string, url: string): ImpersonationRule {
  if (isRead(method)) return "allow";
  const path = normalizedPath(url);
  if (ALLOWED_WHILE_IMPERSONATING.some((re) => re.test(path))) return "allow";
  if (SILENT_WHILE_IMPERSONATING.some((re) => re.test(path))) return "noop";
  return "block";
}

// Defensa CSRF de iniciar/terminar la impersonacion: en produccion la cookie es SameSite=None y esos POST no llevan
// cuerpo, asi que un formulario de otra web los dispararia. Sin Origin (o "null") se rechaza: fetch siempre lo envia.
export function isSameOrigin(origin: string | undefined, hosts: Array<string | undefined>): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return hosts.some((h) => {
      const host = h?.toLowerCase();
      return !!host && (url.host === host || url.hostname === host);
    });
  } catch {
    return false;
  }
}

// Datos privados de otra persona: chats y pagos al impersonar; sin impersonar, el chat de un pedido visto desde el panel.
const SENSITIVE_READS_IMPERSONATING = [/^\/api\/chat\//, /^\/api\/payment/];
const SENSITIVE_READS_ADMIN = [/^\/api\/admin\/tasks\/[^/]+\/chat$/];

export function shouldAuditRead(method: string, url: string, impersonating: boolean): boolean {
  if (method !== "GET") return false;
  const path = normalizedPath(url);
  return (impersonating ? [...SENSITIVE_READS_IMPERSONATING, ...SENSITIVE_READS_ADMIN] : SENSITIVE_READS_ADMIN).some((re) => re.test(path));
}

// Una misma lectura se registra una vez por ventana: el chat consulta cada 30 s al impersonar y llenaria la tabla.
export const READ_AUDIT_WINDOW_MS = 10 * 60 * 1000;

// true la primera vez que aparece la clave en la ventana. Tope de memoria: al llenarse se descartan las ya vencidas.
export function createOnceEvery(windowMs: number, maxKeys = 2000) {
  const seen = new Map<string, number>();
  return (key: string, now: number): boolean => {
    const last = seen.get(key);
    if (last !== undefined && now - last < windowMs) return false;
    if (seen.size >= maxKeys) {
      seen.forEach((at, k) => { if (now - at >= windowMs) seen.delete(k); });
      if (seen.size >= maxKeys) seen.clear();
    }
    seen.set(key, now);
    return true;
  };
}

// Se audita todo lo que no es lectura cuando: se impersona, o el super admin toca /api/admin o /api/users.
// Inicio y fin de impersonacion se registran aparte, con su propia accion.
export function shouldAudit(method: string, url: string, impersonating: boolean): boolean {
  if (isRead(method)) return false;
  const path = normalizedPath(url);
  if (path.startsWith("/api/admin/impersonate/")) return false;
  return impersonating || path.startsWith("/api/admin") || path.startsWith("/api/users");
}

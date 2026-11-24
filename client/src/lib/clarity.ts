// Microsoft Clarity: no graba el panel de admin ni las cuentas internas de prueba.
const CLARITY_ID = "yw93hso5u3";

const EXCLUDED_EMAILS = new Set([
  "admin@miltareas.com",
  "carlosadrianchoquehuanca@gmail.com",
  "miltareaslatam@gmail.com",
  "adrianchoquehuancahuaraya@gmail.com",
]);

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] };
const clarityWindow = () => window as unknown as { clarity?: ClarityFn };

export const isAdminPath = (path: string) => /^\/(admin|dashboard)(\/|$)/.test(path);

const isExcluded = (email: string | null | undefined) => !!email && EXCLUDED_EMAILS.has(email.trim().toLowerCase());

// Cancela la sesion si Clarity ya estaba cargado; si no lo estaba, no hace nada (y no lo carga).
export function ignoreClarity() {
  clarityWindow().clarity?.("upgrade", "ignore");
}

// Llamar con el usuario ya resuelto (email = null si es anonimo). Idempotente.
export function syncClarity(email: string | null | undefined, path: string) {
  if (!import.meta.env.PROD) return;
  if (isExcluded(email) || isAdminPath(path)) return ignoreClarity();
  const w = clarityWindow();
  if (w.clarity) return; // ya cargado
  w.clarity = function (...args: unknown[]) {
    (w.clarity!.q = w.clarity!.q || []).push(args);
  };
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.clarity.ms/tag/" + CLARITY_ID;
  document.head.appendChild(s);
}

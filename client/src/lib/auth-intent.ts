// Pestana (Alumno/Tutor) activa al pulsar "Continuar con Google": el callback la lee al volver de OAuth.
// localStorage con vencimiento (no sessionStorage): en movil el sistema puede matar la app mientras el usuario
// esta en el navegador, y sin esto un tutor se crearia como alumno. Mismo patron que `recovery-flag.ts`.
export type AuthIntent = "student" | "tutor";

const KEY = "auth_intent_role";
const TTL_MS = 10 * 60 * 1000;

export const setAuthIntent = (role: AuthIntent) => {
  try { localStorage.setItem(KEY, JSON.stringify({ role, at: Date.now() })); } catch { /* storage bloqueado */ }
};

export const readAuthIntent = (): AuthIntent => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { role?: string; at?: number } | null;
    return saved?.role === "tutor" && Date.now() - (saved.at ?? 0) < TTL_MS ? "tutor" : "student";
  } catch {
    return "student";
  }
};

export const clearAuthIntent = () => {
  try { localStorage.removeItem(KEY); } catch { /* storage bloqueado */ }
};

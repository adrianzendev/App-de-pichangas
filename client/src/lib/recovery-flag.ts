// Marca "este navegador pidio recuperar contraseña". localStorage (no session) para que valga si el
// enlace se abre en otra pestaña; vence en 1 h, igual que el enlace del correo.
const KEY = "pw_recovery";
const TTL_MS = 60 * 60 * 1000;

export const markRecovery = () => {
  try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage bloqueado */ }
};
export const clearRecovery = () => {
  try { localStorage.removeItem(KEY); } catch { /* storage bloqueado */ }
};
export const isRecoveryPending = () => {
  try { return Date.now() - Number(localStorage.getItem(KEY)) < TTL_MS; } catch { return false; }
};

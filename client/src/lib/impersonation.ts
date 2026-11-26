import { clearAccountState } from "@/lib/logout";
import { queryClient } from "@/lib/queryClient";
import { ADMIN_ROUTES } from "@/lib/routes";

// La cookie de sesion es la misma en todas las pestanas: si una cambia de cuenta, las demas seguirian mostrando la
// cuenta anterior mientras actuan con la nueva. Se avisa a las otras para que recarguen (quien envia no recibe su aviso).
const sessionChannel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("miltareas-session");
if (sessionChannel) sessionChannel.onmessage = () => window.location.reload();

// Entrar o salir de "ver como": el servidor cambia la sesion, se borra todo el estado local de la cuenta anterior
// (cache, IndexedDB, cached_user_session) y la recarga dura reinicia el WebSocket. Lanza con el mensaje del servidor si falla.
async function switchSession(url: string, to: string): Promise<void> {
  const res = await fetch(url, { method: "POST", credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "No se pudo cambiar de cuenta");
  }
  await clearAccountState();
  sessionChannel?.postMessage("session-switched");
  window.location.href = to;
}

export const startImpersonation = (userId: string) => switchSession(`/api/admin/impersonate/${userId}`, "/");
export const stopImpersonation = () => switchSession("/api/admin/impersonate/stop", ADMIN_ROUTES.players);

export const isImpersonating = (): boolean =>
  !!queryClient.getQueryData<{ impersonating?: boolean }>(["/api/user/current"])?.impersonating;

// Al impersonar no hay WebSocket (marcaria al usuario real como conectado): el chat se refresca consultando.
export const chatPollInterval = (normal: number | false): number | false => (isImpersonating() ? 30_000 : normal);

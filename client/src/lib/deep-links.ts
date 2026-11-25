import { AUTH_ROUTES } from "@/lib/routes";
import { isNativeApp } from "@/lib/auth-redirect";
import { loadAppPlugin, loadBrowserPlugin } from "@/lib/native-plugins";

const ALLOWED_PATHS: string[] = [AUTH_ROUTES.callback, AUTH_ROUTES.resetPassword];
// Solo estos parametros pasan a la app: nada mas que venga en el enlace llega a la pantalla de callback.
const ALLOWED_PARAMS = ["code", "type", "error", "error_description"];

function webHost(): string {
  try { return new URL(import.meta.env.VITE_SITE_URL || "https://app.miltareas.com").host; } catch { return "app.miltareas.com"; }
}

/**
 * Traduce un deep link de autenticacion a la ruta interna (`/auth/callback?code=...`), o `null` si no es uno.
 * Acepta `miltareas://auth/callback?...` (esquema propio) y `https://<dominio de la app>/auth/callback?...`
 * (App Link / Universal Link). Nunca devuelve el hash: un `#access_token` no se acepta (ver lib/auth-session.ts).
 */
export function toAuthCallbackPath(rawUrl: string): string | null {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }

  const scheme = (import.meta.env.VITE_NATIVE_AUTH_SCHEME || "miltareas://").replace(/:.*$/, ":");
  let path: string;
  if (url.protocol === scheme) path = `/${url.host}${url.pathname}`.replace(/\/+$/, "");
  else if (url.protocol === "https:" && url.host === webHost()) path = url.pathname.replace(/\/+$/, "");
  else return null;

  if (!ALLOWED_PATHS.includes(path)) return null;
  const params = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Escucha los deep links de la app nativa y lleva el retorno de Supabase a `/auth/callback` sin recargar, donde
 * `completeAuthFromUrl` intercambia el `code` y restaura la sesion. Inerte en web.
 */
export async function initDeepLinks(navigate: (to: string) => void): Promise<void> {
  if (!isNativeApp()) return;
  const [app, browser] = await Promise.all([loadAppPlugin(), loadBrowserPlugin()]);
  if (!app) return;

  const handle = (url: string) => {
    const path = toAuthCallbackPath(url);
    if (!path) return;
    void browser?.close().catch(() => {}); // cierra el Custom Tab que quedo abierto
    navigate(path);
  };
  await app.addListener("appUrlOpen", (e) => handle(e.url));
  const launch = await app.getLaunchUrl(); // arranque en frio con el enlace
  if (launch?.url) handle(launch.url);
}

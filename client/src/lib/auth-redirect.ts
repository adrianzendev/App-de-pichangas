import { AUTH_ROUTES } from "@/lib/routes";

type AuthPath = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES];

/** True dentro del WebView de Capacitor. Sin importar el paquete: en web `window.Capacitor` no existe. */
export function isNativeApp(): boolean {
  return !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

/**
 * URL a la que Supabase devuelve al usuario tras el correo o el login con Google (`redirectTo` / `emailRedirectTo`).
 * Debe estar en la lista de Redirect URLs del panel de Supabase.
 *
 * - Web (y WebView que carga la web con `server.url`): `VITE_SITE_URL` o el origen actual.
 * - App nativa con archivos empaquetados: el origen del WebView (`capacitor://localhost`) no es alcanzable desde
 *   el navegador del sistema, asi que se usa el esquema propio (`VITE_NATIVE_AUTH_SCHEME`, por defecto `miltareas://`).
 */
export function authRedirectUrl(path: AuthPath): string {
  if (isNativeApp() && !import.meta.env.VITE_NATIVE_USE_WEB_ORIGIN) {
    const scheme = (import.meta.env.VITE_NATIVE_AUTH_SCHEME || "miltareas://").replace(/:\/*$/, "");
    return `${scheme}://${path.replace(/^\//, "")}`;
  }
  return (import.meta.env.VITE_SITE_URL || window.location.origin) + path;
}

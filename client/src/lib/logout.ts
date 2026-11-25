import { queryClient, persister } from "@/lib/queryClient";
import { removeNativePushToken } from "@/lib/push-native";
import { supabase } from "@/lib/supabase";
import { isImpersonating, stopImpersonation } from "@/lib/impersonation";
import { toast } from "@/hooks/use-toast";

// Claves de localStorage que dependen de la cuenta (el resto, p. ej. soundEnabled, es del dispositivo).
const USER_KEYS = ["cached_user_session", "lastUserContext"];
const USER_KEY_PREFIXES = ["tutor_tasks_cursor_", "admin_"];

// Unica salida de sesion de la app: cierra sesion en el servidor y borra todo rastro de la
// cuenta saliente en este dispositivo, para que la siguiente cuenta no rehidrate nada ajeno.
// Tope por paso de red / plugin nativo: un fetch o `plugin.unregister()` colgado (WebView con mala senal, FCM sin
// respuesta) no puede dejar el boton sin efecto. Total maximo: 2 pasos x 1.5 s = 3 s.
const STEP_TIMEOUT_MS = 1_500;

// Nunca rechaza ni espera mas de STEP_TIMEOUT_MS.
function bestEffort(task: () => Promise<unknown>): Promise<void> {
  return Promise.race([
    Promise.resolve().then(task).catch((e) => console.error("Logout step error:", e)),
    new Promise<void>((resolve) => setTimeout(resolve, STEP_TIMEOUT_MS)),
  ]).then(() => undefined);
}

// Push web: la suscripcion del navegador queda ligada a la cuenta en el servidor. Solo se lee el endpoint (local, sin red);
// la baja la hace /api/auth/logout en la misma peticion que cierra la sesion.
async function webPushEndpoint(): Promise<string | undefined> {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub?.endpoint;
}

// Borra el estado local de la cuenta actual (cache de React Query + IndexedDB + claves de localStorage).
// Lo usan el logout y el cambio de sesion al impersonar: la recarga dura la hace quien llama.
export async function clearAccountState(): Promise<void> {
  try {
    queryClient.clear();
    // clear() solo escribe a IndexedDB con throttle (~1 s) y la recarga dura llega antes:
    // se borra el snapshot de forma explicita para que /login no rehidrate la cuenta saliente.
    await Promise.race([
      Promise.resolve(persister.removeClient()).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
    for (const key of Object.keys(localStorage)) {
      if (USER_KEYS.includes(key) || USER_KEY_PREFIXES.some((p) => key.startsWith(p))) localStorage.removeItem(key);
    }
    sessionStorage.clear();
  } catch { /* storage bloqueado */ }
}

export async function logout(): Promise<void> {
  // Impersonando, "Cerrar sesión" vuelve a la cuenta del super admin. No se sigue con el flujo normal: daria de baja
  // el push de este dispositivo, que es del super admin.
  if (isImpersonating()) {
    await stopImpersonation().catch((e) => toast({ variant: "destructive", title: e.message }));
    return;
  }
  try {
    // 1. Push nativo (token FCM/APNs; necesita la sesion aun viva) y endpoint del push web, en paralelo:
    //    sin borrarlos el dispositivo seguiria recibiendo avisos ajenos.
    let pushEndpoint: string | undefined;
    await Promise.all([
      bestEffort(() => removeNativePushToken()),
      bestEffort(async () => { pushEndpoint = await webPushEndpoint(); }),
    ]);

    // 2. Sesion del servidor (incluye la baja del push web) + sesion local de Supabase (scope local: sin red).
    await bestEffort(() =>
      Promise.all([
        fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pushEndpoint }),
        }),
        supabase.auth.signOut({ scope: "local" }),
      ]),
    );
  } finally {
    // 3. Estado local y 4. recarga dura: se ejecutan siempre, aunque los pasos de red fallen o se cuelguen.
    await clearAccountState();
    // Reinicia el WebSocket, el cache de precios y cualquier estado en memoria.
    window.location.href = "/login";
  }
}

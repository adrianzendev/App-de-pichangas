import { navigate } from "wouter/use-browser-location";
import { isNativeApp } from "@/lib/auth-redirect";
import { loadPushPlugin, type PushPlugin } from "@/lib/native-plugins";
import { PushError, type PushChannel, type PushPermission } from "@/lib/push-types";

// Canal de push nativo (FCM / APNs) para la app Capacitor. Inerte en web: sin Capacitor ni plugin devuelve
// `isSupported() === false` y no carga nada. El servidor guarda el token en /api/push/native-token.

const TOKEN_KEY = "native_push_token";
// Borrado pendiente: logout hecho sin conexion. Se reintenta al abrir la app y al volver la red.
const PENDING_DELETION_KEY = "pending_push_token_deletion";
const TOKEN_WAIT_MS = 15_000;

let listenersReady = false;
let pendingToken: ((token: string) => void) | null = null;

const readToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const writeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage bloqueado */ }
};

function nativePlatform(): "ios" | "android" {
  const platform = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.();
  return platform === "ios" ? "ios" : "android";
}

// Solo rutas internas: el `data.url` de una notificacion no debe poder abrir otro sitio.
function isInternalPath(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !url.includes("\\");
}

const readPendingDeletion = (): string | null => {
  try { return localStorage.getItem(PENDING_DELETION_KEY); } catch { return null; }
};
const writePendingDeletion = (token: string | null) => {
  try {
    if (token) localStorage.setItem(PENDING_DELETION_KEY, token);
    else localStorage.removeItem(PENDING_DELETION_KEY);
  } catch { /* storage bloqueado */ }
};

/** true = el servidor ya no tiene el token (o nunca lo tuvo). false = no se pudo saber: hay que reintentar. */
async function deleteTokenOnServer(token: string): Promise<boolean> {
  try {
    const response = await fetch("/api/push/native-token", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    });
    return response.status < 500;
  } catch {
    return false; // sin conexion
  }
}

/** Reintenta el borrado de un token huerfano (logout sin red). Inerte si no hay nada pendiente. */
export async function flushPendingNativePushDeletion(): Promise<void> {
  const token = readPendingDeletion();
  if (token && (await deleteTokenOnServer(token))) writePendingDeletion(null);
}

async function postToken(token: string): Promise<boolean> {
  try {
    const response = await fetch("/api/push/native-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, platform: nativePlatform() }),
    });
    return response.ok; // 401 = sin sesion todavia: se reintenta al iniciar sesion (refresh)
  } catch {
    return false;
  }
}

// Escuchas globales y permanentes: el token (llega tras register() y rota) y el toque sobre una notificacion.
// El de `registration` NO depende del timeout de subscribe(): si APNs/FCM responde tarde (mala senal, primer arranque
// en iOS), el token se guarda y se envia igual, sin avisar a nadie, y el dispositivo no se pierde.
async function ensureListeners(plugin: PushPlugin) {
  if (listenersReady) return;
  listenersReady = true;
  await plugin.addListener("registration", ({ value }) => {
    writeToken(value);
    pendingToken?.(value);
    void postToken(value);
  });
  await plugin.addListener("registrationError", (e) => console.error("[Push] Native registration error:", e.error));
  await plugin.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = notification.data?.url;
    if (isInternalPath(url)) navigate(url);
  });
}

/** Una vez al arrancar (main.tsx): atiende el toque de una notificacion, tambien con la app cerrada. Inerte en web. */
export async function initNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  // Un logout hecho sin red deja el borrado pendiente: se reintenta ahora y cada vez que vuelve la conexion.
  void flushPendingNativePushDeletion();
  window.addEventListener("online", () => void flushPendingNativePushDeletion());
  const plugin = await loadPushPlugin();
  if (plugin) await ensureListeners(plugin);
}

/** Quita el token de este dispositivo del servidor (logout / desactivar). Nunca lanza ni bloquea el cierre de sesion. */
export async function removeNativePushToken(): Promise<void> {
  const token = readToken();
  try {
    // Sin conexion el borrado falla: se deja marcado y lo reintenta flushPendingNativePushDeletion (sin sesion).
    if (token && !(await deleteTokenOnServer(token))) writePendingDeletion(token);
    const plugin = isNativeApp() ? await loadPushPlugin() : null;
    await plugin?.unregister(); // invalida el token en FCM: la siguiente cuenta recibira uno nuevo
  } catch { /* best effort */ }
  writeToken(null);
}

export const nativePushChannel: PushChannel = {
  async isSupported() {
    return isNativeApp() && !!(await loadPushPlugin());
  },

  async getPermission(): Promise<PushPermission> {
    const plugin = isNativeApp() ? await loadPushPlugin() : null;
    if (!plugin) return "default";
    const { receive } = await plugin.checkPermissions();
    if (receive === "granted") return "granted";
    return receive === "denied" ? "denied" : "default";
  },

  async isSubscribed() {
    return (await nativePushChannel.getPermission()) === "granted" && !!readToken();
  },

  async subscribe() {
    const plugin = await loadPushPlugin();
    if (!plugin) throw new PushError("unsupported");
    await ensureListeners(plugin);

    let { receive } = await plugin.checkPermissions();
    if (receive !== "granted") ({ receive } = await plugin.requestPermissions());
    if (receive !== "granted") throw new PushError("permission-denied");

    // El timeout solo corta la espera de la UI; el listener de `registration` sigue vivo (ver ensureListeners).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tokenArrived = new Promise<string>((resolve, reject) => {
      pendingToken = resolve;
      timer = setTimeout(() => reject(new PushError("failed", "Timed out waiting for the push token")), TOKEN_WAIT_MS);
    });
    try {
      await plugin.register();
      const token = await tokenArrived;
      // El listener ya lo envio al llegar; aqui se confirma para devolver el error de sesion a la UI.
      if (!(await postToken(token))) throw new PushError("session-expired");
    } finally {
      clearTimeout(timer);
      pendingToken = null;
    }
  },

  async unsubscribe() {
    await removeNativePushToken();
  },

  // Los tokens rotan: al abrir la app con el permiso ya concedido se pide uno nuevo y se re-envia al servidor.
  async refresh() {
    try {
      const plugin = await loadPushPlugin();
      if (!plugin || (await nativePushChannel.getPermission()) !== "granted") return;
      await ensureListeners(plugin);
      await plugin.register();
    } catch { /* best effort */ }
  },
};

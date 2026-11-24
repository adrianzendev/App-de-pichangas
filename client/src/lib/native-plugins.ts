// Puente con los plugins de Capacitor. Se importan de forma dinamica y con especificador literal: Vite los separa en
// chunks aparte que solo se descargan cuando se llama a `load*`, y todos los llamadores comprueban `isNativeApp()`
// antes, asi que en web nunca se piden. Si el plugin no carga (WebView sin la parte nativa) el llamador cae al
// comportamiento web.
import type { AppPlugin as CapacitorAppPlugin } from "@capacitor/app";
import type { BrowserPlugin as CapacitorBrowserPlugin } from "@capacitor/browser";
import type { PushNotificationsPlugin } from "@capacitor/push-notifications";

export type AppPlugin = CapacitorAppPlugin;
export type BrowserPlugin = CapacitorBrowserPlugin;
export type PushPlugin = PushNotificationsPlugin;

export async function loadAppPlugin(): Promise<AppPlugin | null> {
  try {
    return (await import("@capacitor/app")).App;
  } catch {
    return null;
  }
}

export async function loadBrowserPlugin(): Promise<BrowserPlugin | null> {
  try {
    return (await import("@capacitor/browser")).Browser;
  } catch {
    return null;
  }
}

export async function loadPushPlugin(): Promise<PushPlugin | null> {
  try {
    return (await import("@capacitor/push-notifications")).PushNotifications;
  } catch {
    return null;
  }
}

/**
 * Abre la URL de login de Google en un Custom Tab / SFSafariViewController (Google bloquea OAuth dentro de un
 * WebView embebido). Sin el plugin, navega en la misma ventana.
 */
export async function openExternalAuthUrl(url: string): Promise<void> {
  const browser = await loadBrowserPlugin();
  if (browser) await browser.open({ url });
  else window.location.assign(url);
}

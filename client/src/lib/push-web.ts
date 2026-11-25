import { PushError, type PushChannel, type PushPermission } from "@/lib/push-types";

// Canal Web Push (navegador / PWA): service worker + clave VAPID. Es el codigo que antes vivia en usePushNotifications.

function webPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await navigator.serviceWorker.register("/service-worker.js");
  } catch (error) {
    console.error("[Push] Service Worker registration failed:", error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

export const webPushChannel: PushChannel = {
  async isSupported() {
    return webPushSupported();
  },

  async getPermission(): Promise<PushPermission> {
    return webPushSupported() ? Notification.permission : "default";
  },

  async isSubscribed() {
    if (!webPushSupported()) return false;
    try {
      await registerServiceWorker();
      const registration = await navigator.serviceWorker.ready;
      return !!(await registration.pushManager.getSubscription());
    } catch (error) {
      console.error("[Push] Error checking subscription:", error);
      return false;
    }
  },

  async subscribe() {
    if (!webPushSupported()) throw new PushError("unsupported");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new PushError("permission-denied");

    try {
      const vapidResponse = await fetch("/api/push/vapid-public-key");
      if (!vapidResponse.ok) throw new PushError("not-configured");
      const { publicKey } = await vapidResponse.json();

      await registerServiceWorker();
      const registration = (await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Service Worker timeout")), 5000)),
      ])) as ServiceWorkerRegistration;

      let subscription: PushSubscription | undefined;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
          break;
        } catch (error: any) {
          if (error.name === "AbortError" && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          throw error;
        }
      }
      if (!subscription) throw new PushError("failed", "Failed to subscribe after retries");

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (response.status === 401) throw new PushError("session-expired");
      if (!response.ok) throw new PushError("failed", "Failed to save subscription");
    } catch (error: any) {
      if (error instanceof PushError) throw error;
      if (error.name === "NotAllowedError") throw new PushError("blocked");
      if (error.name === "AbortError") throw new PushError("aborted");
      console.error("[Push] Subscription error:", error);
      throw new PushError("failed", error?.message);
    }
  },

  async unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await subscription.unsubscribe();
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  },
};

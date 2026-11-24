import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { supabase } from "@/lib/supabase";
import { markRecovery } from "@/lib/recovery-flag";
import { initDeepLinks } from "@/lib/deep-links";
import { initNativePush } from "@/lib/push-native";
import { isNativeApp } from "@/lib/auth-redirect";
import { navigate } from "wouter/use-browser-location";

// Si Supabase no acepta el redirect_to del correo (URL fuera de la lista permitida), cae en el Site URL
// con ?code=... en cualquier ruta. Lo mandamos a /auth/callback, que completa la sesion.
if (location.pathname !== "/auth/callback" && new URLSearchParams(location.search).has("code")) {
  history.replaceState(null, "", "/auth/callback" + location.search + location.hash);
}

// El enlace de recuperacion puede llegar sin ?type=recovery (PKCE). Supabase si emite PASSWORD_RECOVERY
// durante el intercambio del code: se escucha desde el arranque para no perder el evento.
supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    markRecovery();
    if (location.pathname !== "/reset-password") location.replace("/reset-password");
  }
});

// Tras un despliegue, una pestaña abierta con el index.html viejo pide chunks con hash que ya no existen
// ("Failed to fetch dynamically imported module"). Vite avisa con `vite:preloadError`: se recarga UNA vez para
// traer el index nuevo (el service worker lo pide primero a la red). El tope de 10s evita un bucle si el fallo es real.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  try {
    const last = Number(sessionStorage.getItem("chunk-reload-at") || 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem("chunk-reload-at", String(Date.now()));
  } catch {
    return; // sin sessionStorage no hay tope contra bucles: se deja que el ErrorBoundary muestre el error
  }
  location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);

// App nativa: el retorno de Google / correos llega como deep link (inerte en web).
void initDeepLinks((to) => navigate(to, { replace: true }));
void initNativePush();

// App shell offline/rapido: el service worker se registra cuando carga la pagina (solo produccion;
// en dev Vite sirve modulos sueltos y cachearlos rompe el HMR). El push lo reutiliza (mismo scope).
// En la app nativa no se registra: el aviso va por FCM/APNs y el WebView ya carga la web (ver capacitor.config.ts).
if ("serviceWorker" in navigator && import.meta.env.PROD && !isNativeApp()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

// Configuracion de Capacitor (app nativa Android / iOS). Aun no esta instalado:
//   npm i @capacitor/core @capacitor/app @capacitor/browser @capacitor/push-notifications @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard
//   npm i -D @capacitor/cli @capacitor/assets @capacitor/android @capacitor/ios
//   npx cap add android && npx cap add ios
// Este archivo queda fuera de tsconfig (no se compila con la web); `@capacitor/cli` aporta el tipo al instalarse.
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.miltareas.app",
  appName: "Mil Tareas",
  // Salida de `vite build` (dist/ tambien contiene el servidor Express empaquetado). Con `server.url` el WebView no
  // la usa, pero Capacitor exige que exista (`npm run build`).
  webDir: "dist/public",
  server: {
    androidScheme: "https", // origen https://localhost en Android (no http)
    // Opcion A: el WebView carga la web de produccion. El origen es el de la app web: cookies de sesion,
    // /api, /uploads y el WebSocket funcionan sin CORS ni cambios. Para pruebas contra otro entorno:
    // CAP_SERVER_URL=https://staging.miltareas.com npx cap sync
    url: process.env.CAP_SERVER_URL ?? "https://app.miltareas.com",
    cleartext: false, // solo HTTPS
    errorPath: "offline.html", // client/public/offline.html, al fallar la carga sin conexion
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, launchAutoHide: true, backgroundColor: "#F5F5F5", showSpinner: false },
    // Android 15+ (targetSdk 36) es siempre edge-to-edge: el WebView se dibuja bajo la barra de estado y las opciones de
    // @capacitor/status-bar (overlaysWebView, backgroundColor) no existen ahi. Lo gestiona SystemBars (core):
    // - con viewport-fit=cover (index.html) y WebView >= 140 el WebView es edge-to-edge y la pagina reserva el espacio con
    //   env(safe-area-inset-*) (`--safe-top` en index.css); con WebView mas antiguo Capacitor lo acolcha por fuera.
    // - style LIGHT = iconos oscuros sobre fondo claro (la app no tiene modo oscuro).
    SystemBars: { insetsHandling: "css", style: "LIGHT", initialViewportFitValueHint: "cover" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
    // El WebView se redimensiona con el teclado; hooks/use-visual-viewport-height queda inerte.
    Keyboard: { resize: "native" },
  },
};

export default config;

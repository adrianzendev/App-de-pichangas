import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

/**
 * Estado de red de la app. Lee el `onlineManager` de TanStack Query, la misma fuente que pausa/reanuda
 * las consultas, asi la UI y la capa de datos nunca discrepan.
 *
 * Capacitor: al instalar `@capacitor/network`, conectar UNA vez en el arranque (main.tsx):
 *   onlineManager.setEventListener((setOnline) => {
 *     const handle = Network.addListener("networkStatusChange", (s) => setOnline(s.connected));
 *     return () => { void handle.then((h) => h.remove()); };
 *   });
 * Este hook y el banner no cambian.
 */
export function useNetworkStatus(): { isOnline: boolean } {
  const isOnline = useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
  );
  return { isOnline };
}

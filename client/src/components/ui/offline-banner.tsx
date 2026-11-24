import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";

// Aviso de red perdida: pildora fija arriba, no desplaza el layout. Solo existe en el DOM sin conexion.
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  if (isOnline) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-toast flex justify-center px-page-h pt-safe-top">
      <div
        role="status"
        aria-live="polite"
        data-testid="offline-banner"
        className="mt-2 flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-caption font-medium text-white"
      >
        <WifiOff className="size-icon-md" aria-hidden />
        Sin conexión a internet
      </div>
    </div>
  );
}

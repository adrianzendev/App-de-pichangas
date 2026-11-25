import { useEffect, useRef } from "react";
import { Smartphone } from "lucide-react";
import { ToastAction, ToastCancel } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { usePwaTrigger } from "@/hooks/use-pwa-trigger";
import { MQ } from "@/lib/breakpoints";

// Invitacion a instalar la app, con el toast global (ya no es una barra propia). Solo en movil (< md), como antes.
// Android/Chrome: "Instalar" lanza el prompt del navegador; "Ahora no" o la X lo descartan 3 dias (handleDismiss).
// iOS no tiene prompt: el toast solo explica los pasos manuales. No renderiza nada: lo dibuja <Toaster />.
export default function PwaInstallBanner() {
  const { visible, handleInstall, handleDismiss, isIos } = usePwaTrigger();
  const { toast, toasts } = useToast();
  const toastId = useRef<string | null>(null);
  const installClicked = useRef(false);

  useEffect(() => {
    if (!visible || toastId.current) return;
    if (!window.matchMedia(MQ.belowMd).matches) return;
    installClicked.current = false;
    toastId.current = toast({
      icon: Smartphone,
      title: "Instala MilTareas",
      description: isIos ? "Toca Compartir y luego «Agregar a pantalla de inicio»" : "Recibe notificaciones al instante",
      duration: Infinity,
      ...(isIos
        ? {}
        : {
            action: (
              <ToastAction
                altText="Instalar MilTareas"
                onClick={() => {
                  installClicked.current = true;
                  handleInstall();
                }}
              >
                Instalar
              </ToastAction>
            ),
            cancel: <ToastCancel>Ahora no</ToastCancel>,
          }),
    }).id;
  }, [visible]);

  // Cierre del toast (Instalar, Ahora no, X, deslizar o reemplazado por otro): solo "Instalar" no cuenta como descarte.
  useEffect(() => {
    if (!toastId.current) return;
    if (toasts.some((t) => t.id === toastId.current && t.open !== false)) return;
    toastId.current = null;
    if (!installClicked.current) handleDismiss();
  }, [toasts]);

  return null;
}

import { useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { ToastAction, ToastCancel } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface PushNotificationModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const markShown = () => localStorage.setItem("push_modal_shown", "true");

// Invitacion a activar las notificaciones push, con el toast global (ya no es un componente propio):
// se queda hasta que el usuario decide ("Activar", "Ahora no" o la X) y marca el aviso como visto.
// No renderiza nada: el toast lo dibuja <Toaster />. TOAST_LIMIT = 1: si otro toast llega antes,
// este se cierra y cuenta como visto.
export function PushNotificationModal({ userId, isOpen, onClose }: PushNotificationModalProps) {
  const { toast, toasts } = useToast();
  const { isSupported, subscribe } = usePushNotifications(userId);
  const toastId = useRef<string | null>(null);

  const activate = async () => {
    try {
      await subscribe();
      toast({
        variant: "success",
        title: "Notificaciones activadas",
        description: "Puedes cambiarlo después en tu perfil.",
        duration: 4000,
      });
    } catch (error) {
      console.error("Error activating notifications:", error);
    }
  };

  useEffect(() => {
    if (!isOpen || toastId.current) return;
    // Sin soporte del navegador no hay nada que ofrecer: no se muestra y no se vuelve a preguntar.
    if (!isSupported) {
      markShown();
      onClose();
      return;
    }
    toastId.current = toast({
      icon: Bell,
      title: "Activa las notificaciones",
      description: "Recibe avisos de mensajes y ofertas de tutores al instante.",
      duration: Infinity,
      action: (
        <ToastAction altText="Activar notificaciones" onClick={activate}>
          Activar
        </ToastAction>
      ),
      cancel: <ToastCancel>Ahora no</ToastCancel>,
    }).id;
  }, [isOpen, isSupported]);

  // Cierre (Activar, X, deslizar o reemplazado por otro toast): ya no se vuelve a preguntar.
  useEffect(() => {
    if (!toastId.current) return;
    if (toasts.some((t) => t.id === toastId.current && t.open !== false)) return;
    toastId.current = null;
    markShown();
    onClose();
  }, [toasts]);

  return null;
}

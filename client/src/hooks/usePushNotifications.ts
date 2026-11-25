import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isNativeApp } from '@/lib/auth-redirect';
import { nativePushChannel } from '@/lib/push-native';
import { webPushChannel } from '@/lib/push-web';
import { PushError, type PushChannel, type PushPermission } from '@/lib/push-types';

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: PushPermission;
  isLoading: boolean;
  /** Motivo si la comprobacion del canal fallo (plugin nativo ausente, sin Firebase...). null = sin error. */
  checkError: string | null;
}

// Canal activo: Web Push en el navegador/PWA, FCM/APNs dentro de la app nativa. La UI no distingue.
const activeChannel = (): PushChannel => (isNativeApp() ? nativePushChannel : webPushChannel);

export function usePushNotifications(userId: string | null) {
  const { toast } = useToast();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
    isLoading: true,
    checkError: null,
  });

  useEffect(() => {
    let cancelled = false;
    const channel = activeChannel();

    const checkSupport = async () => {
      // Un fallo del plugin (no registrado en el APK, Firebase sin configurar...) ya no deja la seccion oculta sin
      // explicacion: se registra en consola y queda en `checkError` para que la pantalla lo muestre.
      try {
        const isSupported = await channel.isSupported();
        const permission = isSupported ? await channel.getPermission() : 'default';
        if (cancelled) return;
        setState(prev => ({ ...prev, isSupported, permission, isLoading: false, checkError: null }));

        if (isSupported && userId) {
          // Nativo: renueva el token si ya habia permiso. Web: no define refresh.
          void channel.refresh?.();
          const isSubscribed = await channel.isSubscribed();
          if (!cancelled) setState(prev => ({ ...prev, isSubscribed }));
        }
      } catch (error) {
        console.error('[Push] Support check failed:', error);
        if (cancelled) return;
        const reason = error instanceof Error ? error.message : String(error);
        setState(prev => ({ ...prev, isSupported: false, isLoading: false, checkError: reason }));
      }
    };

    void checkSupport();
    return () => { cancelled = true; };
  }, [userId]);

  const subscribe = useCallback(async () => {
    // El interruptor se muestra siempre: ya no se bloquea aqui por `isSupported`. Si el canal no puede (plugin ausente,
    // navegador sin Push), `subscribe()` del canal lanza PushError("unsupported") y se explica con un aviso.
    if (!userId) {
      toast({
        title: "No disponible",
        description: "Inicia sesión para activar las notificaciones",
        variant: "destructive",
      });
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await activeChannel().subscribe();
      setState(prev => ({ ...prev, isSubscribed: true, permission: 'granted', isLoading: false }));
      toast({
        title: "Notificaciones activadas",
        description: "Recibirás notificaciones cuando tengas nuevos mensajes",
      });
      return true;
    } catch (error) {
      console.error('[Push] Subscribe error:', error);
      const code = error instanceof PushError ? error.code : 'failed';
      if (code === 'permission-denied') {
        setState(prev => ({ ...prev, permission: 'denied', isLoading: false }));
        toast({
          title: "Permiso denegado",
          description: "Necesitas permitir las notificaciones para recibirlas",
          variant: "destructive",
        });
        return false;
      }

      const messages: Record<string, string> = {
        'unsupported': "Las notificaciones push no están disponibles en este dispositivo",
        'not-configured': "El servidor aún no tiene configuradas las notificaciones push",
        'session-expired': "Sesión expirada. Por favor, cierra sesión e inicia de nuevo",
        'blocked': "Las notificaciones fueron bloqueadas. Revisa los permisos del dispositivo",
        'aborted': "El proceso fue cancelado. Intenta de nuevo",
      };
      toast({
        title: "Error",
        description: messages[code] ?? "No se pudieron activar las notificaciones",
        variant: "destructive",
      });
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [userId, toast]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return false;
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await activeChannel().unsubscribe();
      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
      toast({
        title: "Notificaciones desactivadas",
        description: "Ya no recibirás notificaciones push",
      });
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
      toast({
        title: "Error",
        description: "No se pudieron desactivar las notificaciones",
        variant: "destructive",
      });
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [userId, toast]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

import { useEffect, useState } from 'react';
import { AUTH_ROUTES, ROUTES } from "@/lib/routes";
import { completeAuthFromUrl } from '@/lib/auth-session';
import { clearAuthIntent, readAuthIntent } from '@/lib/auth-intent';
import { useLocation, useSearch } from 'wouter';
import { Loader2, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isRecoveryPending } from '@/lib/recovery-flag';
import { queryClient } from '@/lib/queryClient';
import { AuthShell } from '@/components/auth/auth-shell';
import { useToast } from '@/hooks/use-toast';

type ServerLogin = { ok: boolean; userType?: string; message?: string; isNewUser?: boolean; code?: string; user?: unknown };

// `intent`: pestaña activa en /login al pulsar Google. Con 'tutor' el servidor no crea cuenta si no hay perfil de tutor.
async function loginWithServer(accessToken: string, intent: 'student' | 'tutor' = 'student'): Promise<ServerLogin> {
  try {
    const response = await fetch('/api/auth/social-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ intent }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { ok: false, message: (data as any).message || 'Error al iniciar sesión.', code: (data as any).code };
    }
    const data = await response.json().catch(() => ({}));
    return { ok: true, userType: data?.user?.userType, isNewUser: data?.isNewUser, user: data?.user };
  } catch {
    return { ok: false, message: 'Error de conexión con el servidor.' };
  }
}

function destinationFor(userType?: string) {
  if (userType === 'admin' || userType === 'agent') return ROUTES.dashboard;
  if (userType === 'tutor') return ROUTES.root;
  return ROUTES.home;
}

export default function AuthCallback() {
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [, setLocation] = useLocation();
  const search = useSearch(); // un segundo deep link con la pantalla ya abierta cambia la query: se vuelve a procesar
  const { toast } = useToast();

  // Entrada a la app sin recarga completa: una recarga tras `queryClient.clear()` rehidrata un snapshot viejo de
  // IndexedDB y rebota a /login (ver CLAUDE.md, mismo bug que login.tsx).
  const enterApp = (result: ServerLogin) => {
    queryClient.clear();
    if (result.user) queryClient.setQueryData(["/api/user/current"], result.user);
    setLocation(destinationFor(result.userType));
  };

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let unsubscribe: (() => void) | null = null;

    // Se lee antes de cualquier await (StrictMode corre el efecto dos veces) y se borra al terminar.
    const intent = readAuthIntent();

    // Resultado del login con Google. Tutor sin postulacion/activacion: sin sesion, aviso y a la postulacion.
    async function finishOAuth(result: ServerLogin, onError: () => void) {
      clearAuthIntent();
      if (result.code === 'TUTOR_NOT_ACTIVE') {
        await supabase.auth.signOut();
        toast({ title: 'Cuenta de tutor no activa', description: result.message, variant: 'destructive' });
        setLocation('/register?role=tutor');
        return;
      }
      if (!result.ok) {
        setError(result.message || 'Error al iniciar sesión.');
        onError();
        return;
      }
      if (result.isNewUser) sessionStorage.setItem('fb_new_user', '1');
      enterApp(result);
    }

    async function handleCallback() {
      try {
        // Intercambia el ?code PKCE si hace falta (deep link nativo) y lee la sesion; ver lib/auth-session.ts.
        const auth = await completeAuthFromUrl();

        // Handle OAuth provider errors (e.g. user cancelled)
        if (auth.error) {
          setError('Autenticación cancelada o denegada.');
          timeoutId = setTimeout(() => setLocation(ROUTES.login), 3000);
          return;
        }

        const type = auth.type;

        // Codigo vencido, ya usado o iniciado en otro navegador: no hay nada que esperar.
        if (auth.exchangeFailed) {
          setError(type === 'recovery' || isRecoveryPending()
            ? 'El enlace de recuperación no es válido o ha expirado.'
            : 'No se pudo completar la autenticación. Intenta de nuevo.');
          timeoutId = setTimeout(() => setLocation(ROUTES.login), 3000);
          return;
        }

        // ── Email verification (signup confirmation link) ──────────────────
        if (type === 'signup') {
          await new Promise(r => setTimeout(r, 600));
          const { data: { session } } = await supabase.auth.getSession();
          const result = session?.access_token ? await loginWithServer(session.access_token) : null;
          if (!result?.ok) {
            setError('Correo verificado, pero no pudimos iniciar tu sesión. Si abriste el enlace en otro navegador, inicia sesión aquí.');
            timeoutId = setTimeout(() => setLocation(ROUTES.login), 4000);
            return;
          }
          setVerified(true);
          timeoutId = setTimeout(() => enterApp(result), 2500);
          return;
        }

        // ── Password recovery ──────────────────────────────────────────────
        // Supabase v2 PKCE: the recovery link arrives as ?code=...&type=recovery
        // detectSessionInUrl:true auto-exchanges the code and fires PASSWORD_RECOVERY.
        // We wait for either an existing session or the auto-exchange event,
        // then redirect to /reset-password (no hash needed — session is in localStorage).
        if (type === 'recovery' || isRecoveryPending()) {
          // Case A: session already exchanged before this effect ran
          const { data: { session: existing } } = await supabase.auth.getSession();
          if (existing) {
            setLocation(AUTH_ROUTES.resetPassword);
            return;
          }

          // Case B: wait for auto-exchange via onAuthStateChange
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
              clearTimeout(timeoutId);
              unsubscribe?.();
              setLocation(AUTH_ROUTES.resetPassword);
            }
          });
          unsubscribe = () => subscription.unsubscribe();

          timeoutId = setTimeout(() => {
            unsubscribe?.();
            setError('El enlace de recuperación no es válido o ha expirado.');
            setTimeout(() => setLocation(ROUTES.login), 3000);
          }, 12000);
          return;
        }

        // ── OAuth (Google) ─────────────────────────────────────────────────
        // Supabase JS v2 with detectSessionInUrl:true auto-exchanges the PKCE
        // ?code= on init. We must NOT call exchangeCodeForSession manually.

        // Case A: Supabase already exchanged the code before this effect ran
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession?.access_token) {
          const result = await loginWithServer(existingSession.access_token, intent);
          await finishOAuth(result, () => { timeoutId = setTimeout(() => setLocation(ROUTES.login), 3000); });
          return;
        }

        // Case B: Wait for Supabase to finish exchanging (async auto-exchange)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.access_token) {
            clearTimeout(timeoutId);
            unsubscribe?.();
            const result = await loginWithServer(session.access_token, intent);
            await finishOAuth(result, () => { setTimeout(() => setLocation(ROUTES.login), 3000); });
          }
        });
        unsubscribe = () => subscription.unsubscribe();

        // Timeout: if nothing happens in 12s, give up
        timeoutId = setTimeout(() => {
          unsubscribe?.();
          setError('No se pudo completar la autenticación. Intenta de nuevo.');
          setTimeout(() => setLocation(ROUTES.login), 3000);
        }, 12000);

      } catch (err) {
        console.error('[auth-callback] Unexpected error:', err);
        setError('Error inesperado. Redirigiendo…');
        timeoutId = setTimeout(() => setLocation(ROUTES.login), 3000);
      }
    }

    handleCallback();

    return () => {
      clearTimeout(timeoutId);
      unsubscribe?.();
    };
  }, [search]);

  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        {error ? (
          <>
            <h1 className="text-heading font-bold text-gray-900">No pudimos continuar</h1>
            <p className="text-body text-gray-700">{error}</p>
            <p className="text-caption text-gray-700">Redirigiendo al login…</p>
          </>
        ) : verified ? (
          <>
            <div className="size-avatar-lg bg-primary-100 rounded-full flex items-center justify-center">
              <MailCheck className="size-icon-xl text-primary-600" />
            </div>
            <h1 className="text-heading font-bold text-gray-900">¡Email verificado!</h1>
            <p className="text-body text-gray-700">Tu cuenta está confirmada. Redirigiendo…</p>
          </>
        ) : (
          <>
            <Loader2 className="size-icon-xl animate-spin text-primary-600" />
            <h1 className="text-heading font-bold text-gray-900">Completando autenticación…</h1>
          </>
        )}
      </div>
    </AuthShell>
  );
}

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage, OutlinedFormControl } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { clearRecovery } from '@/lib/recovery-flag';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthNotice } from '@/components/auth/auth-notice';
import { PasswordInput } from '@/components/ui/password-input';

const resetSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type ResetForm = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const { toast } = useToast();
  const [isReady, setIsReady] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [done, setDone] = useState(false);

  const form = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    async function init() {
      // Case A: session already present (Supabase auto-exchanged PKCE code in auth-callback)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        setIsReady(true);
        return;
      }

      // Case B: listen for PASSWORD_RECOVERY / SIGNED_IN events
      // (fires when Supabase completes the PKCE exchange, or for legacy hash-based tokens)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && s?.user?.email) {
          setUserEmail(s.user.email);
          setIsReady(true);
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    }

    init();

    return () => { unsubscribe?.(); };
  }, []);

  const onSubmit = async (data: ResetForm) => {
    try {
      // Get current access token BEFORE updating password (it may be invalidated after)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;

      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw new Error(error.message);

      // Sync new password to our own DB — backend verifies the Supabase token
      if (accessToken) {
        const syncResp = await fetch('/api/auth/reset-password-confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ newPassword: data.password }),
        });
        if (!syncResp.ok) {
          const syncErr = await syncResp.json().catch(() => ({})) as { message?: string };
          throw new Error(syncErr.message || 'No se pudo sincronizar la contraseña.');
        }
      }

      clearRecovery();
      setDone(true);
      toast({ title: 'Contraseña actualizada', description: 'Ya puedes iniciar sesión con tu nueva contraseña.' });
      setTimeout(() => { window.location.href = '/login'; }, 2500);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo actualizar la contraseña.', variant: 'destructive' });
    }
  };

  return (
    <AuthShell>
          <AuthHeader title="Nueva contraseña" subtitle="Elige una contraseña segura para tu cuenta" />

          {done ? (
            <AuthNotice title="¡Contraseña actualizada!">Redirigiendo al inicio de sesión…</AuthNotice>
          ) : !isReady ? (
            <div className="flex flex-col items-center gap-6 text-center">
              <Loader2 className="size-icon-badge animate-spin text-green-600" />
              <div className="flex flex-col gap-1">
                <p className="text-body text-gray-700">Verificando enlace de recuperación…</p>
                <p className="text-caption text-gray-700">Si este mensaje persiste, el enlace puede haber expirado.</p>
              </div>
              <Button
                type="button"
                variant="link"
                onClick={() => { window.location.href = '/login'; }}
                size="touch"
              >
                Volver al inicio de sesión
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
                {userEmail && (
                  <p className="text-caption text-gray-700">
                    Cambiando contraseña para <span className="font-medium text-gray-900">{userEmail}</span>
                  </p>
                )}

                <div className="flex flex-col gap-field-gap">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <OutlinedFormControl label="Nueva contraseña">
                        <FormControl>
                          <PasswordInput
                            {...field}
                           
                            autoComplete="new-password"
                          />
                        </FormControl>
                      </OutlinedFormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <OutlinedFormControl label="Confirmar contraseña">
                        <FormControl>
                          <PasswordInput
                            {...field}
                           
                            autoComplete="new-password"
                          />
                        </FormControl>
                      </OutlinedFormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>

                <Button size="lg"
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full"
                >
                  {form.formState.isSubmitting ? (
                    <><Loader2 className="size-icon-lg animate-spin mr-2" />Guardando…</>
                  ) : 'Guardar nueva contraseña'}
                </Button>
              </form>
            </Form>
          )}
    </AuthShell>
  );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage, OutlinedFormControl } from '@/components/ui/form';
import { PasswordInput } from '@/components/ui/password-input';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthNotice } from '@/components/auth/auth-notice';
import { AuthAlert } from '@/components/auth/auth-alert';
import { ROUTES, AUTH_ROUTES } from '@/lib/routes';

const schema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type ActivateForm = z.infer<typeof schema>;

// /activate-account?token=...: el enlace de un solo uso que llega por correo (cuenta creada por el administrador, o
// "definir / restablecer contraseña"). Fija la contrasena propia de la persona; ya no existe una clave por defecto.
export default function ActivateAccount() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState('');

  const form = useForm<ActivateForm>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ActivateForm) => {
    setServerError('');
    try {
      const response = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setServerError(result.message || 'No se pudo restablecer la contraseña. Intenta de nuevo.');
        return;
      }
      setEmail(result.email ?? '');
      setDone(true);
    } catch {
      setServerError('Error de conexión con el servidor. Intenta de nuevo.');
    }
  };

  return (
    <AuthShell>
      <AuthHeader title="Restablece tu contraseña" subtitle="Elige la contraseña con la que entrarás a MilTareas" />

      {done ? (
        <AuthNotice
          icon={CheckCircle}
          title="¡Contraseña restablecida!"
          actions={
            <Button size="lg" className="w-full" onClick={() => setLocation(email ? `${ROUTES.login}?email=${encodeURIComponent(email)}` : ROUTES.login)} data-testid="button-go-login">
              Ir a iniciar sesión
            </Button>
          }
        >
          Ya puedes iniciar sesión con tu correo y tu nueva contraseña.
        </AuthNotice>
      ) : !/^[a-f0-9]{64}$/.test(token) ? (
        <AuthNotice
          title="El enlace no es válido"
          actions={
            <Button size="lg" className="w-full" onClick={() => setLocation(AUTH_ROUTES.forgotPassword)}>
              Solicitar un enlace nuevo
            </Button>
          }
        >
          Puede estar incompleto o haber vencido. Solicita uno nuevo.
        </AuthNotice>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            {serverError && (
              <AuthAlert data-testid="text-activate-error">{serverError}</AuthAlert>
            )}

            <div className="flex flex-col gap-field-gap">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <OutlinedFormControl label="Nueva contraseña">
                    <FormControl>
                      <PasswordInput {...field} autoComplete="new-password" data-testid="input-password" />
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
                      <PasswordInput {...field} autoComplete="new-password" data-testid="input-confirm-password" />
                    </FormControl>
                  </OutlinedFormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>

            <Button size="lg" type="submit" disabled={form.formState.isSubmitting} className="w-full" data-testid="button-activate">
              {form.formState.isSubmitting ? (
                <><Loader2 className="size-icon-lg animate-spin mr-2" />Guardando…</>
              ) : 'Guardar contraseña'}
            </Button>
          </form>
        </Form>
      )}
    </AuthShell>
  );
}

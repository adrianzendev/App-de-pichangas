import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage, OutlinedFormControl } from '@/components/ui/form';
import { queryClient } from '@/lib/queryClient';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthAlert } from '@/components/auth/auth-alert';
import { AuthDivider, GoogleAuthButton } from '@/components/auth/google-auth-button';
import { LegalLinks } from '@/components/auth/legal-links';
import { DevQuickLogin } from '@/components/auth/dev-quick-login';
import { RoleTabs, type AuthRole } from '@/components/auth/role-tabs';
import { PasswordInput } from '@/components/ui/password-input';

const loginSchema = z.object({
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});

type LoginForm = z.infer<typeof loginSchema>;

// Cuentas propias de prueba (alumno, tutor, admin): primer grupo del acceso rapido, solo en desarrollo. El nombre sale de /api/users.
const MY_ACCOUNT_EMAILS = ["carlosadrianchoquehuanca@gmail.com", "adrianchoquehuancahuaraya@gmail.com", "admin@miltareas.com"];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  // Solo cambia el texto: la cuenta (alumno o tutor) la define el servidor al ingresar.
  const [role, setRole] = useState<AuthRole>('student');

  interface User {
    id: string;
    email: string;
    name: string;
    userType: 'student' | 'tutor' | 'admin' | 'agent';
  }

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 1000 * 60 * 5,
    enabled: import.meta.env.DEV
  });

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: new URLSearchParams(window.location.search).get('email') ?? '', password: '' }
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginForm) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error de autenticación');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Client-side nav, not a hard reload: a reload would let
      // PersistQueryClientProvider restore the pre-login "not logged in"
      // snapshot from IndexedDB (throttled persist write can lose the
      // clear() below to the race), which home.tsx/admin-dashboard.tsx
      // read as a real logout and bounce straight back to /login.
      queryClient.clear();
      queryClient.setQueryData(["/api/user/current"], data.user);
      if (data?.user?.userType === 'agent') {
        setLocation('/dashboard');
      } else {
        setLocation('/');
      }
    },
    onError: (error: Error) => {
      setError(error.message);
    }
  });

  const onSubmit = (data: LoginForm) => {
    setError('');
    loginMutation.mutate(data);
  };

  const handleTestLogin = async (testEmail: string) => {
    setError('');
    try {
      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: testEmail })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error de autenticación');
      }
      const data = await response.json();
      queryClient.clear();
      queryClient.setQueryData(["/api/user/current"], data.user);
      setLocation('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error de autenticación');
    }
  };

  // Cuentas de prueba ancladas primero en cada grupo (orden = prioridad).
  const PINNED = [/^admin\b/i, /carlos adri[aá]n choquehuanca/i, /adri[aá]n choquehuanca/i];
  const pinRank = (u: User) => {
    const i = PINNED.findIndex((re) => re.test(u.name || ''));
    return i === -1 ? PINNED.length : i;
  };
  const byPin = (list: User[]) => [...list].sort((a, b) => pinRank(a) - pinRank(b));

  const students = byPin(users.filter((u: User) => u.userType === 'student'));
  const tutors = byPin(users.filter((u: User) => u.userType === 'tutor'));
  const admin = byPin(users.filter((u: User) => u.userType === 'admin'));

  return (
    <AuthShell>
          <AuthHeader
            title="Iniciar sesión"
            subtitle={role === 'tutor'
              ? 'Encuentra pedidos y gana ayudando a otros alumnos.'
              : 'Publica tu pedido y recibe ofertas de tutores.'}
          />

          <RoleTabs value={role} onChange={setRole} />

          <GoogleAuthButton role={role} />

          <AuthDivider />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} onChange={() => error && setError('')} className="flex flex-col gap-6">
              {/* Sin etiqueta visible (placeholder); el label sr-only conserva el nombre accesible. text-base = 16px: iOS no hace zoom al enfocar. */}
              <div className="flex flex-col gap-field-gap">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <OutlinedFormControl label="Correo electrónico">
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="correo@ejemplo.com"
                            autoComplete="email"
                            data-testid="input-email"
                          />
                        </FormControl>
                      </OutlinedFormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <OutlinedFormControl label="Contraseña">
                        <FormControl>
                          <PasswordInput
                            {...field}
                            autoComplete="current-password"
                            data-testid="input-password"
                            toggleTestId="button-toggle-password"
                          />
                        </FormControl>
                      </OutlinedFormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="text-right">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setLocation('/forgot-password')}
                  size="touch"
                >
                  ¿Olvidaste tu contraseña?
                </Button>
              </div>

              {error && (
                <AuthAlert>{error}</AuthAlert>
              )}

              <Button
                type="submit"
                disabled={loginMutation.isPending}
                size="lg"
                className="w-full"
                data-testid="button-submit"
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="size-icon-lg animate-spin mr-2" />Iniciando sesión…</>
                ) : 'Iniciar sesión'}
              </Button>
            </form>
          </Form>

          <div className="mt-auto space-y-3 pt-2 text-center">
            <p className="text-body text-gray-700">¿No tienes cuenta?</p>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => setLocation("/register")}
              data-testid="link-register"
            >
              Crear cuenta
            </Button>
          </div>
          <LegalLinks />

          {/* Quick Access Users - Only visible in development mode */}
          {import.meta.env.DEV && (
            <DevQuickLogin
              groups={[
                { title: "Mis cuentas", users: MY_ACCOUNT_EMAILS.map((email) => users.find((u) => u.email === email) ?? { id: email, email }) },
                { title: "Estudiantes", users: students },
                { title: "Profesores", users: tutors },
                { title: "Administración", users: admin, variant: "default" },
              ]}
              onLogin={handleTestLogin}
              disabled={loginMutation.isPending}
            />
          )}
    </AuthShell>
  );
}

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { queryClient } from '@/lib/queryClient';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthAlert } from '@/components/auth/auth-alert';
import { AuthDivider, GoogleAuthButton } from '@/components/auth/google-auth-button';
import { LegalLinks } from '@/components/auth/legal-links';
import { PitchButton } from '@/components/pichangas/night-ui';

const loginSchema = z.object({
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');

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

  // Jugadores falsos del seed de desarrollo (server/mock-pichangas.ts): entrada rapida sin contrasena.
  const players = users.filter((u: User) => u.email.endsWith('@pichangas.test'));
  const admin = byPin(users.filter((u: User) => u.userType === 'admin'));

  const [showPassword, setShowPassword] = useState(false);
  const { register, formState: { errors } } = form;
  const field = "h-12 w-full rounded-sm bg-night-lowest px-4 text-base text-night-text placeholder:text-night-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-crimson";
  const label = "text-caption font-bold uppercase text-night-muted";
  const quick = "h-10 truncate rounded-control bg-night-high px-3 text-caption font-bold text-night-text transition-colors duration-fast hover:bg-night-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch disabled:opacity-50";

  return (
    <AuthShell night>
      <AuthHeader night title="Iniciar sesión" subtitle="Entra para anotarte a los partidos de tu zona." />

      <GoogleAuthButton night />

      <AuthDivider night />

      <form onSubmit={form.handleSubmit(onSubmit)} onChange={() => error && setError('')} className="flex flex-col gap-5">
        <div className="space-y-1">
          <label htmlFor="login-email" className={label}>Correo electrónico</label>
          <input id="login-email" type="email" placeholder="correo@ejemplo.com" autoComplete="email" data-testid="input-email" aria-invalid={!!errors.email} className={field} {...register('email')} />
          {errors.email && <p className="text-caption font-bold text-crimson">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="login-password" className={label}>Contraseña</label>
          <div className="relative">
            <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" data-testid="input-password" aria-invalid={!!errors.password} className={`${field} pr-12`} {...register('password')} />
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              data-testid="button-toggle-password"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-night-muted hover:text-night-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch"
            >
              {showPassword ? <EyeOff className="size-icon-md" aria-hidden /> : <Eye className="size-icon-md" aria-hidden />}
            </button>
          </div>
          {errors.password && <p className="text-caption font-bold text-crimson">{errors.password.message}</p>}
        </div>

        <button
          type="button"
          onClick={() => setLocation('/forgot-password')}
          className="self-end rounded-sm text-label font-bold text-pitch hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch"
        >
          ¿Olvidaste tu contraseña?
        </button>

        {error && <AuthAlert className="bg-crimson-container text-crimson">{error}</AuthAlert>}

        <PitchButton type="submit" disabled={loginMutation.isPending} className="w-full" data-testid="button-submit">
          {loginMutation.isPending ? (<><Loader2 className="size-icon-lg animate-spin" />Iniciando sesión…</>) : 'Iniciar sesión'}
        </PitchButton>
      </form>

      <div className="mt-auto space-y-3 pt-2 text-center">
        <p className="text-body text-night-muted">¿No tienes cuenta?</p>
        <button
          type="button"
          onClick={() => setLocation('/register')}
          data-testid="link-register"
          className="flex h-12 w-full items-center justify-center rounded-control bg-night-high text-body font-bold text-night-text transition-colors duration-fast hover:bg-night-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch"
        >
          Crear cuenta
        </button>
      </div>
      <LegalLinks night />

      {/* Acceso rapido: solo en desarrollo. */}
      {import.meta.env.DEV && (
        <div className="space-y-3">
          {[{ title: 'Jugadores de prueba', users: players }, { title: 'Administración', users: admin }].filter((g) => g.users.length > 0).map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-caption font-bold uppercase text-night-muted">{g.title}</p>
              <div className="grid grid-cols-2 gap-2">
                {g.users.map((u) => (
                  <button key={u.id} type="button" className={quick} disabled={loginMutation.isPending} title={u.email} onClick={() => handleTestLogin(u.email)} data-testid={`quick-login-${u.id}`}>
                    {u.name || u.email.split('@')[0]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AuthShell>
  );
}

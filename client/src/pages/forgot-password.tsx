import { OutlinedControl } from "@/components/ui/outlined-field";
import { useState } from 'react';
import { Loader2, MailCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthNotice } from '@/components/auth/auth-notice';

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      // Enlace de un solo uso por correo (Resend): funciona para toda cuenta, incluidas las creadas por el administrador.
      // La respuesta es la misma exista o no el correo; solo el limite de intentos (429) se distingue.
      const response = await fetch('/api/auth/request-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (response.status === 429) throw new Error('Demasiados intentos. Intenta de nuevo en unos minutos.');
      if (!response.ok) throw new Error('No se pudo enviar el correo. Intenta de nuevo.');
      setSent(true);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo enviar el correo. Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
          <AuthHeader title="Restablecer contraseña" subtitle="Te enviaremos un enlace de un solo uso para elegir tu contraseña" />

          {sent ? (
            <AuthNotice
              icon={MailCheck}
              title="Revisa tu correo"
              hint={<>
                <p className="font-medium">¿No lo encuentras?</p>
                <p>Revisa tu carpeta de spam. Puede tardar unos minutos.</p>
              </>}
              actions={
                <Button
                  type="button"
                  variant="link"
                  onClick={() => { window.location.href = '/login'; }}
                  size="touch"
                >
                  Volver al inicio de sesión
                </Button>
              }
            >
              Si <span className="font-medium text-gray-900">{email}</span> está registrado, te enviamos un enlace que
              sirve una sola vez y vence en 24 horas.
            </AuthNotice>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <OutlinedControl htmlFor="forgot-email" label="Correo electrónico">
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </OutlinedControl>

              <Button size="lg"
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full"
              >
                {loading ? (
                  <><Loader2 className="size-icon-lg animate-spin mr-2" />Enviando…</>
                ) : 'Enviar enlace'}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { window.location.href = '/login'; }}
                  size="touch"
                >
                  <ArrowLeft />
                  Volver al inicio de sesión
                </Button>
              </div>
            </form>
          )}
    </AuthShell>
  );
}

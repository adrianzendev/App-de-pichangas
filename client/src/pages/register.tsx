import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage, OutlinedFormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { queuePwaBannerForNextLoad } from "@/hooks/use-pwa-trigger";
import { useLocation } from "wouter";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authRedirectUrl } from "@/lib/auth-redirect";
import { AUTH_ROUTES } from "@/lib/routes";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthNotice } from "@/components/auth/auth-notice";
import { AuthDivider, GoogleAuthButton } from "@/components/auth/google-auth-button";
import { LegalLinks } from "@/components/auth/legal-links";
import { RoleTabs, type AuthRole } from "@/components/auth/role-tabs";
import { trackEvent } from "@/lib/pixel";
import { PasswordInput } from "@/components/ui/password-input";

// Los tutores no crean cuenta aqui: postulan en este formulario y el admin les crea la cuenta.
const TUTOR_APPLICATION_FORM_URL = "https://forms.gle/MafT2hYkS6QkUtS17";

const registerSchema = z.object({
  email: z.string().email("Ingresa un email válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [userType, setUserType] = useState<AuthRole>(
    // /register?role=tutor: el login con Google en la pestaña tutor manda aqui cuando no hay postulacion.
    new URLSearchParams(window.location.search).get("role") === "tutor" ? "tutor" : "student",
  );
  const { toast } = useToast();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
    }
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      const finalData = { ...data, university: "" };
      // fetch (not apiRequest): apiRequest throws on non-2xx, which made the
      // duplicate-email / server-error branches below unreachable.
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(finalData),
      });
      const result = await response.json();

      if (response.ok) {
        // Trigger Supabase email verification and check if confirmation is required
        let requiresConfirmation = false;
        try {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: { emailRedirectTo: authRedirectUrl(AUTH_ROUTES.callback) }
          });
          // If session is null and no error, Supabase requires email confirmation
          if (!signUpError && !signUpData.session) {
            requiresConfirmation = true;
          } else if (signUpError) {
            console.error("[register] supabase.signUp falló:", signUpError);
            toast({
              title: "No se pudo enviar el correo de verificación",
              description: signUpError.message,
              variant: "destructive"
            });
          }
        } catch {
          // Supabase signUp failure is non-blocking — app already registered the user
        }

        trackEvent('CompleteRegistration', { userType: 'student' });
        if (requiresConfirmation) {
          setRegisteredEmail(data.email);
          setEmailSent(true);
        } else {
          toast({ title: "Registro exitoso", description: "Bienvenido a MilTareas" });
          queuePwaBannerForNextLoad();
          // Client-side nav, not a hard reload: a reload would let
          // PersistQueryClientProvider restore a stale pre-registration
          // snapshot from IndexedDB (throttled persist write can lose the
          // clear() below to the race) — same bug as the documented
          // /login bounce, see CLAUDE.md.
          queryClient.clear();
          queryClient.setQueryData(["/api/user/current"], result.user);
          setLocation('/');
        }
      } else {
        if (result.message === "Este email ya está registrado") {
          setDuplicateEmail(true);
        } else {
          toast({
            title: "Error en el registro",
            description: result.message || "No se pudo crear la cuenta",
            variant: "destructive"
          });
        }
      }
    } catch {
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar al servidor",
        variant: "destructive"
      });
    }
  };

  // Email verification sent — show informational panel (soft block, phase 1)
  if (emailSent) {
    return (
      <AuthShell>
          <AuthNotice
            icon={MailCheck}
            title="Revisa tu correo"
            pageTitle
            hint={<>
              <p className="font-medium">¿No recibiste el correo?</p>
              <p>Revisa tu carpeta de spam. Puede tardar unos minutos.</p>
            </>}
            actions={<>
              <Button
                size="lg"
                onClick={() => {
                  // No hard reload — see comment in onSubmit above.
                  queryClient.clear();
                  setLocation('/');
                }}
                className="w-full"
              >
                Continuar a la app
              </Button>
              <p className="text-caption text-gray-700">
                Puedes verificar tu cuenta más tarde desde tu perfil.
              </p>
            </>}
          >
            Te enviamos un enlace de confirmación a{' '}
            <span className="font-medium text-gray-900">{registeredEmail}</span>.
            Haz clic en el enlace para verificar tu cuenta.
          </AuthNotice>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
          <AuthHeader
            title="Crear cuenta"
            subtitle={userType === "tutor"
              ? "Encuentra pedidos y gana ayudando a otros alumnos."
              : "Publica tu pedido y recibe ofertas de tutores."}
          />

          <RoleTabs value={userType} onChange={setUserType} />

          {userType === "tutor" ? (
            <div className="flex flex-col gap-3">
              <p className="text-body text-gray-700">
                El ingreso de tutores requiere evaluación previa. Completa el formulario y te notificaremos cuando tu cuenta sea activada.
              </p>
              <Button asChild size="lg" className="w-full" data-testid="button-tutor-form">
                <a href={TUTOR_APPLICATION_FORM_URL} target="_blank" rel="noopener noreferrer">
                  Postular como tutor
                </a>
              </Button>
            </div>
          ) : (
          <>
          <GoogleAuthButton />

          <AuthDivider />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              {/* Sin etiqueta visible (placeholder); el label sr-only conserva el nombre accesible. */}
              <div className="flex flex-col gap-field-gap">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <OutlinedFormControl label="Correo electrónico">
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="correo@ejemplo.com"
                            autoComplete="email"
                            {...field}
                            onChange={(e) => { field.onChange(e); setDuplicateEmail(false); }}
                            data-testid="input-email"
                          />
                        </FormControl>
                      </OutlinedFormControl>
                      <FormMessage />
                      {duplicateEmail && (
                        <p className="mt-1 text-caption text-error-fg">
                          Este correo ya está registrado.{" "}
                          <button type="button" onClick={() => setLocation("/login")} className="font-medium underline hover:opacity-80">
                            Inicia sesión
                          </button>
                        </p>
                      )}
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
                            placeholder="Mínimo 6 caracteres"
                            autoComplete="new-password"
                            {...field}
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

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={form.formState.isSubmitting}
                data-testid="button-submit"
              >
                {form.formState.isSubmitting ? (
                  <><Loader2 className="size-icon-lg animate-spin mr-2" />Creando cuenta…</>
                ) : 'Crear cuenta'}
              </Button>
            </form>
          </Form>
          </>
          )}

          <div className="mt-auto space-y-3 pt-2 text-center">
            <p className="text-body text-gray-700">¿Ya tienes cuenta?</p>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => setLocation("/login")}
              data-testid="link-login"
            >
              Inicia sesión
            </Button>
          </div>
          <LegalLinks />
    </AuthShell>
  );
}

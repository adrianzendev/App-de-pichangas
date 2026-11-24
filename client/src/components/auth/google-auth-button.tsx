import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { authRedirectUrl, isNativeApp } from "@/lib/auth-redirect";
import { setAuthIntent } from "@/lib/auth-intent";
import { openExternalAuthUrl } from "@/lib/native-plugins";
import { AUTH_ROUTES } from "@/lib/routes";
import type { AuthRole } from "@/components/auth/role-tabs";

const GOOGLE_AUTH_TIMEOUT_MS = 8000;

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// Separador "o" entre Google (arriba) y el formulario de correo; lo usan login y registro.
export function AuthDivider({ night }: { night?: boolean }) {
  const line = night ? "bg-night-highest" : "bg-gray-200";
  return (
    <div className={night ? "flex items-center gap-3 text-caption text-night-muted" : "flex items-center gap-3 text-caption text-gray-700"} role="separator" aria-label="o">
      <span className={`h-px flex-1 ${line}`} />
      o
      <span className={`h-px flex-1 ${line}`} />
    </div>
  );
}

// Pestaña activa al pulsar Google: el callback la lee tras volver de OAuth (la URL de retorno no admite parametros extra).
export function GoogleAuthButton({ role = "student", night }: { role?: AuthRole; night?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      setAuthIntent(role);
      const native = isNativeApp();
      const start = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          // En nativo no se redirige el WebView: la URL de Google se abre en un Custom Tab (openExternalAuthUrl).
          options: { redirectTo: authRedirectUrl(AUTH_ROUTES.callback), skipBrowserRedirect: native },
        });
        if (error) throw error;
        if (native && data.url) await openExternalAuthUrl(data.url);
      };
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Tiempo de espera agotado al conectar con Google")), GOOGLE_AUTH_TIMEOUT_MS);
      });
      await Promise.race([start(), timeout]);
    } catch (err) {
      console.error("[GoogleAuthButton] Error al iniciar sesion con Google:", err);
      toast({
        title: "No se pudo conectar con Google",
        description: err instanceof Error ? err.message : "Intenta de nuevo en unos segundos",
        variant: "destructive",
      });
    } finally {
      clearTimeout(timer);
      setLoading(false); // en nativo el usuario sigue en el Custom Tab; si lo cierra sin terminar, el boton no debe quedar girando
    }
  };

  if (night) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-control bg-night-high text-label font-bold text-night-text transition-colors duration-fast hover:bg-night-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-icon-md animate-spin" /> : <GoogleIcon />}
        Continuar con Google
      </button>
    );
  }

  return (
    <Button type="button" variant="outline" size="lg" onClick={handleClick} disabled={loading} className="w-full text-gray-700">
      {loading ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
      Continuar con Google
    </Button>
  );
}

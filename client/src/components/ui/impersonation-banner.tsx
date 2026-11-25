import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { stopImpersonation } from "@/lib/impersonation";

// Aviso fijo arriba mientras el super admin ve la cuenta de otro usuario. Solo existe en el DOM al impersonar.
export function ImpersonationBanner() {
  const { data: user } = useQuery<{ name?: string; impersonating?: boolean; impersonationExpiresAt?: number }>({ queryKey: ["/api/user/current"] });
  const { toast } = useToast();
  const [leaving, setLeaving] = useState(false);

  // El servidor deja de servir la cuenta al vencer; esto limpia el estado local y vuelve al panel. Delay 0 si ya vencio al abrir.
  const expiresAt = user?.impersonating ? user.impersonationExpiresAt : undefined;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(() => {
      stopImpersonation().catch((e) => console.error("[Impersonation] expiry error:", e));
    }, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt]);

  if (!user?.impersonating) return null;

  const leave = async () => {
    setLeaving(true);
    try {
      await stopImpersonation();
    } catch (e) {
      setLeaving(false);
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "No se pudo salir" });
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-toast flex justify-center px-page-h pt-safe-top">
      <div
        role="status"
        data-testid="impersonation-banner"
        className="pointer-events-auto mt-2 flex min-w-0 items-center gap-2 rounded-full bg-gray-900 py-1 pl-4 pr-1 text-caption font-medium text-white"
      >
        <Eye className="size-icon-md shrink-0" aria-hidden />
        <span className="truncate">Solo lectura: viendo como {user.name}</span>
        <Button size="sm" variant="secondary" className="shrink-0" disabled={leaving} onClick={leave} data-testid="button-stop-impersonation">
          Salir
        </Button>
      </div>
    </div>
  );
}

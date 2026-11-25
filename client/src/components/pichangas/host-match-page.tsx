import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { MatchFormPage } from "@/components/pichangas/match-form";
import { NightBackLink } from "@/components/pichangas/night-controls";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { PLAY_ROUTES } from "@/lib/routes";
import { usePlayerProfile, useVenues } from "@/lib/pichangas";
import type { AdminMatchInput } from "@/lib/admin-pichangas";

// Pagina para crear un partido (host). Si el usuario no es host se le lleva a su perfil para activarlo.
export function HostMatchPage() {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading } = usePlayerProfile();
  const { data: venues = [] } = useVenues();
  const back = () => setLocation(PLAY_ROUTES.host);

  const create = useMutation({
    mutationFn: async (data: AdminMatchInput) => (await apiRequest("POST", "/api/matches", data)).json(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/matches") });
      toast({ title: "Partido creado", variant: "success" });
      back();
    },
    onError: (e) => toast({ variant: "destructive", title: "No pudimos crear el partido", description: e instanceof Error ? e.message : undefined }),
  });

  if (!isLoading && !profile?.isHost) {
    return (
      <div className="space-y-3 px-page-h py-4 lg:px-0 lg:py-6">
        <NightBackLink label="Volver a organizar" onClick={back} />
        <p className="text-body text-night-muted">Activa tu perfil de host en tu perfil (Tipo de perfil) para crear partidos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-section-gap px-page-h py-4 lg:px-0 lg:py-6">
      <div className="space-y-2">
        <NightBackLink label="Volver a organizar" onClick={back} />
        <h1 className="text-heading font-bold text-night-text">Nuevo partido</h1>
      </div>
      <MatchFormPage
        venues={venues.map((v) => ({ ...v, isActive: true }))}
        saving={create.isPending}
        submitLabel="Crear partido"
        onCancel={back}
        onSubmit={(data) => create.mutate(data)}
      />
    </div>
  );
}

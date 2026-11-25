import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { CalendarPlus, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchCard } from "@/components/pichangas/match-card";
import { NightEmpty, PitchButton } from "@/components/pichangas/night-ui";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { PLAY_ROUTES } from "@/lib/routes";
import { useMyMatches, usePlayerProfile, type MatchSummary } from "@/lib/pichangas";

const refreshMatches = () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/matches") });

// Perfil de host: crear partidos y ver / cancelar los que organizo. Sin el perfil de host se invita a activarlo.
export function HostView({ userId }: { userId: string }) {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading: loadingProfile } = usePlayerProfile();
  const { data: mine = [], isLoading, isError, refetch } = useMyMatches();
  const [toCancel, setToCancel] = useState<MatchSummary | null>(null);

  const cancel = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/matches/${id}/cancel`)).json(),
    onSuccess: () => { void refreshMatches(); toast({ title: "Partido cancelado" }); },
    onError: (e) => toast({ variant: "destructive", title: "No pudimos cancelar", description: e instanceof Error ? e.message : undefined }),
  });

  if (loadingProfile) return <div className="px-page-h py-6 lg:px-0"><Skeleton className="h-40 w-full" /></div>;

  if (!profile?.isHost) {
    return (
      <div className="space-y-section-gap px-page-h py-4 lg:px-0 lg:py-6">
        <h1 className="text-heading font-bold text-night-text">Organizar</h1>
        <NightEmpty
          icon={<UserCog className="size-icon-empty" />}
          title="Activa tu perfil de host"
          description="Con el perfil de host puedes crear partidos y organizarlos. Lo cambias en tu perfil, en Tipo de perfil."
          action={<PitchButton onClick={() => setLocation(PLAY_ROUTES.profile)}>Ir a mi perfil</PitchButton>}
        />
      </div>
    );
  }

  const hosted = mine
    .filter((m) => m.organizerId === userId)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <div className="space-y-section-gap px-page-h py-4 lg:px-0 lg:py-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-heading font-bold text-night-text">Organizar</h1>
        <PitchButton onClick={() => setLocation(PLAY_ROUTES.hostNew)}>
          <CalendarPlus className="size-icon-lg" aria-hidden />
          Crear partido
        </PitchButton>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <NightEmpty icon={<CalendarPlus className="size-icon-empty" />} title="No pudimos cargar tus partidos" action={<PitchButton onClick={() => refetch()}>Reintentar</PitchButton>} />
      ) : hosted.length === 0 ? (
        <NightEmpty icon={<CalendarPlus className="size-icon-empty" />} title="Todavía no organizas partidos" description="Crea tu primer partido: elige la cancha, el día, los cupos y la cuota." />
      ) : (
        <div className="grid grid-cols-1 gap-grid-gap lg:grid-cols-2">
          {hosted.map((m) => (
            <div key={m.id} className="space-y-2">
              <MatchCard match={m} onOpen={(id) => setLocation(PLAY_ROUTES.match(id))} />
              {m.status === "cancelled" ? (
                <p className="px-1 text-caption font-bold text-crimson">Partido cancelado</p>
              ) : new Date(m.startsAt).getTime() > Date.now() ? (
                <Button variant="crimson-outline" size="compact" onClick={() => setToCancel(m)}>Cancelar partido</Button>
              ) : null}
            </div>
          ))}
        </div>
      )}


      <ConfirmDialog
        open={!!toCancel}
        onOpenChange={(o) => !o && setToCancel(null)}
        title="¿Cancelar este partido?"
        description={toCancel ? `${toCancel.title}. Los jugadores anotados lo verán cancelado.` : undefined}
        confirmLabel="Cancelar partido"
        cancelLabel="Mantenerlo"
        destructive
        onConfirm={() => toCancel && cancel.mutate(toCancel.id)}
      />
    </div>
  );
}

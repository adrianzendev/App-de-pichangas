import { useState, type ReactNode } from "react";
import { surfaceClass } from "@/components/pichangas/surface";
import { useLocation } from "wouter";
import { CalendarDays, Clock, MapPin, Search, Ticket } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { RuleList } from "@/components/pichangas/rule-list";
import { PlayerRow } from "@/components/pichangas/player-row";
import { VenueGallery } from "@/components/pichangas/venue-gallery";
import { CollapsibleCard, OrganizerCard, SectionCard } from "@/components/pichangas/detail-cards";
import { squadOf } from "@/lib/squad";
import { Button } from "@/components/ui/button";
import { SeatStepper } from "@/components/pichangas/seat-stepper";
import { SquadList } from "@/components/pichangas/squad-list";
import { NightBadge, NightEmpty, PitchButton } from "@/components/pichangas/night-ui";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PLAY_ROUTES, ROUTES } from "@/lib/routes";
import {
  SURFACE_LABEL, coverPhotos, dayLabel, priceLabel, spotsLeft, time12Label,
  timeRange12, useJoinLeave, useMatch,
} from "@/lib/pichangas";

interface MatchDetailViewProps {
  matchId: string;
  currentUserId?: string;
}


function InfoRow({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-1 size-5 shrink-0 text-aqua" aria-hidden />
      <div className="min-w-0">
        <p className="text-body font-bold text-night-text">{title}</p>
        <div className="text-label text-night-muted">{children}</div>
      </div>
    </div>
  );
}

// Detalle de una pichanga (tema Pichanga Black): quien va, cuanto falta y la accion principal (anotarme / bajarme) siempre a mano.
export function MatchDetailView({ matchId, currentUserId }: MatchDetailViewProps) {
  const [, setLocation] = useLocation();
  const { data: match, isLoading, isError, refetch } = useMatch(matchId);
  const { join, leave } = useJoinLeave(matchId);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Cupos libres que marque en la plantilla (indices 0..left-1); se pueden marcar varios, tambien con el selector de abajo.
  const [picked, setPicked] = useState<number[]>([]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4" aria-busy="true">
        <Skeleton className="h-8 w-2/3 bg-night-container" />
        <Skeleton className="h-24 w-full bg-night-container" />
        <Skeleton className="h-40 w-full bg-night-container" />
      </div>
    );
  }
  if (isError || !match) {
    return (
      <div className="p-4">
        <NightEmpty
          icon={<Search className="size-icon-empty" />}
          title="No pudimos cargar este partido"
          description="Revisa tu conexión e inténtalo de nuevo."
          action={<PitchButton onClick={() => refetch()}>Reintentar</PitchButton>}
        />
      </div>
    );
  }

  const waitlist = match.players.filter((p) => p.status === "waitlist" && p.userId !== match.organizerId);
  const me = match.players.find((p) => p.userId === currentUserId);
  const isOrganizer = match.organizerId === currentUserId;
  // El organizador no ocupa cupo ni se lista con los jugadores: va aparte, con su propia ficha.
  const organizer = match.players.find((p) => p.userId === match.organizerId);
  const organizerName = organizer?.name ?? match.organizerName;
  const organizerAvatar = organizer?.avatar ?? match.organizerAvatar ?? null;
  const { players, seatOf, nextSeat } = squadOf(match);
  const left = spotsLeft(match);
  const cancelled = match.status === "cancelled" || match.status === "finished";
  // Anotado sin pagar: los cupos marcados se suman a los que ya tengo (yo + acompañantes). Maximo 6 por persona y nunca mas de los libres.
  const baseSeats = me?.status === "confirmed" ? 1 + me.guests : 0;
  const maxPicks = Math.max(0, Math.min(left, 6 - baseSeats));
  // El tope limita la CANTIDAD de cupos marcados (no a cuales filas): cualquier "Lugar libre" se puede marcar mientras no se llegue al tope.
  const picks = picked.filter((i) => i < left).slice(0, maxPicks);
  const limitReached = picks.length >= maxPicks;
  const canPick = !cancelled && !isOrganizer && maxPicks > 0 && (!me || (me.status === "confirmed" && !me.paid));
  const seatCount = me ? baseSeats + picks.length : Math.max(1, picks.length);
  const maxSeats = me ? baseSeats + maxPicks : Math.max(1, maxPicks);
  const minSeats = me ? baseSeats : 1;
  const togglePick = (i: number) => {
    if (picks.includes(i)) setPicked(picks.filter((x) => x !== i));
    else if (!limitReached) setPicked([...picks, i].sort((a, b) => a - b));
  };
  const addSeat = () => {
    if (picks.length === 0 && !me) { setPicked([0, 1].filter((i) => i < left)); return; }
    if (limitReached) return;
    const next = Array.from({ length: left }, (_, i) => i).find((i) => !picks.includes(i));
    if (next !== undefined) setPicked([...picks, next].sort((a, b) => a - b));
  };
  const removeSeat = () => setPicked(picks.slice(0, -1));
  const busy = join.isPending || leave.isPending;

  // Primero se paga, luego esta el ticket: solo quien ya pago (o el partido es gratis) abre el pase digital.
  // El suplente entra a la lista sin pagar; paga cuando le toca un cupo.
  const doJoin = (paid: boolean) => {
    join.mutate({ paid, guests: seatCount - 1 }, {
      onSuccess: (r) => {
        if (r.status === "confirmed" && r.paid) setLocation(PLAY_ROUTES.pass(match));
        else toast({ title: "Estás en la lista de suplentes", description: "Si alguien se baja, entras tú." });
      },
      onError: (e) => toast({ variant: "destructive", title: "No pudimos anotarte", description: e instanceof Error ? e.message : undefined }),
    });
  };
  // Con cupo libre se va a "Confirmar y pagar" (gratis: se anota directo); sin cupo solo queda entrar de suplente.
  const requestJoin = () => {
    if (!currentUserId) { setLocation(ROUTES.login); return; }
    if (left === 0) { doJoin(false); return; }
    if (Number(match.pricePerPlayer) <= 0) { doJoin(true); return; }
    // Al ir a pagar los cupos se reservan por 10 minutos: si no se paga a tiempo se liberan para los demas.
    join.mutate({ paid: false, guests: seatCount - 1 }, {
      onSuccess: () => setLocation(`${PLAY_ROUTES.pay(match)}${seatCount > 1 ? `?cupos=${seatCount}` : ""}`),
      onError: (e) => toast({ variant: "destructive", title: "No pudimos reservar tus cupos", description: e instanceof Error ? e.message : undefined }),
    });
  };
  const onLeave = () => {
    leave.mutate(undefined, {
      onSuccess: () => toast({ title: "Te bajaste del partido" }),
      onError: (e) => toast({ variant: "destructive", title: "No pudimos bajarte", description: e instanceof Error ? e.message : undefined }),
    });
  };

  const stepper = canPick && maxSeats > minSeats ? (
    <SeatStepper className="lg:shrink-0" label={me ? `Cupos a pagar (tu lugar + ${picks.length} más)` : "Cupos (tú y acompañantes)"} value={seatCount} min={minSeats} max={maxSeats} onAdd={addSeat} onRemove={removeSeat} />
  ) : null;
  const joinLabel = left > 0 ? (seatCount > 1 ? `Inscribirme con ${seatCount - 1} ${seatCount === 2 ? "acompañante" : "acompañantes"}` : "Inscribirme") : "Inscribirme de suplente";
  const payLabel = seatCount > 1 ? `Pagar ${seatCount} cupos` : "Pagar";
  // Anotado sin pagar: va al pago con todos los cupos (los que ya tenia + los marcados).
  const payNow = () => {
    const go = () => setLocation(`${PLAY_ROUTES.pay(match)}${seatCount > 1 ? `?cupos=${seatCount}` : ""}`);
    // Si marco mas cupos, se reservan tambien antes de pasar al pago.
    if (seatCount > baseSeats) {
      join.mutate({ paid: false, guests: seatCount - 1 }, {
        onSuccess: go,
        onError: (e) => toast({ variant: "destructive", title: "No pudimos reservar tus cupos", description: e instanceof Error ? e.message : undefined }),
      });
    } else go();
  };

  let cta: ReactNode;
  if (cancelled) {
    cta = <Button variant="night-secondary" size="lg" className="w-full uppercase" disabled>Partido cancelado</Button>;
  } else if (isOrganizer) {
    cta = <Button variant="night-secondary" size="lg" className="w-full uppercase" disabled>Organizas este partido</Button>;
  } else if (me) {
    if (me.status === "waitlist") {
      cta = (
        <Button variant="night-secondary" size="lg" className="w-full uppercase" disabled={busy} onClick={() => setConfirmLeave(true)}>Salir de suplentes</Button>
      );
    } else if (!me.paid) {
      cta = (
        <div className="space-y-2 lg:flex lg:flex-1 lg:items-center lg:gap-6 lg:space-y-0">
          {me.holdExpiresAt && <p className="text-caption font-bold text-crimson lg:shrink-0">Paga antes de las {time12Label(me.holdExpiresAt)} o perderás tu lugar.</p>}
          {stepper}
          <PitchButton className="w-full uppercase lg:flex-1" disabled={busy} onClick={payNow}>{payLabel}</PitchButton>
        </div>
      );
    } else {
      cta = null;
    }
  } else {
    cta = (
      <div className="space-y-2 lg:flex lg:flex-1 lg:items-center lg:gap-6 lg:space-y-0">
        {stepper}
        <PitchButton className="w-full uppercase lg:flex-1" disabled={busy} onClick={requestJoin}>{joinLabel}</PitchButton>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Movil: una columna en este orden. Escritorio: cuadricula de 2 columnas con posiciones fijas (lg:col-start-1 / lg:col-start-2), cada columna apila sus tarjetas. */}
      <div className="flex-1 space-y-section-gap p-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0 lg:p-0 lg:pb-6">
        <div className="space-y-2 lg:col-span-2 lg:row-start-1">
          <h1 className="text-heading font-extrabold uppercase text-night-text">{match.title}</h1>
          <div className="flex flex-wrap gap-2">
            {left === 1 && !cancelled && <NightBadge tone="crimson">Último cupo</NightBadge>}
            {me?.status === "confirmed" && me.paid && <NightBadge tone="pitch">Anotado</NightBadge>}
            {me?.status === "waitlist" && <NightBadge tone="pitch">Suplente</NightBadge>}
          </div>
        </div>

        {/* Dos columnas independientes: cada una apila sus tarjetas, asi la altura de una no abre huecos en la otra. */}
        <div className="space-y-section-gap lg:col-start-1 lg:row-start-2">
        <div className="relative h-36 overflow-hidden rounded-md bg-night-high lg:h-72">
          <VenueGallery venue={{ photos: coverPhotos(match) }} alt={`Cancha ${match.venue.name}`} className="h-full w-full" />
        </div>

        <section className={cn(surfaceClass(), "space-y-4 p-card-pad")} aria-label="Datos del partido">
          <InfoRow icon={CalendarDays} title={dayLabel(match.startsAt)}>
            {new Date(match.startsAt).toLocaleDateString("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" })}
          </InfoRow>
          <InfoRow icon={Clock} title={timeRange12(match.startsAt, match.durationMinutes)}>{match.durationMinutes} minutos de juego</InfoRow>
          <InfoRow icon={MapPin} title={match.venue.name}>
            {match.venue.address ? `${match.venue.address}, ` : ""}{match.venue.district}
            <br />
            {SURFACE_LABEL[match.venue.surface] ?? match.venue.surface}
          </InfoRow>
        </section>
        </div>

        <div className="space-y-section-gap lg:col-start-2 lg:row-start-2">
        <SquadList
          players={players}
          seatOf={seatOf}
          nextSeat={nextSeat}
          maxPlayers={match.maxPlayers}
          confirmedCount={match.confirmedCount}
          left={left}
          currentUserId={currentUserId}
          cancelled={cancelled}
          canJoin={canPick}
          selected={picks}
          mineHeld={!!me && me.status === "confirmed" && !me.paid && !isOrganizer}
          limitReached={limitReached}
          onToggle={togglePick}
          busy={busy}
        />

        <OrganizerCard name={organizerName} avatar={organizerAvatar} isMe={isOrganizer} />

        {/* Plegado por defecto: las reglas ya se leen en el pase y no deben competir con la plantilla ni con el boton de pago. */}
        <CollapsibleCard title="Reglas del encuentro"><RuleList startsAt={match.startsAt} /></CollapsibleCard>

        {waitlist.length > 0 && (
          <SectionCard title="Suplentes" description="Entran por orden de llegada si alguien se baja.">
            <ul className="space-y-2">
              {waitlist.map((p, i) => (
                <PlayerRow key={p.userId} name={p.name} avatar={p.avatar} isMe={p.userId === currentUserId} number={i + 1} />
              ))}
            </ul>
          </SectionCard>
        )}

        {match.description && (
          <SectionCard title="Notas del organizador"><p className="text-body text-night-muted">{match.description}</p></SectionCard>
        )}
        </div>
      </div>

      {/* Accion principal fija al fondo: superficie propia (night-high, mas clara que el fondo) para que no se funda con la pagina; sin sombra. El boton se estira a todo el ancho, alineado con el contenido. */}
      <div className="sticky bottom-0 border border-night-high bg-night-container p-4 lg:rounded-md lg:p-6">
        <div className="w-full lg:flex lg:items-center lg:gap-6">
          <div className="mb-3 flex items-baseline justify-between lg:mb-0 lg:shrink-0 lg:flex-col lg:items-start lg:gap-1">
            <span className="text-caption font-bold uppercase text-night-muted">Total a pagar</span>
            <span className="text-subheading font-extrabold text-pitch">{priceLabel(Number(match.pricePerPlayer) * Math.max(1, seatCount))} <span className="text-caption font-bold text-night-muted">/ {seatCount > 1 ? (me ? `${seatCount} cupos (el tuyo + ${picks.length})` : `${seatCount} personas`) : "persona"}</span></span>
          </div>
          {me?.status === "confirmed" && me.paid && !cancelled && (
            <Button variant="pitch-outline" size="lg" className="mb-2 w-full uppercase" onClick={() => setLocation(PLAY_ROUTES.pass(match))}>
              <Ticket className="size-icon-lg" aria-hidden />
              Ver mi pase
            </Button>
          )}
          {cta}
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="¿Salir de la lista de suplentes?"
        confirmLabel="Salir"
        cancelLabel="Quedarme"
        destructive
        onConfirm={onLeave}
      />
    </div>
  );
}

import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { CalendarDays, ChevronDown, Clock, MapPin, Minus, Plus, Search, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { RuleList } from "@/components/pichangas/rule-list";
import { PlayerRow } from "@/components/pichangas/player-row";
import { CoverImage, NightEmpty, PitchButton } from "@/components/pichangas/night-ui";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PLAY_ROUTES, ROUTES } from "@/lib/routes";
import {
  SURFACE_LABEL, dayLabel, priceLabel, spotsLeft,
  timeRange12, useJoinLeave, useMatch,
} from "@/lib/pichangas";

interface MatchDetailViewProps {
  matchId: string;
  currentUserId?: string;
}


function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "pitch" }) {
  return (
    <span className={cn("rounded-full px-3 py-1 text-label font-bold", tone === "pitch" ? "bg-pitch/15 text-pitch" : "bg-night-high text-night-text")}>
      {children}
    </span>
  );
}

function InfoRow({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-aqua" aria-hidden />
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
  // Cupos que tomo en esta inscripcion (yo + acompañantes).
  const [seats, setSeats] = useState(1);

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

  const confirmed = match.players.filter((p) => p.status === "confirmed");
  const waitlist = match.players.filter((p) => p.status === "waitlist" && p.userId !== match.organizerId);
  const me = match.players.find((p) => p.userId === currentUserId);
  const isOrganizer = match.organizerId === currentUserId;
  // El organizador ocupa un cupo pero no se lista junto a los jugadores: va aparte, con su propia ficha.
  const organizer = match.players.find((p) => p.userId === match.organizerId);
  const organizerName = organizer?.name ?? match.organizerName;
  const organizerAvatar = organizer?.avatar ?? match.organizerAvatar ?? null;
  // El organizador nunca va en la plantilla: tiene su propia ficha arriba. Filas, puntos y contador cuentan solo
  // a los jugadores anotados.
  // El organizador tambien ocupa un cupo: va primero en la plantilla (los numeros cuentan cupos, no personas).
  const players = [...confirmed].sort((a, b) => Number(b.userId === match.organizerId) - Number(a.userId === match.organizerId));
  let nextSeat = 1;
  const seatOf = players.map((p) => { const start = nextSeat; nextSeat += 1 + p.guests; return start; });
  const left = spotsLeft(match);
  // Maximo 6 cupos por inscripcion y nunca mas de los libres.
  const maxSeats = Math.max(1, Math.min(6, left));
  const seatCount = Math.min(seats, maxSeats);
  const cancelled = match.status === "cancelled" || match.status === "finished";
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
    setLocation(`${PLAY_ROUTES.pay(match)}${seatCount > 1 ? `?cupos=${seatCount}` : ""}`);
  };
  const onLeave = () => {
    leave.mutate(undefined, {
      onSuccess: () => toast({ title: "Te bajaste del partido" }),
      onError: (e) => toast({ variant: "destructive", title: "No pudimos bajarte", description: e instanceof Error ? e.message : undefined }),
    });
  };

  const secondary = "flex h-12 w-full items-center justify-center gap-2 rounded-md bg-night-highest text-body font-bold uppercase text-night-text transition-colors duration-fast hover:bg-night-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch disabled:opacity-60";
  let cta: ReactNode;
  if (cancelled) {
    cta = <button type="button" disabled className={secondary}>Partido cancelado</button>;
  } else if (isOrganizer) {
    cta = <button type="button" disabled className={secondary}>Organizas este partido</button>;
  } else if (me) {
    cta = me.status === "waitlist" ? (
      <button type="button" disabled={busy} onClick={() => setConfirmLeave(true)} className={secondary}>
        Salir de suplentes
      </button>
    ) : null;
  } else {
    cta = (
      <div className="space-y-2 lg:flex lg:flex-1 lg:items-center lg:gap-6 lg:space-y-0">
        {left > 1 && (
          <div className="flex items-center justify-between gap-3 lg:shrink-0">
            <span className="text-label font-bold text-night-muted">Cupos (tú y acompañantes)</span>
            <div className="flex items-center gap-1" role="group" aria-label="Cupos a inscribir">
              <button type="button" aria-label="Quitar un cupo" disabled={seatCount <= 1} onClick={() => setSeats(seatCount - 1)} className="flex size-9 items-center justify-center rounded-full bg-night-highest text-night-text transition-colors duration-fast hover:bg-night-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch disabled:opacity-40"><Minus className="size-icon-md" aria-hidden /></button>
              <span className="w-8 text-center text-body font-bold text-night-text tabular-nums" aria-live="polite">{seatCount}</span>
              <button type="button" aria-label="Agregar un cupo" disabled={seatCount >= maxSeats} onClick={() => setSeats(seatCount + 1)} className="flex size-9 items-center justify-center rounded-full bg-night-highest text-night-text transition-colors duration-fast hover:bg-night-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch disabled:opacity-40"><Plus className="size-icon-md" aria-hidden /></button>
            </div>
          </div>
        )}
        <PitchButton className="w-full uppercase lg:flex-1" disabled={busy} onClick={requestJoin}>
          {left > 0 ? (seatCount > 1 ? `Inscribirme con ${seatCount - 1} ${seatCount === 2 ? "acompañante" : "acompañantes"}` : "Inscribirme") : "Inscribirme de suplente"}
        </PitchButton>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Movil: una columna en este orden. Escritorio: cuadricula de 2 columnas con posiciones fijas (lg:col-start / lg:row-start). */}
      <div className="flex-1 space-y-section-gap p-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0 lg:p-0 lg:pb-6">
        <div className="space-y-2 lg:col-span-2 lg:row-start-1">
          <h1 className="text-heading font-extrabold uppercase text-night-text">{match.title}</h1>
          <div className="flex flex-wrap gap-1.5">
            {left === 1 && !cancelled && <span className="rounded-full bg-crimson px-3 py-1 text-label font-bold text-crimson-on">Último cupo</span>}
            {me?.status === "confirmed" && me.paid && <Tag tone="pitch">Anotado</Tag>}
            {me?.status === "waitlist" && <Tag tone="pitch">Suplente</Tag>}
          </div>
        </div>

        <div className="relative h-36 overflow-hidden rounded-md bg-night-high lg:col-start-1 lg:row-start-2 lg:h-72">
          <CoverImage venue={match.venue} alt={`Cancha ${match.venue.name}`} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-night-lowest via-night-lowest/40 to-transparent" aria-hidden />
        </div>

        <section className="space-y-4 rounded-md bg-night-low p-card-pad lg:col-start-2 lg:row-start-2" aria-label="Datos del partido">
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

        <section className="flex items-center gap-3 rounded-md bg-night-low p-card-pad lg:col-start-1 lg:row-start-4" aria-label="Organizador">
          <UserAvatar name={organizerName} avatar={organizerAvatar} size="md" />
          <div className="min-w-0">
            <p className="text-caption font-bold uppercase text-night-muted">Organizador</p>
            <p className="truncate text-body font-bold text-night-text">{organizerName}{isOrganizer ? " (tú)" : ""}</p>
          </div>
        </section>

        <section className="space-y-4 lg:col-start-1 lg:row-start-3" aria-label="Plantilla">
          <div className="flex items-baseline justify-between">
            <h2 className="text-subheading font-bold uppercase text-night-text">Plantilla</h2>
            <p className="text-label font-bold text-pitch">{match.confirmedCount} de {match.maxPlayers}</p>
          </div>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {players.map((p, i) => (
              <PlayerRow key={p.userId} name={p.name} avatar={p.avatar} isMe={p.userId === currentUserId} number={seatOf[i]} index={i} action={p.userId === match.organizerId || p.guests > 0 ? <span className="flex shrink-0 gap-1">{p.userId === match.organizerId && <span className="rounded-full bg-night-highest px-2 py-0.5 text-caption font-bold text-night-muted">Organiza</span>}{p.guests > 0 && <span className="rounded-full bg-night-highest px-2 py-0.5 text-caption font-bold text-pitch">+{p.guests}</span>}</span> : undefined} />
            ))}
            {/* Cada cupo libre es igual (una columna) y, si todavia no estoy anotado, todos llevan "Separar ahora". */}
            {Array.from({ length: cancelled ? 0 : left }, (_, i) => {
              const canJoin = !isOrganizer && !me;
              return (
                <PlayerRow
                  key={`free-${i}`}
                  number={nextSeat + i}
                  index={players.length + i}
                  name="Lugar libre"
                  placeholder
                  highlight={canJoin}
                  action={canJoin ? <Button variant="pitch" size="compact" className="shrink-0" onClick={requestJoin} disabled={busy}>Separar ahora</Button> : undefined}
                />
              );
            })}
          </ul>
          {left > 0 && !cancelled && (
            <p className="text-label text-night-muted">{left === 1 ? "Falta 1 jugador." : `Faltan ${left} jugadores.`}</p>
          )}
        </section>

        {/* Plegado por defecto: las reglas ya se leen en el pase y no deben competir con la plantilla ni con el boton de pago. */}
        <details className="group rounded-md bg-night-low px-card-pad py-3 lg:col-start-2 lg:row-start-3 lg:self-start" aria-label="Reglas clave del encuentro">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-label font-bold text-night-muted transition-colors duration-fast hover:text-night-text [&::-webkit-details-marker]:hidden">
            Reglas del encuentro
            <ChevronDown className="size-icon-md transition-transform duration-fast group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-4"><RuleList startsAt={match.startsAt} /></div>
        </details>

        {waitlist.length > 0 && (
          <section className="space-y-3 rounded-md bg-night-low p-card-pad lg:col-start-2 lg:row-start-4" aria-label="Suplentes">
            <h2 className="text-subheading font-bold uppercase text-night-text">Suplentes</h2>
            <p className="text-label text-night-muted">Entran por orden de llegada si alguien se baja.</p>
            <ul className="space-y-1">
              {waitlist.map((p, i) => (
                <PlayerRow key={p.userId} name={p.name} avatar={p.avatar} isMe={p.userId === currentUserId} number={i + 1} />
              ))}
            </ul>
          </section>
        )}

        {match.description && (
          <section className="space-y-2 rounded-md bg-night-low p-card-pad lg:col-start-2" aria-label="Notas del organizador">
            <h2 className="text-subheading font-bold uppercase text-night-text">Notas del organizador</h2>
            <p className="text-body text-night-muted">{match.description}</p>
          </section>
        )}
      </div>

      {/* Accion principal fija al fondo: superficie propia (night-high, mas clara que el fondo) para que no se funda con la pagina; sin sombra. El boton se estira a todo el ancho, alineado con el contenido. */}
      <div className="sticky bottom-0 bg-night-high p-4 lg:p-6">
        <div className="w-full lg:flex lg:items-center lg:gap-6">
          <div className="mb-3 flex items-baseline justify-between lg:mb-0 lg:shrink-0 lg:flex-col lg:items-start lg:gap-0.5">
            <span className="text-caption font-bold uppercase text-night-muted">Total a pagar</span>
            <span className="text-subheading font-extrabold text-pitch">{priceLabel(match.pricePerPlayer)} <span className="text-caption font-bold text-night-muted">/ persona</span></span>
          </div>
          {me?.status === "confirmed" && !me.paid && !cancelled && (
            <button
              type="button"
              onClick={() => setLocation(PLAY_ROUTES.pay(match))}
              className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-pitch text-body font-bold uppercase text-pitch-on shadow-glow transition-colors duration-fast hover:bg-pitch-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch"
            >
              <Ticket className="size-icon-lg" aria-hidden />
              Pagar y obtener mi pase
            </button>
          )}
          {me?.status === "confirmed" && me.paid && !cancelled && (
            <button
              type="button"
              onClick={() => setLocation(PLAY_ROUTES.pass(match))}
              className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-pitch/60 bg-pitch/10 text-body font-bold uppercase text-pitch transition-colors duration-fast hover:bg-pitch/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch"
            >
              <Ticket className="size-icon-lg" aria-hidden />
              Ver mi pase
            </button>
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

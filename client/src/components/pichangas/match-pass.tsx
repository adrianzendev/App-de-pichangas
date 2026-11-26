import { useEffect, useRef, useState, type FormEvent, type ReactNode, useId } from "react";
import { surfaceClass } from "@/components/pichangas/surface";
import { useLocation } from "wouter";
import QRCode from "qrcode";
import {
  CalendarPlus, CheckCircle2, Clock, MapPin, MessageSquare, Navigation, Search, Send, Share2,
  ShieldCheck, Ticket, Users, XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { NightIconButton, NightInput, NightTile } from "@/components/pichangas/night-controls";
import { NightBadge, NightEmpty, PitchButton } from "@/components/pichangas/night-ui";
import { RuleList } from "@/components/pichangas/rule-list";
import { GuestNamesDialog } from "@/components/pichangas/guest-names-dialog";
import { guestNamesComplete } from "@/lib/guest-names";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PLAY_ROUTES } from "@/lib/routes";
import {
  dayLabel, googleCalendarUrl, inviteMessage, mapsUrl,
  passNumber, seatNumber, spotsLeft, time12Label, timeRange12, useMatch, useMatchMessages, useSendMatchMessage,
  type MatchMessage,
} from "@/lib/pichangas";

interface MatchPassUser {
  id: string;
  name: string;
  avatar?: string | null;
}

interface MatchPassViewProps {
  matchId: string;
  me: MatchPassUser;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Cuenta regresiva hasta el pitazo: "03:42:15" o "2d 03:42:15". */
function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const diff = new Date(iso).getTime() - now;
  const total = Math.max(0, Math.floor(diff / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return {
    started: diff <= 0,
    label: days > 0 ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
  };
}

// Marco de balon de futbol para el QR (vista frontal del balon clasico): cinco parches pentagonales en el borde, costuras
// que bajan hacia el centro y se unen entre parches, y un sombreado suave. El QR cuadrado va al centro con su margen blanco,
// asi que sigue siendo legible. Coordenadas en un lienzo de 100 x 100.
const BALL_CENTER = 50;
const BALL_PATCH_DIST = 45; // distancia del centro del balon al centro de cada parche
const BALL_PATCH_R = 8.5;
const polar = (r: number, deg: number, cx = BALL_CENTER, cy = BALL_CENTER) =>
  [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)] as const;
// Cada parche apunta con un vertice al centro del balon.
const BALL_PATCHES = [0, 1, 2, 3, 4].map((k) => {
  const angle = -90 + k * 72;
  const [cx, cy] = polar(BALL_PATCH_DIST, angle);
  const verts = [0, 1, 2, 3, 4].map((j) => polar(BALL_PATCH_R, angle + 180 + j * 72, cx, cy));
  return { cx, cy, verts };
});
const dist2 = (p: readonly number[], q: readonly number[]) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
// Costuras radiales (del vertice interior de cada parche hacia el centro) y entre parches vecinos (par de vertices mas cercano).
const BALL_SEAMS: [readonly number[], readonly number[]][] = BALL_PATCHES.flatMap((patch, k) => {
  const next = BALL_PATCHES[(k + 1) % BALL_PATCHES.length];
  let best: [readonly number[], readonly number[]] = [patch.verts[0], next.verts[0]];
  for (const v of patch.verts) for (const w of next.verts) if (dist2(v, w) < dist2(...best)) best = [v, w];
  return [[patch.verts[0], [BALL_CENTER, BALL_CENTER]], best] as [readonly number[], readonly number[]][];
});

function BallFrame() {
  const id = useId();
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-lg" aria-hidden>
      <defs>
        <radialGradient id={`${id}-shade`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="var(--gray-50)" />
          <stop offset="70%" stopColor="var(--gray-100)" />
          <stop offset="100%" stopColor="var(--gray-300)" />
        </radialGradient>
        <clipPath id={`${id}-clip`}><circle cx="50" cy="50" r="49" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="49" fill={`url(#${id}-shade)`} />
      <g clipPath={`url(#${id}-clip)`} className="text-night-lowest">
        {BALL_SEAMS.map(([p, q], i) => (
          <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        ))}
        {BALL_PATCHES.map(({ cx, cy, verts }) => (
          <polygon key={`${cx}-${cy}`} points={verts.map((v) => v.join(",")).join(" ")} fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        ))}
      </g>
      <circle cx="50" cy="50" r="49" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-night-highest" />
    </svg>
  );
}

/** QR real (scannable) generado en el navegador a partir del contenido del pase, dentro de un marco de balon. */
function PassQr({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // 312px para que se vea nitido en pantallas 2x; negro sobre blanco es lo que mejor leen los lectores.
    QRCode.toDataURL(value, { width: 312, margin: 1, errorCorrectionLevel: "M" })
      .then((dataUrl) => { if (alive) setSrc(dataUrl); })
      .catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [value]);

  return (
    <div className="relative flex size-72 items-center justify-center">
      <BallFrame />
      {src
        ? <img src={src} alt="Código QR de tu pase" width={148} height={148} className="relative max-w-full rounded-sm" />
        : <Ticket className="relative size-icon-xl text-night-lowest" aria-hidden />}
    </div>
  );
}

function TicketMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-sm bg-night-high p-3">
      <span className="block text-caption font-bold uppercase text-night-muted">{label}</span>
      {children}
    </div>
  );
}

// Pantalla que se abre al anotarse: el pase digital (QR para el portero) y el chat del equipo para coordinar la llegada.
export function MatchPassView({ matchId, me }: MatchPassViewProps) {
  const [, setLocation] = useLocation();
  const { data: match, isLoading, isError, refetch } = useMatch(matchId);
  const minePlayer = match?.players.find((p) => p.userId === me.id);
  const isMember = Boolean(minePlayer) || match?.organizerId === me.id;
  const { data: messages, isLoading: chatLoading } = useMatchMessages(matchId, isMember);
  const send = useSendMatchMessage(matchId, me);
  const [draft, setDraft] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [namesDismissed, setNamesDismissed] = useState(false);
  // Ya pago con acompañantes y faltan sus nombres: se piden aqui, despues del pago (primero se paga, luego se completa la plantilla).
  const needsNames = !!minePlayer && !!minePlayer.paid && minePlayer.guests > 0 && !guestNamesComplete(minePlayer.guestNames, minePlayer.guests);
  const saveNames = useMutation({
    mutationFn: async (names: string[]) => (await apiRequest("PUT", `/api/matches/${matchId}/guest-names`, { guestNames: names })).json(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/matches") });
      toast({ title: "Nombres guardados", variant: "success" });
    },
    onError: (e) => toast({ variant: "destructive", title: "No pudimos guardar los nombres", description: e instanceof Error ? e.message : undefined }),
  });
  const streamRef = useRef<HTMLDivElement>(null);
  const countdown = useCountdown(match?.startsAt ?? new Date().toISOString());

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-content space-y-4 p-4 lg:max-w-none lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:p-0" aria-busy="true">
        <Skeleton className="h-40 w-full bg-night-container" />
        <Skeleton className="h-96 w-full bg-night-container" />
      </div>
    );
  }
  if (isError || !match) {
    return (
      <div className="mx-auto w-full max-w-content p-4">
        <NightEmpty
          icon={<Search className="size-icon-empty" />}
          title="No pudimos cargar tu pase"
          description="Revisa tu conexión e inténtalo de nuevo."
          action={<PitchButton onClick={() => refetch()}>Reintentar</PitchButton>}
        />
      </div>
    );
  }
  if (!isMember) {
    return (
      <div className="mx-auto w-full max-w-content p-4">
        <NightEmpty
          icon={<Ticket className="size-icon-empty" />}
          title="No estás anotado en este partido"
          description="Anótate primero para ver tu pase y el chat del equipo."
          action={<PitchButton onClick={() => setLocation(PLAY_ROUTES.match(match))}>Ver el partido</PitchButton>}
        />
      </div>
    );
  }

  // Primero se paga, luego esta el ticket: confirmado pero sin pago no ve el pase (el organizador no paga su propio partido).
  if (minePlayer?.status === "confirmed" && !minePlayer.paid && match.organizerId !== me.id) {
    return (
      <div className="mx-auto w-full max-w-content p-4">
        <NightEmpty
          icon={<Ticket className="size-icon-empty" />}
          title="Paga tu cupo para ver tu pase"
          description="El pase con QR y el chat del equipo se abren cuando tu pago está confirmado."
          action={<PitchButton onClick={() => setLocation(PLAY_ROUTES.pay(match))}>Pagar y obtener mi pase</PitchButton>}
        />
      </div>
    );
  }

  const confirmed = minePlayer?.status === "confirmed";
  const waitlist = minePlayer?.status === "waitlist";
  const isOrganizer = match.organizerId === me.id;
  const cancelled = match.status === "cancelled";
  const finished = match.status === "finished";
  const left = spotsLeft(match);
  const seat = seatNumber(match, me.id);
  const number = passNumber(match.id, me.id);
  const confirmedPlayers = match.players.filter((p) => p.status === "confirmed");
  const waitlistCount = match.players.filter((p) => p.status === "waitlist").length;
  const passValue = `PICHANGA|pase:${number}|partido:${match.id}|jugador:${me.id}|${match.title}`;

  const status = cancelled
    ? { title: "Partido cancelado", icon: <XCircle className="size-icon-xl" aria-hidden />, tone: "muted" as const, copy: "El organizador canceló esta pichanga." }
    : finished
      ? { title: "Partido finalizado", icon: <CheckCircle2 className="size-icon-xl" aria-hidden />, tone: "muted" as const, copy: "Gracias por jugar. Nos vemos en la próxima." }
      : waitlist
        ? { title: "Estás de suplente", icon: <Clock className="size-icon-xl" aria-hidden />, tone: "orchid" as const, copy: "Si alguien se baja, ocupas su lugar y te avisamos." }
        : isOrganizer
          ? { title: "Organizas este partido", icon: <CheckCircle2 className="size-icon-xl" aria-hidden />, tone: "pitch" as const, copy: "Tu pase ya está listo para el ingreso." }
          : { title: "¡Cupo asegurado!", icon: <CheckCircle2 className="size-icon-xl" aria-hidden />, tone: "pitch" as const, copy: "Ya eres parte de la pichanga." };

  const share = async () => {
    const text = inviteMessage(match);
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: match.title, text }); } catch { /* el usuario cerró la hoja */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Invitación copiada", description: "Pégala en WhatsApp y arma tu pichanga." });
    } catch {
      toast({ variant: "destructive", title: "No pudimos copiar la invitación", description: text });
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft("");
    send.mutate(body, {
      onError: (error) => toast({ variant: "destructive", title: "No se pudo enviar", description: error instanceof Error ? error.message : undefined }),
    });
  };

  const toneClass = status.tone === "pitch"
    ? "bg-pitch/15 text-pitch"
    : status.tone === "orchid"
      ? "bg-orchid/15 text-orchid"
      : "bg-night-high text-night-muted";

  return (
    <div className="mx-auto w-full max-w-content space-y-section-gap p-4 lg:max-w-none lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0 lg:p-0">
      <div className="space-y-section-gap">
        {/* Estado del cupo + cuenta regresiva */}
        <section className={cn(surfaceClass(), "flex items-center justify-between gap-3 p-4")} aria-label="Estado de mi cupo">
          <div className="min-w-0">
            {/* Un cupo normal (anotado y pagado) no necesita etiqueta: solo se avisa cuando el estado es distinto. */}
            {(waitlist || cancelled || finished || isOrganizer) && (
              <span className={cn("mb-1 inline-flex items-center rounded-full px-2 py-0.5 text-caption font-bold uppercase", toneClass)}>{status.title}</span>
            )}
            <h1 className="truncate text-body font-bold text-night-text">{dayLabel(match.startsAt)} · {timeRange12(match.startsAt, match.durationMinutes)}</h1>
          </div>
          <div className="shrink-0 pl-2 text-right">
            <span className="block text-caption font-bold uppercase text-night-muted">
              {cancelled || finished ? "Estado" : countdown.started ? "El partido" : "Empieza en"}
            </span>
            {cancelled || finished
              ? <span className="text-label font-bold text-night-muted">{finished ? "Finalizado" : "Cancelado"}</span>
              : <span className={cn("font-mono text-body font-bold tabular-nums", countdown.started ? "text-orchid" : "text-pitch")}>
                  {countdown.started ? "Ya empezó" : countdown.label}
                </span>}
          </div>
        </section>

        {/* Pase digital */}
        <section className={cn(surfaceClass(), "relative flex flex-col overflow-hidden")} aria-label="Pase digital del partido">
          <div className="h-2 w-full bg-gradient-to-r from-pitch via-aqua to-pitch" aria-hidden />
          <div className="flex flex-col items-center p-5 text-center">
            <div className="mb-4 flex w-full items-center justify-between gap-2">
              <span className="rounded-xs bg-night-high px-3 py-1 text-caption font-bold uppercase text-pitch">
                {waitlist ? "Pase en espera" : `Pase #${number}`}
              </span>
            </div>

            {cancelled || finished || waitlist ? (
              <div className={cn(surfaceClass("inset"), "my-2 flex w-full flex-col items-center justify-center gap-2 px-4 py-8")}>
                <span className={cn("flex size-14 items-center justify-center rounded-full", toneClass)} aria-hidden>{status.icon}</span>
                <p className="text-body font-bold text-night-text">{status.title}</p>
                <p className="max-w-xs text-caption text-night-muted">{status.copy}</p>
                {waitlist && <p className="text-label font-bold text-orchid">Puesto {Math.max(1, confirmedPlayers.length)} en la fila</p>}
              </div>
            ) : (
              <>
                <PassQr value={passValue} />
                <p className="mt-2 text-caption font-bold uppercase text-night-muted">Muestra al portero al ingresar</p>
                <p className="mt-1 max-w-xs text-caption text-night-muted">
                  Presenta este QR en recepción o con el canchero de {match.venue.name} para reclamar tu chaleco.
                </p>
              </>
            )}
          </div>

          <div className="relative flex items-center justify-between px-2 py-1" aria-hidden>
            <div className="-ml-5 size-6 rounded-full bg-night" />
            <div className="mx-2 flex-1 border-b-2 border-dashed border-night-highest" />
            <div className="-mr-5 size-6 rounded-full bg-night" />
          </div>

          <div className="space-y-3 bg-night-low p-5">
            <div>
              <TicketMeta label={isOrganizer ? "Organizador" : "Jugador"}>
                <div className="mt-1 flex items-center gap-2">
                  <span className="truncate text-body font-bold text-night-text">{me.name}</span>
                  {seat > 0 && <span className="shrink-0 rounded-xs bg-pitch px-2 py-0.5 text-caption font-bold text-pitch-on">#{seat}</span>}
                </div>
                {/* Un jugador anotado no necesita etiqueta: solo se avisa cuando el estado es distinto. */}
                {(isOrganizer || !confirmed) && <span className="block text-caption text-pitch">{isOrganizer ? "Organiza la pichanga" : "Suplente"}</span>}
              </TicketMeta>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-sm bg-night-high p-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-night-container text-aqua" aria-hidden>
                  <MapPin className="size-icon-lg" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-label font-bold text-night-text">{match.venue.name}</p>
                  <p className="truncate text-caption text-night-muted">
                    {match.venue.address ?? match.venue.district}{match.venue.address ? ` (${match.venue.district})` : ""}
                  </p>
                </div>
              </div>
              <a
                href={mapsUrl(match.venue)}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-sm bg-night-container px-3 py-2 text-caption font-bold text-aqua transition-transform duration-fast active:scale-95 hover:bg-night-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch"
              >
                <Navigation className="size-icon-sm" aria-hidden />
                GPS
              </a>
            </div>
          </div>
        </section>

        {/* Acciones rapidas */}
        <section className="grid grid-cols-3 gap-2" aria-label="Acciones del partido">
          <NightTile icon={<CalendarPlus className="size-icon-lg" />} label="Calendario" href={googleCalendarUrl(match)} />
          <NightTile icon={<Share2 className="size-icon-lg" />} label="Invitar pata" onClick={share} />
          <NightTile icon={<ShieldCheck className="size-icon-lg" />} label="Reglamento" onClick={() => setRulesOpen(true)} />
        </section>
      </div>

      {/* Chat del equipo */}
      <section className={cn(surfaceClass(), "flex flex-col overflow-hidden")} aria-label="Chat del equipo">
        <header className="flex items-center justify-between gap-3 bg-night-high px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-pitch/15 text-pitch" aria-hidden>
              <MessageSquare className="size-icon-lg" />
              {!cancelled && !finished && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-pitch ring-2 ring-night-high" />}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-label font-bold text-night-text">Camerino &amp; Coordinación</h2>
              <p className="flex items-center gap-1 text-caption text-pitch">
                <Users className="size-icon-sm" aria-hidden />
                {confirmedPlayers.length} {confirmedPlayers.length === 1 ? "pelotero anotado" : "peloteros anotados"}
                {waitlistCount > 0 && ` · ${waitlistCount} en espera`}
              </p>
            </div>
          </div>
          <NightBadge tone="muted" size="sm" className="shrink-0">
            {left === 0 ? "Completo" : left === 1 ? "Falta 1 cupo" : `Faltan ${left} cupos`}
          </NightBadge>
        </header>

        <div ref={streamRef} className="max-h-80 min-h-40 space-y-3 overflow-y-auto p-3">
          {chatLoading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-14 w-3/4 bg-night-high" />
              <Skeleton className="ml-auto h-12 w-2/3 bg-night-high" />
            </div>
          ) : !messages || messages.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <MessageSquare className="size-icon-empty text-night-muted" aria-hidden />
              <p className="text-body font-semibold text-night-text">Todavía no hay mensajes</p>
              <p className="text-caption text-night-muted">Saluda y coordinen la llegada al camerino.</p>
            </div>
          ) : (
            messages.map((message: MatchMessage) => {
              const own = message.userId === me.id;
              return own ? (
                <div key={message.id} className="flex justify-end">
                  <div className="flex max-w-bubble-system flex-col items-end">
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-caption text-night-muted">{time12Label(message.createdAt)}</span>
                      <span className="text-caption font-bold text-pitch">Tú</span>
                    </div>
                    <p className={cn(
                      "whitespace-pre-wrap break-words rounded-md rounded-tr-xs bg-pitch px-3 py-2 text-body text-pitch-on",
                      message.pending && "opacity-70",
                    )}>
                      {message.body}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex items-start gap-2">
                  <UserAvatar name={message.name} avatar={message.avatar ?? undefined} size="sm" />
                  <div className="flex min-w-0 max-w-bubble-system flex-col">
                    <div className="mb-1 flex flex-wrap items-baseline gap-2">
                      <span className="text-caption font-bold text-night-text">{message.name}</span>
                      {message.userId === match.organizerId && (
                        <NightBadge tone="pitch" size="sm" className="uppercase">Organizador</NightBadge>
                      )}
                      <span className="text-caption text-night-muted">{time12Label(message.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words rounded-md rounded-tl-xs bg-night-high px-3 py-2 text-body text-night-text">
                      {message.body}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-night-high p-3">
          <NightInput shape="pill" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="Comenta algo a la gente…" aria-label="Mensaje para el equipo" className="min-w-0 flex-1" />
          <NightIconButton type="submit" tone="pitch" aria-label="Enviar mensaje" disabled={!draft.trim() || send.isPending}>
            <Send className="size-icon-lg" aria-hidden />
          </NightIconButton>
        </form>
      </section>

      <GuestNamesDialog
        open={needsNames && !namesDismissed}
        count={minePlayer?.guests ?? 0}
        initial={minePlayer?.guestNames}
        onCancel={() => setNamesDismissed(true)}
        onConfirm={(names) => saveNames.mutate(names)}
      />

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="border-night-highest bg-night text-night-text">
          <DialogHeader>
            <DialogTitle className="text-night-text">Reglamento del encuentro</DialogTitle>
            <DialogDescription className="text-night-muted">Reglas de la pichanga de {match.venue.name}.</DialogDescription>
          </DialogHeader>
          <RuleList startsAt={match.startsAt} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

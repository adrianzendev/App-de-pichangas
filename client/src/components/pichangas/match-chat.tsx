import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Globe, MessageSquare, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatPanel } from "@/components/pichangas/chat-panel";
import { NightBadge } from "@/components/pichangas/night-ui";
import { cn } from "@/lib/utils";
import { PLAY_ROUTES } from "@/lib/routes";
import { dayLabel, spotsLeft, timeRange12, useMatch } from "@/lib/pichangas";

type ChatUser = { id: string; name: string; avatar?: string | null };

interface MatchChatProps {
  matchId: string;
  me: ChatUser;
  /** Ocupa todo el alto de su contenedor (pagina de Chats); si no, la lista de mensajes tiene alto propio. */
  fill?: boolean;
}

// Chat del equipo de UNA pichanga: lo leen y escriben solo quienes tienen cupo (confirmado y pagado) y el organizador.
export function MatchChat({ matchId, me, fill }: MatchChatProps) {
  const { data: match } = useMatch(matchId);
  if (!match) return <Skeleton className={cn("w-full bg-night-container", fill ? "h-full min-h-64" : "h-64")} />;

  // Tiene cupo: confirmado y pagado (o es el organizador). Igual que el servidor: suplentes y reservas sin pagar no entran.
  const isMember = match.organizerId === me.id || match.players.some((p) => p.userId === me.id && p.status === "confirmed" && p.paid);
  const cancelled = match.status === "cancelled";
  const finished = match.status === "finished";
  const left = spotsLeft(match);
  const confirmedPlayers = match.players.filter((p) => p.status === "confirmed");
  const waitlistCount = match.players.filter((p) => p.status === "waitlist").length;

  return (
    <ChatPanel
      path={`/api/matches/${matchId}/messages`}
      me={me}
      enabled={isMember}
      organizerId={match.organizerId}
      fill={fill}
      ariaLabel="Chat del equipo"
      header={
        <>
          {/* Nombre y hora del partido: al tocarlos se abre el partido. */}
          <Link href={PLAY_ROUTES.match(match)} aria-label={`Ver el partido ${match.title}`} className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch">
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-pitch/15 text-pitch" aria-hidden>
              <MessageSquare className="size-icon-lg" />
              {!cancelled && !finished && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-pitch ring-2 ring-night-high" />}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-label font-bold text-night-text">{match.title}</h2>
              <p className="truncate text-caption text-night-muted">{dayLabel(match.startsAt)} · {timeRange12(match.startsAt, match.durationMinutes)}</p>
              <p className="flex items-center gap-1 text-caption text-pitch">
                <Users className="size-icon-sm" aria-hidden />
                {confirmedPlayers.length} {confirmedPlayers.length === 1 ? "pelotero anotado" : "peloteros anotados"}
                {waitlistCount > 0 && ` · ${waitlistCount} en espera`}
              </p>
            </div>
          </Link>
          {!fill && (
            <NightBadge tone="muted" size="sm" className="shrink-0">
              {left === 0 ? "Completo" : left === 1 ? "Falta 1 cupo" : `Faltan ${left} cupos`}
            </NightBadge>
          )}
        </>
      }
    />
  );
}

/** Usuario actual para los chats abiertos (los monta quien aun no tiene el usuario a mano). */
function useChatUser(): ChatUser | undefined {
  const { data } = useQuery<(ChatUser & { avatar?: string | null }) | null>({ queryKey: ["/api/user/current"] });
  return data ?? undefined;
}

/** Chat general: lo ven y escriben todos los jugadores con sesion. */
export function GeneralChat({ me, fill }: { me: ChatUser; fill?: boolean }) {
  return (
    <ChatPanel
      path="/api/chat/general"
      me={me}
      fill={fill}
      ariaLabel="Chat general"
      emptyTitle="Todavía no hay mensajes"
      emptyHint="Aquí hablan todos los jugadores: busca gente para armar una pichanga."
      placeholder="Escribe a todos los jugadores…"
      header={
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pitch/15 text-pitch" aria-hidden>
            <Globe className="size-icon-lg" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-label font-bold text-night-text">Chat general</h2>
            <p className="truncate text-caption text-night-muted">Todos los jugadores de Pinkiball</p>
          </div>
        </div>
      }
    />
  );
}

/** Preguntas al organizador de un partido: abierto a cualquier jugador, aunque aun no tenga cupo. */
export function MatchQuestions({ matchId, organizerId }: { matchId: string; organizerId: string }) {
  const me = useChatUser();
  if (!me) return null;
  return (
    <ChatPanel
      path={`/api/matches/${matchId}/questions`}
      me={me}
      organizerId={organizerId}
      ariaLabel="Preguntas al organizador"
      emptyTitle="Aún no hay preguntas"
      emptyHint="Pregunta lo que quieras saber antes de reservar: nivel, cancha, arcos."
      placeholder="Pregunta al organizador…"
      header={<h2 className="truncate text-label font-bold text-night-text">Preguntas antes de reservar</h2>}
    />
  );
}

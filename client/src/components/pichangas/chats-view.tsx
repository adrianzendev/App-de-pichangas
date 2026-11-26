import { useMemo } from "react";
import { useLocation } from "wouter";
import { Globe, MessageSquare } from "lucide-react";
import { GeneralChat, MatchChat } from "@/components/pichangas/match-chat";
import { NightBackLink, NightListRow } from "@/components/pichangas/night-controls";
import { NightEmpty, PitchButton } from "@/components/pichangas/night-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAY_ROUTES } from "@/lib/routes";
import { dayLabel, timeRange12, useMyMatches, type MatchSummary } from "@/lib/pichangas";

interface ChatsViewProps {
  /** Id (corto) del partido abierto, o "general"; sin id, en escritorio se abre el primero y en movil se ve la lista. */
  selectedId?: string;
  me: { id: string; name: string; avatar?: string | null };
  isDesktop: boolean;
}

// Pestaña "Chats": el chat general (todos los jugadores) y un chat por pichanga (solo para quienes tienen cupo).
export function ChatsView({ selectedId, me, isDesktop }: ChatsViewProps) {
  const [, setLocation] = useLocation();
  const { data: all = [], isLoading, isError, refetch } = useMyMatches();

  // Proximos primero (el mas cercano arriba) y luego los pasados (el mas reciente arriba). Los cancelados no tienen chat.
  const chats = useMemo(() => {
    const now = Date.now();
    const mine = all.filter((m) => m.status !== "cancelled" && (m.playerPaid || m.organizerId === me.id));
    const upcoming = mine.filter((m) => new Date(m.startsAt).getTime() >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const past = mine.filter((m) => new Date(m.startsAt).getTime() < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return [...upcoming, ...past];
  }, [all, me.id]);

  const generalOpen = selectedId === "general";
  const selected = generalOpen ? undefined : (selectedId ? chats.find((m) => m.id.startsWith(selectedId)) : undefined) ?? (isDesktop && !selectedId ? chats[0] : undefined);
  // Sin ningun partido, en escritorio se abre el chat general.
  const showGeneral = generalOpen || (isDesktop && !selected && !isLoading);
  const hasChatOpen = showGeneral || !!selected;

  const list = (
    <ul className="space-y-1" aria-label="Chats">
      <li>
        <NightListRow active={showGeneral} icon={<Globe className="size-icon-lg" />} title="Chat general" subtitle="Todos los jugadores" onClick={() => setLocation(PLAY_ROUTES.chatGeneral)} />
      </li>
      {chats.map((m: MatchSummary) => {
        const on = selected?.id === m.id;
        return (
          <li key={m.id}>
            <NightListRow active={on} icon={<MessageSquare className="size-icon-lg" />} title={m.title} subtitle={`${dayLabel(m.startsAt)} · ${timeRange12(m.startsAt, m.durationMinutes)}`} onClick={() => setLocation(PLAY_ROUTES.chat(m))} />
          </li>
        );
      })}
    </ul>
  );

  const chat = showGeneral
    ? <GeneralChat me={me} fill />
    : selected && <MatchChat key={selected.id} matchId={selected.id} me={me} fill />;

  let body;
  if (isLoading && !generalOpen) {
    body = (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-16 w-full bg-night-container" />
        <Skeleton className="h-16 w-full bg-night-container" />
      </div>
    );
  } else if (isError && !generalOpen) {
    body = <NightEmpty icon={<MessageSquare className="size-icon-empty" />} title="No pudimos cargar tus chats" action={<PitchButton onClick={() => refetch()}>Reintentar</PitchButton>} />;
  } else if (isDesktop) {
    body = (
      <div className="flex min-h-0 flex-1 gap-6">
        <div className="w-80 shrink-0 overflow-y-auto">{list}</div>
        <div className="min-w-0 flex-1">{chat}</div>
      </div>
    );
  } else if (hasChatOpen) {
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <NightBackLink label="Volver a mis chats" onClick={() => setLocation(PLAY_ROUTES.chats)} />
        <div className="min-h-0 flex-1">{chat}</div>
      </div>
    );
  } else {
    body = list;
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 px-page-h py-4 lg:h-dvh lg:px-0 lg:py-6">
      <h1 className="text-heading font-bold text-night-text">Chats</h1>
      {body}
    </div>
  );
}

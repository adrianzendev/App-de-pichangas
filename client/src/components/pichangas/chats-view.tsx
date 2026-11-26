import { useMemo } from "react";
import { useLocation } from "wouter";
import { Globe, MessageSquare } from "lucide-react";
import { GeneralChat, MatchChat } from "@/components/pichangas/match-chat";
import { NightBackLink, NightListRow } from "@/components/pichangas/night-controls";
import { NightEmpty, PitchButton } from "@/components/pichangas/night-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PLAY_ROUTES } from "@/lib/routes";
import { coverOf, coverPhotos, dayLabel, time12Label, useChatPreviews, useMyMatches, type ChatPreview, type MatchSummary } from "@/lib/pichangas";

interface ChatsViewProps {
  /** Id (corto) del partido abierto, o "general"; sin id, en escritorio se abre el primero y en movil se ve la lista. */
  selectedId?: string;
  me: { id: string; name: string; avatar?: string | null };
  isDesktop: boolean;
}

/** Vista previa como en cualquier chat: "Tú: texto" o "Nombre: texto"; sin mensajes, `empty`. */
function previewText(p: ChatPreview | null | undefined, meId: string, empty: string): string {
  if (!p) return empty;
  return `${p.userId === meId ? "Tú" : p.name.split(" ")[0]}: ${p.body}`;
}
/** Hora del ultimo mensaje si es de hoy; si no, el dia. Sin mensajes, undefined (la fila muestra el dia y la hora del partido). */
function previewTime(p: ChatPreview | null | undefined) {
  if (!p) return undefined;
  const d = new Date(p.createdAt);
  return d.toDateString() === new Date().toDateString() ? time12Label(p.createdAt) : dayLabel(p.createdAt);
}

// Pestaña "Chats": el chat general (todos los jugadores) y un chat por pichanga (solo para quienes tienen cupo).
export function ChatsView({ selectedId, me, isDesktop }: ChatsViewProps) {
  const [, setLocation] = useLocation();
  const { data: all = [], isLoading, isError, refetch } = useMyMatches();
  const { data: previews } = useChatPreviews();

  // Proximos primero (el mas cercano arriba) y luego los pasados (el mas reciente arriba). Los cancelados no tienen chat.
  const chats = useMemo(() => {
    const now = Date.now();
    const mine = all.filter((m) => m.status !== "cancelled" && (m.playerPaid || m.organizerId === me.id));
    const upcoming = mine.filter((m) => new Date(m.startsAt).getTime() >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const past = mine.filter((m) => new Date(m.startsAt).getTime() < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    // Como en cualquier app de chat: arriba los que tienen actividad reciente; sin mensajes, por fecha del partido.
    const last = (m: MatchSummary) => previews?.matches[m.id]?.createdAt ?? "";
    const withMsg = [...upcoming, ...past].filter((m) => last(m)).sort((a, b) => last(b).localeCompare(last(a)));
    return [...withMsg, ...[...upcoming, ...past].filter((m) => !last(m))];
  }, [all, me.id, previews]);

  const generalOpen = selectedId === "general";
  const selected = generalOpen ? undefined : (selectedId ? chats.find((m) => m.id.startsWith(selectedId)) : undefined) ?? (isDesktop && !selectedId ? chats[0] : undefined);
  // Sin ningun partido, en escritorio se abre el chat general.
  const showGeneral = generalOpen || (isDesktop && !selectedId && !selected && !isLoading);
  // Una URL de chat que no es tuya (no pagaste ese partido, se cancelo): se avisa, no se muestra otro chat bajo esa URL.
  const notAvailable = !!selectedId && !generalOpen && !selected && !isLoading;
  const hasChatOpen = showGeneral || !!selected || notAvailable;
  // Movil con un chat abierto: el chat usa toda la altura (la cabecera y la barra inferior se ocultan en el armazon).
  const mobileChatOpen = !isDesktop && hasChatOpen;

  const list = (
    <ul className="space-y-1" aria-label="Chats">
      <li>
        <NightListRow active={showGeneral} icon={<Globe className="size-icon-lg" />} title="Chat general" subtitle={previewText(previews?.general, me.id, "Todos los jugadores")} metaBottom={previewTime(previews?.general)} onClick={() => setLocation(PLAY_ROUTES.chatGeneral)} />
      </li>
      {chats.map((m: MatchSummary) => {
        const on = selected?.id === m.id;
        return (
          <li key={m.id}>
            <NightListRow active={on} icon={<img src={coverPhotos(m)[0] || coverOf(m.venue)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />} title={m.title} subtitle={previewText(previews?.matches[m.id], me.id, "Aún sin mensajes")} meta={`${dayLabel(m.startsAt)} · ${time12Label(m.startsAt)}`} metaBottom={previewTime(previews?.matches[m.id])} onClick={() => setLocation(PLAY_ROUTES.chat(m))} />
          </li>
        );
      })}
    </ul>
  );

  const chat = notAvailable
    ? <NightEmpty icon={<MessageSquare className="size-icon-empty" />} title="Ese chat no está disponible" description="Solo ves los chats de las pichangas que reservaste y pagaste." />
    : showGeneral
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
    <div className={cn("flex flex-col gap-4 px-page-h py-4 lg:h-dvh lg:px-0 lg:py-6", mobileChatOpen ? "h-dvh" : "min-h-dvh")}>
      {!mobileChatOpen && <h1 className="text-heading font-bold text-night-text">Chats</h1>}
      {body}
    </div>
  );
}

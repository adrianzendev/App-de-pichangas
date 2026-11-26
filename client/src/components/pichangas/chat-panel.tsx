import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { NightIconButton, NightInput } from "@/components/pichangas/night-controls";
import { NightBadge } from "@/components/pichangas/night-ui";
import { NoMessagesIcon } from "@/components/pichangas/no-matches-icon";
import { surfaceClass } from "@/components/pichangas/surface";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { time12Label, useChatMessages, useSendChatMessage, type MatchMessage } from "@/lib/pichangas";

export interface ChatPanelProps {
  /** Endpoint del chat (GET lista, POST envia): el del equipo, el general o las preguntas de un partido. */
  path: string;
  me: { id: string; name: string; avatar?: string | null };
  /** Cabecera de la tarjeta (nombre del chat, datos del partido...). */
  header: ReactNode;
  ariaLabel: string;
  /** Si es false no se consulta el chat (p. ej. quien no tiene cupo en el chat del equipo). */
  enabled?: boolean;
  /** Los mensajes de esta persona llevan la insignia "Organizador". */
  organizerId?: string;
  /** Ocupa todo el alto de su contenedor (pagina de Chats); si no, la lista de mensajes tiene alto propio. */
  fill?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  placeholder?: string;
}

// Tarjeta de chat: cabecera + mensajes + caja de envio. UN solo origen para el chat del equipo, el chat general y las preguntas.
export function ChatPanel({
  path, me, header, ariaLabel, enabled = true, organizerId, fill,
  emptyTitle = "Todavía no hay mensajes", emptyHint = "Saluda y coordinen la llegada al camerino.", placeholder = "Comenta algo a la gente…",
}: ChatPanelProps) {
  const { data: messages, isLoading } = useChatMessages(path, enabled);
  const send = useSendChatMessage(path, me);
  const [draft, setDraft] = useState("");
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, path]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft("");
    send.mutate(body, {
      onError: (error) => toast({ variant: "destructive", title: "No se pudo enviar", description: error instanceof Error ? error.message : undefined }),
    });
  };

  return (
    <section className={cn(surfaceClass(), "flex flex-col overflow-hidden", fill && "h-full")} aria-label={ariaLabel}>
      <header className="flex items-center justify-between gap-3 bg-night-high px-3 py-3">{header}</header>

      <div ref={streamRef} className={cn("space-y-3 overflow-y-auto p-3", fill ? "min-h-0 flex-1" : "max-h-80 min-h-40")}>
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-14 w-3/4 bg-night-high" />
            <Skeleton className="ml-auto h-12 w-2/3 bg-night-high" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <NoMessagesIcon />
            <p className="text-body font-semibold text-night-text">{emptyTitle}</p>
            <p className="text-caption text-night-muted">{emptyHint}</p>
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
                    {organizerId && message.userId === organizerId && (
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
        <NightInput shape="pill" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder={placeholder} aria-label="Escribir mensaje" className="min-w-0 flex-1" />
        <NightIconButton type="submit" tone="pitch" aria-label="Enviar mensaje" disabled={!draft.trim() || send.isPending}>
          <Send className="size-icon-lg" aria-hidden />
        </NightIconButton>
      </form>
    </section>
  );
}

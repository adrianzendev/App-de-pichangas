import { useEffect, useState } from "react";
import { ROUTES, TAB } from "@/lib/routes";
import { chatPreviewText, chatAttachmentKind, type AttachmentKind } from "@shared/chat-preview";
import { FileText, Image as ImageIcon, MessageCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chatPollInterval } from "@/lib/impersonation";
import { useLocation } from "wouter";
import { ListScreen } from "@/components/ui/list-screen";
import { FilterPills } from "@/components/ui/filter-pills";
import { ListHeader } from "@/components/ui/list-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatListRow } from "@/components/chat/chat-list-row";
import { generateStudentAlias } from "@/utils/student-anonymization";
import { useWebSocketFixed } from "@/hooks/useWebSocketFixed";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useTypingPeers } from "@/components/chat/use-typing-indicator";
import type { UserWithType } from "@shared/schema";
import { fmtListDate } from "@/lib/date-format";
import { MESSAGES_SPLIT_QUERY } from "@/lib/layout-queries";
import { prefetchThreadMessages, scheduleIdle } from "@/lib/chat-queries";

// Hilos mas recientes cuyos mensajes se precargan en segundo plano.
const PREFETCH_THREADS = 5;

// Compartido entre TODAS las instancias montadas de MessagesSection. home.tsx monta una sola por
// viewport (useMediaQuery: MessagesDesktopSplit en escritorio, esta lista sola en movil/tablet), pero
// cada instancia registra su propio listener de 'websocket_message' y todas leen y escriben la MISMA
// cache de react-query: si alguna vez conviven dos, un mismo 'new_message' subiria unreadCount +1 por
// instancia. Dedupe por id de mensaje, no por instancia (red de seguridad).
const processedNewMessageIds = new Set<string>();

// Subset del pedido ancla (ver toSendableTaskPreview en server/routes.ts).
export interface SendableTaskPreview {
  id: string;
  title: string;
  description: string;
  currency: string | null;
  budget: string | null;
  deadline: string;
  status: string;
  assignedTutorId: string | null;
}

export interface ChatThreadSummary {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  /** Ultima conexion del otro usuario: el header del chat la pinta al instante, sin esperar otra consulta. */
  otherUserLastSeen?: string | null;
  /** Cuenta del otro usuario pausada/suspendida: el chat muestra aviso y no deja escribir. */
  otherUserInactive?: boolean;
  lastMessage: string | null;
  // Tipo del adjunto del ultimo mensaje (null = sin adjunto): decide el icono.
  lastMessageKind: AttachmentKind | null;
  lastMessageAt: string | null;
  unreadCount: number;
  sendableTaskId: string | null;
  sendableTask: SendableTaskPreview | null;
}

interface MessagesSectionProps {
  // Split-view desktop (ver messages-desktop-split.tsx): si vienen, tocar
  // un hilo selecciona en vez de navegar, y se resalta el hilo activo.
  onSelectThread?: (thread: ChatThreadSummary, displayName: string) => void;
  selectedThreadId?: string;
}

function formatThreadTime(iso: string | null): string {
  if (!iso) return "";
  return fmtListDate(iso);
}

// Hilo continuo por par estudiante-tutor (independiente del pedido).
// Pestaña principal del bottom nav para ambos roles — ver plan de migracion
// order-centric -> user-centric, fases estudiante y tutor.
type ThreadFilter = "todos" | "no-leidos";
const THREAD_FILTERS: { id: ThreadFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "no-leidos", label: "No leídos" },
];

export default function MessagesSection({ onSelectThread, selectedThreadId }: MessagesSectionProps = {}) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("todos");

  const { data: currentUser } = useQuery<UserWithType>({
    queryKey: ["/api/user/current"],
  });
  const isTutorViewer = currentUser?.userType === "tutor";

  const { data: threads, isLoading, isError, refetch } = useQuery<ChatThreadSummary[]>({
    queryKey: ["/api/chat/threads"],
    refetchInterval: () => chatPollInterval(false),
    refetchIntervalInBackground: false,
  });

  // Precarga en idle de los mensajes de los hilos mas recientes: al abrirlos,
  // chat-fullscreen.tsx encuentra la cache llena (misma key, chat-queries.ts)
  // y no muestra spinner. Depende de los ids, no de `threads`: los parches
  // de WS cambian el array en cada mensaje y no deben relanzar la precarga.
  // Secuencial para no competir con el resto de la red. prefetchQuery nunca
  // lanza y salta hilos con cache fresca.
  const prefetchIds = (threads || []).slice(0, PREFETCH_THREADS).map((t) => t.id).join(",");
  useEffect(() => {
    if (!prefetchIds) return;
    let cancelled = false;
    const cancelIdle = scheduleIdle(async () => {
      for (const id of prefetchIds.split(",")) {
        if (cancelled) return;
        await prefetchThreadMessages(id);
      }
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [prefetchIds]);

  // useWebSocketFixed es el UNICO hook de WS autorizado (singleton, ver su
  // comentario en hooks/useWebSocketFixed.ts): no cierra la conexion ni
  // manda 'presence_leaving' cuando la pestaña pierde foco, a diferencia
  // del hook viejo ya borrado que rompia la entrega en tiempo real al
  // receptor (SESSION_STATE.md fix #5). No reemplazar por otro hook de WS.
  const { onlineUsers } = useWebSocketFixed(currentUser?.id);
  // Quien esta redactando ahora: reemplaza el preview del ultimo mensaje por "Escribiendo...".
  const typingPeers = useTypingPeers();

  // Empuje cross-tab/cross-dispositivo: el servidor manda 'messages_read'
  // (a este mismo usuario y al otro participante) cuando se marca leido en
  // OTRA pestaña/dispositivo con esta misma cuenta — sin esto, el globo
  // solo se actualizaba en la pestaña donde se hizo click (Ronda 13).
  const queryClient = useQueryClient();
  useEffect(() => {
    const meId = currentUser?.id;
    if (!meId) return;
    const handleWsMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg?.type === 'messages_read' && msg.readByUserId === meId) {
        queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"], exact: true });
      }
      // Preview en vivo cuando esta vista NO tiene el chat abierto (chat-fullscreen.tsx
      // cubre el caso con chat abierto via su propio patch, ver su comentario ~linea 895).
      // REGLA (misma que chat-fullscreen.tsx): setQueryData sincronico
      // ANTES de invalidateQueries, nunca al reves ni solo invalidate. El
      // mensaje ya viene completo en msg.message — parchear el cache
      // directo evita la carrera de red de 2 invalidaciones casi
      // simultaneas (esta y la de chat-fullscreen si tambien esta montado)
      // resolviendo en orden distinto y pisando el dato mas nuevo con uno
      // viejo (bug ya documentado en SESSION_STATE.md fix #4). invalidate
      // se mantiene solo de respaldo, DESPUES, para que el server corrija
      // el unreadCount real.
      if (msg?.type === 'new_message' && msg.senderId !== meId && msg.message?.threadId) {
        // Dedupe: ver comentario de processedNewMessageIds arriba. Sin
        // esto, la otra instancia montada de MessagesSection ya conto
        // este mismo mensaje.
        if (processedNewMessageIds.has(msg.message.id)) return;
        processedNewMessageIds.add(msg.message.id);
        if (processedNewMessageIds.size > 500) processedNewMessageIds.clear();

        queryClient.setQueryData(
          ["/api/chat/threads"],
          (old: ChatThreadSummary[] | undefined) => {
            if (!old) return old;
            const idx = old.findIndex((t) => t.id === msg.message.threadId);
            if (idx === -1) return old;
            // Hilo ya abierto en el panel de al lado (split-view desktop):
            // el usuario lo esta leyendo en vivo, no cuenta como no-leido.
            const isActiveThread = msg.message.threadId === selectedThreadId;
            const updated = {
              ...old[idx],
              lastMessage: chatPreviewText(msg.message.message, msg.message.attachments, msg.message.attachmentNames),
              lastMessageKind: chatAttachmentKind(msg.message.attachments, msg.message.attachmentNames),
              lastMessageAt: msg.message.createdAt,
              unreadCount: isActiveThread ? 0 : (old[idx].unreadCount || 0) + 1,
            };
            return [updated, ...old.filter((_, i) => i !== idx)];
          }
        );
        // Hilo abierto: chat-fullscreen lo marca leido e invalida DESPUES del
        // POST; invalidar aqui traeria unreadCount=1 del server y pegaria el badge.
        if (msg.message.threadId !== selectedThreadId) queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"], exact: true });
      }
    };
    window.addEventListener('websocket_message', handleWsMessage);
    return () => window.removeEventListener('websocket_message', handleWsMessage);
  }, [currentUser?.id, queryClient, selectedThreadId]);

  // El tutor no ve el nombre real del alumno, igual que en el resto de la
  // app (chat-fullscreen.tsx, chat-section.tsx) — solo un alias por privacidad.
  const displayName = (thread: ChatThreadSummary) =>
    isTutorViewer ? generateStudentAlias(thread.otherUserId) : thread.otherUserName;

  const filteredThreads = (threads || []).filter((thread) => {
    if (threadFilter === "no-leidos" && thread.unreadCount <= 0) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      displayName(thread).toLowerCase().includes(query) ||
      (thread.lastMessage || "").toLowerCase().includes(query)
    );
  });

  const chatFullscreenUrl = (thread: ChatThreadSummary) =>
    `${ROUTES.chatFullscreen}?threadId=${thread.id}&userId=${thread.otherUserId}&userName=${encodeURIComponent(displayName(thread))}&from=${TAB.messages}`;

  const openThread = (thread: ChatThreadSummary) => {
    if (onSelectThread) {
      onSelectThread(thread, displayName(thread));
      return;
    }
    setLocation(chatFullscreenUrl(thread));
  };

  // Llegada desde "Chatear" en el perfil de un tutor en mobile/tablet (sin onSelectThread,
  // sin panel de detalle propio):
  //  - /messages?threadId=X -> abre ese hilo en /chat-fullscreen, como si el usuario lo tocara.
  //  - /messages?userId=X&userName=Y (sin hilo todavia, primer mensaje a ese tutor) -> si el hilo ya
  //    aparece en la lista lo abre; si no, abre /chat-fullscreen en modo borrador. Antes este caso
  //    no hacia nada en mobile: solo el split de escritorio (messages-desktop-split.tsx) lo manejaba.
  // Se navega con replace para que "atras" no vuelva a este deep link y rebote. Guard de viewport:
  // en escritorio lo resuelve messages-desktop-split.tsx (que monta esta lista con onSelectThread);
  // el guard de viewport evita que una instancia de la lista navegue fuera de /messages en escritorio.
  useEffect(() => {
    if (onSelectThread || !threads) return;
    if (window.matchMedia(MESSAGES_SPLIT_QUERY).matches) return;
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get("threadId");
    const userId = params.get("userId");

    const thread = threadId
      ? threads.find(t => t.id === threadId)
      : userId ? threads.find(t => t.otherUserId === userId) : undefined;
    if (thread) {
      setLocation(chatFullscreenUrl(thread), { replace: true });
      return;
    }
    if (threadId || !userId) return; // hilo pedido aun no esta en la lista: se reintenta al refrescarla

    const draft = new URLSearchParams({ userId, userName: params.get("userName") || "Usuario", from: "mensajes" });
    const taskId = params.get("taskId");
    if (taskId) draft.set("taskId", taskId);
    setLocation(`${ROUTES.chatFullscreen}?${draft.toString()}`, { replace: true });
  }, [threads, onSelectThread]);

  return (
    <div className="min-h-full bg-white">
      <ListScreen compact>
        {/* Mensajes sin banner: titulo, buscador y filtros directamente (lista estilo WhatsApp) */}
        {/* Mismo encabezado que Pedidos y Tutores; la lupa despliega el buscador tambien en la columna del split de escritorio. */}
        <ListHeader
          title="Mensajes"
          className="gap-section-gap px-1 sm:px-0 lg:pr-4"
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: isTutorViewer ? "Buscar alumno o mensaje…" : "Buscar tutor o mensaje…",
            label: "Buscar conversación",
            testId: "search-messages",
          }}
        >
          <FilterPills options={THREAD_FILTERS} value={threadFilter} onChange={setThreadFilter} />
        </ListHeader>

        {isLoading ? (
          <div className="-mx-card-gap flex flex-col">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-card-pad">
                <Skeleton className="size-avatar-mdl shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-skeleton-line w-skeleton-name-w" />
                  <Skeleton className="h-skeleton-meta-h w-skeleton-meta-w" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            centered
            title="No pudimos cargar tus conversaciones"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={<Button onClick={() => refetch()}>Reintentar</Button>}
          />
        ) : !threads || threads.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Sin conversaciones aún"
            description={
              isTutorViewer
                ? "Cuando converses con un alumno, la conversación aparecerá aquí."
                : "Cuando converses con un tutor, la conversación aparecerá aquí."
            }
          />
        ) : filteredThreads.length === 0 ? (
          <EmptyState title={searchQuery.trim() ? `No encontramos "${searchQuery}"` : "No tienes mensajes sin leer"} />
        ) : (
          // Filas a todo el ancho de la columna (sangran al borde con -mx-card-gap, el padding de ListScreen compact, tambien en escritorio:
          // llenan las 3 columnas del split) sin divisor.
          <div className="-mx-card-gap flex flex-col">
            {filteredThreads.map((thread) => (
              <ChatListRow
                key={thread.id}
                name={displayName(thread)}
                avatar={thread.otherUserAvatar}
                userId={thread.otherUserId}
                isOnline={onlineUsers.has(thread.otherUserId)}
                time={formatThreadTime(thread.lastMessageAt)}
                unreadCount={thread.unreadCount}
                selected={selectedThreadId === thread.id}
                onClick={() => openThread(thread)}
                onPointerEnter={() => prefetchThreadMessages(thread.id)}
                onTouchStart={() => prefetchThreadMessages(thread.id)}
                data-testid={`message-thread-${thread.id}`}
                preview={
                  typingPeers.has(thread.otherUserId) ? (
                    <TypingIndicator variant="label" />
                  ) : (
                    <>
                      {thread.lastMessageKind === "image" && <ImageIcon className="size-icon-md mr-1 shrink-0" />}
                      {thread.lastMessageKind === "file" && <FileText className="size-icon-md mr-1 shrink-0" />}
                      <span className="truncate">{thread.lastMessage || "Sin mensajes aún"}</span>
                    </>
                  )
                }
              />
            ))}
          </div>
        )}
      </ListScreen>
    </div>
  );
}

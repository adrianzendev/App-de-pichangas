import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuery } from "@tanstack/react-query";
import MessagesSection, { type ChatThreadSummary } from "@/components/sections/messages-section";
import ChatFullscreenWorking from "@/pages/chat-fullscreen";
import { ChatSplitLayout } from "@/components/layout/chat-split-layout";
import { generateStudentAlias } from "@/utils/student-anonymization";
import type { UserWithType } from "@shared/schema";

// Layout de dos columnas para Mensajes en desktop (lg:, >=1024px) — ver
// design_guidelines.md seccion 7 (breakpoints). En mobile/tablet se sigue
// usando <MessagesSection /> sola, que navega a /chat-fullscreen (home.tsx
// decide cual de las dos renderizar segun el breakpoint).
export default function MessagesDesktopSplit() {
  const [selectedThread, setSelectedThread] = useState<{
    thread: ChatThreadSummary;
    displayName: string;
  } | null>(null);

  // "Borrador": usuario objetivo sin thread todavia (llegada desde
  // "Chatear" en un perfil de tutor sin conversacion previa — no se crea
  // fila en chat_threads hasta el primer mensaje real, ver server/routes.ts
  // POST /api/chat/get-or-create). Se promueve a selectedThread solo
  // cuando el thread real aparece en la lista (mas abajo).
  const [draftTarget, setDraftTarget] = useState<{ userId: string; userName: string; taskId?: string } | null>(null);

  // Llegada desde "Chatear" en el perfil de un tutor (/messages?threadId=X):
  // auto-selecciona ese hilo en cuanto la lista carga, en vez de dejar el
  // panel derecho vacio esperando un click.
  const { data: currentUser } = useQuery<UserWithType>({ queryKey: ["/api/user/current"] });
  const { data: threads } = useQuery<ChatThreadSummary[]>({ queryKey: ["/api/chat/threads"] });
  useEffect(() => {
    if (selectedThread || !threads) return;
    const threadId = new URLSearchParams(window.location.search).get("threadId");
    if (!threadId) return;
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;
    const displayName = currentUser?.userType === "tutor"
      ? generateStudentAlias(thread.otherUserId)
      : thread.otherUserName;
    setSelectedThread({ thread, displayName });
  }, [threads, selectedThread, currentUser?.userType]);

  // Llegada desde "Chatear"/"Mensaje" SIN conversacion previa
  // (/messages?userId=X&userName=Y, sin threadId): arma el borrador.
  // Simetrico al efecto de arriba, solo corre si no vino threadId.
  useEffect(() => {
    if (selectedThread || draftTarget) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("threadId")) return;
    const userId = params.get("userId");
    if (!userId) return;
    const userName = params.get("userName") || "Usuario";
    const taskId = params.get("taskId") || undefined;
    setDraftTarget({ userId, userName, taskId });
  }, [selectedThread, draftTarget]);

  // Promover: el thread real ya existe (se creo al enviar el primer
  // mensaje, storage.sendMessage) — aparece en la lista via el
  // invalidateQueries(["/api/chat/threads"]) que ya dispara el envio.
  useEffect(() => {
    if (!draftTarget || !threads) return;
    const thread = threads.find(t => t.otherUserId === draftTarget.userId);
    if (!thread) return;
    const displayName = currentUser?.userType === "tutor"
      ? generateStudentAlias(thread.otherUserId)
      : thread.otherUserName;
    setSelectedThread({ thread, displayName });
    setDraftTarget(null);
  }, [threads, draftTarget, currentUser?.userType]);

  return (
    <ChatSplitLayout
      list={
        <MessagesSection
          onSelectThread={(thread, displayName) => setSelectedThread({ thread, displayName })}
          selectedThreadId={selectedThread?.thread.id}
        />
      }
      detail={
        selectedThread ? (
          <ChatFullscreenWorking
            key={selectedThread.thread.id}
            embedded
            overrideParams={{
              threadId: selectedThread.thread.id,
              userId: selectedThread.thread.otherUserId,
              userName: selectedThread.displayName,
            }}
          />
        ) : draftTarget ? (
          <ChatFullscreenWorking
            key={`draft-${draftTarget.userId}`}
            embedded
            overrideParams={{
              userId: draftTarget.userId,
              userName: draftTarget.userName,
              taskId: draftTarget.taskId,
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center px-6">
            <EmptyState icon={MessageCircle} title="Selecciona una conversación para empezar" />
          </div>
        )
      }
    />
  );
}

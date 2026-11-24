import { useEffect, useRef, useState } from "react";
import { ROUTES, TAB } from "@/lib/routes";
import { Home, FileText, Plus, GraduationCap, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ProfileMenuButton } from "@/components/layout/profile-menu-button";
import { prefetchSection } from "@/lib/section-loaders";
import type { User as UserType, Task } from "@shared/schema";
import { isTaskAvailableForTutor } from "@/utils/task-utils";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userType?: string;
  /** Oculta la barra inferior movil (vistas de detalle de segundo nivel); el sidebar de escritorio no cambia. */
  hideMobileBar?: boolean;
}

export default function BottomNavigation({ activeTab, onTabChange, userType, hideMobileBar }: BottomNavigationProps) {
  const [, setLocation] = useLocation();

  // Publica la altura real de la barra movil (incluye safe-area) como --bottom-nav-height,
  // para que barras de accion fijas se apoyen exactamente encima (ej. /publish).
  const mobileNavRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = mobileNavRef.current;
    if (!el) return;
    // Altura desde la entrada del ResizeObserver (ya medida por el navegador): sin leer offsetHeight,
    // que forzaba un reflow sincrono. El observer dispara una vez al observar, no hace falta publish() inicial.
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      document.documentElement.style.setProperty("--bottom-nav-height", `${h}px`);
    });
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--bottom-nav-height"); };
  }, []);

  // Check if current user is a tutor
  const { data: currentUser } = useQuery<UserType & { userType?: string }>({
    queryKey: ["/api/user/current"],
  });

  const isTutor = userType === "tutor" || currentUser?.userType === "tutor";

  // Get tasks for tutors to calculate unviewed count
  // refetchOnMount: 'always' muestra cache instantáneamente y refresca en background
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: isTutor && !!currentUser,
    refetchInterval: 3 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const { data: viewedData } = useQuery<{ viewedTaskIds: string[] }>({
    queryKey: ["/api/tutor/viewed-tasks"],
    enabled: isTutor && !!currentUser,
    refetchInterval: 3 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  // Calculate unviewed tasks count for tutors
  const getUnviewedTaskCount = () => {
    if (!isTutor || !tasks || !viewedData) return 0;
    const viewedSet = new Set(viewedData.viewedTaskIds || []);
    // Mismo criterio que la lista "Disponibles": sin esto contaba pedidos vencidos que la lista no muestra.
    return tasks.filter(t => isTaskAvailableForTutor(t, currentUser?.id) && !viewedSet.has(t.id)).length;
  };

  const unviewedTaskCount = getUnviewedTaskCount();

  // El badge es secundario: se pide 500 ms despues del primer render para que
  // /api/user/current y el contenido de la pantalla no compitan por conexiones.
  const [badgeReady, setBadgeReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBadgeReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Get unread messages count for chat notification
  const { data: lastMessages } = useQuery({
    queryKey: ["/api/chat/last-messages"],
    enabled: !!currentUser && badgeReady,
    // Respaldo: el WebSocket actualiza el badge al instante; al reconectar se invalida (abajo).
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  // Empuje cross-tab/cross-dispositivo del badge (mismo motivo que
  // messages-section.tsx): sin esto, el numero solo bajaba en la pestaña
  // donde se marco leido, aqui quedaba con el poll de 2 min.
  //
  // useWebSocketFixed es el UNICO hook de WS autorizado (singleton, ver su
  // comentario en hooks/useWebSocketFixed.ts) — este componente no lo
  // llama directamente, pero depende de que ALGUN componente montado lo
  // use para que 'websocket_message' se siga disparando (SESSION_STATE.md
  // fix #5).
  const queryClient = useQueryClient();
  useEffect(() => {
    const meId = currentUser?.id;
    if (!meId) return;
    const handleWsMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg?.type === 'messages_read' && msg.readByUserId === meId) {
        queryClient.invalidateQueries({ queryKey: ["/api/chat/last-messages"] });
      }
      // 3ra ocurrencia del mismo hueco (chat abierto -> sidebar -> nav,
      // ver SESSION_STATE.md fix #5): este badge lee un modelo de datos
      // DISTINTO (/api/chat/last-messages, task-centric, keyado por
      // `${taskId}-${sorted(userId,otro)[0]}-${sorted[1]}`) al que usa
      // messages-section.tsx (/api/chat/threads, user-centric). Sin esta
      // rama, el numero del nav solo subia con el poll de 2 min.
      // REGLA (misma que chat-fullscreen.tsx y messages-section.tsx):
      // setQueryData sincronico ANTES de invalidate, nunca solo invalidate
      // — evita la carrera de red entre invalidaciones casi simultaneas.
      if (msg?.type === 'new_message' && msg.senderId !== meId) {
        // La lista de chats (/api/chat/threads) la parchea messages-section.tsx, pero SOLO
        // mientras esa vista esta montada. Aqui (siempre montado) se marca stale: si la vista
        // esta abierta refetchea ya; si no, refetchea al abrirla en vez de mostrar la cache
        // de hasta 5 min (el hilo no subia ni mostraba el preview/no leido hasta abrir el chat).
        queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"], exact: true });
        // Con pedido: parche optimista (necesita taskId). Mensaje directo: solo el refetch.
        if (msg.taskId) {
          const [a, b] = [meId, msg.senderId].sort();
          const conversationKey = `${msg.taskId}-${a}-${b}`;
          queryClient.setQueryData(
            ["/api/chat/last-messages"],
            (old: Record<string, any> | undefined) => {
              if (!old || !old[conversationKey]) return old; // conversacion nueva: la trae el invalidate de abajo
              return {
                ...old,
                [conversationKey]: {
                  ...old[conversationKey],
                  message: msg.message?.message ?? old[conversationKey].message,
                  timestamp: msg.message?.createdAt ?? old[conversationKey].timestamp,
                  fromCurrentUser: false,
                  unreadCount: (old[conversationKey].unreadCount || 0) + 1,
                },
              };
            }
          );
        }
        // Un solo refetch. Si el chat de esta persona esta abierto, chat-fullscreen
        // (que corre despues) lo cancela y pone unreadCount=0 (clearThreadUnread).
        queryClient.invalidateQueries({ queryKey: ["/api/chat/last-messages"] });
      }
    };
    // Mensajes que llegaron mientras el socket estaba caido.
    const handleReconnect = () => queryClient.invalidateQueries({ queryKey: ["/api/chat/last-messages"] });
    window.addEventListener('websocket_message', handleWsMessage);
    window.addEventListener('websocket_reconnected', handleReconnect);
    return () => {
      window.removeEventListener('websocket_message', handleWsMessage);
      window.removeEventListener('websocket_reconnected', handleReconnect);
    };
  }, [currentUser?.id, queryClient]);

  // Calculate total unread CONVERSATIONS (like WhatsApp)
  const getUnreadCount = () => {
    if (!lastMessages) {
      return 0;
    }
    
    let unreadConversations = 0;
    Object.entries(lastMessages).forEach(([conversationKey, conversation]: [string, any]) => {
      if (conversationKey.includes('-admin-001')) {
        return;
      }
      
      if (conversation.unreadCount !== undefined && 
          conversation.unreadCount !== null && 
          Number(conversation.unreadCount) > 0) {
        unreadConversations += 1;
      }
    });
    
    return unreadConversations;
  };

  const unreadCount = getUnreadCount();

  const handleTabClick = (tab: string) => {
    onTabChange(tab);
    setLocation(tab === TAB.home ? ROUTES.root : `/${tab}`);
  };

  // Define different tabs based on user type
  const getTabs = () => {
    if (isTutor) {
      // Tutors only have Chats and Trabajos (no Inicio)
      return [
        { id: TAB.jobs, label: "Pedidos", icon: FileText, hasNotification: unviewedTaskCount > 0, unreadCount: unviewedTaskCount },
        { id: TAB.messages, label: "Mensajes", icon: MessageCircle, hasNotification: unreadCount > 0, unreadCount },
      ];
    } else {
      return [
        { id: TAB.home, label: "Inicio", icon: Home },
        { id: TAB.messages, label: "Mensajes", icon: MessageCircle, hasNotification: unreadCount > 0, unreadCount },
        { id: TAB.orders, label: "Pedidos", icon: FileText },
        { id: TAB.publish, label: "Publicar", icon: Plus },
        { id: TAB.tutors, label: "Tutores", icon: GraduationCap },
      ];
    }
  };

  const tabs = getTabs();

  return (
    <>
      {/* Mobile / tablet: barra fija abajo (<1024px) */}
      <nav ref={mobileNavRef} aria-label="Navegación principal" className={cn("lg:hidden fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-container bg-white z-sticky", hideMobileBar && "hidden")}>
        <div className="flex items-center justify-around pt-0.5 sm:pt-1 pb-safe-nav">
          {/* Publicar va por el boton flotante (PublishFab) en movil; el sidebar de escritorio si lo muestra. */}
          {tabs.filter((tab) => tab.id !== TAB.publish).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleTabClick(tab.id)}
                onPointerDown={() => prefetchSection(tab.id, isTutor)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center py-2 px-1 sm:py-2 sm:px-5 transition duration-fast active:scale-press relative",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
                  isActive ? "text-gray-900" : "text-gray-700"
                )}
                data-testid={`nav-${tab.id}`}
              >
                <div className="relative mb-0.5 sm:mb-1">
                  <Icon className="size-icon-nav sm:size-6" />
                  {'hasNotification' in tab && tab.hasNotification && 'unreadCount' in tab && (tab.unreadCount as number) > 0 && (
                    <UnreadBadge count={tab.unreadCount as number} size="icon" />
                  )}
                </div>
                <span className={cn("text-caption", isActive ? "font-semibold" : "font-normal")}>
                  {tab.label}
                </span>
              </button>
            );
          })}
          {/* Cuenta: ultimo item de la barra (antes era el avatar de la cabecera movil). Abre la pantalla /account. */}
          <button
            type="button"
            onClick={() => setLocation(ROUTES.account)}
            aria-label="Perfil"
            className="flex min-w-0 flex-1 flex-col items-center py-2 px-1 sm:py-2 sm:px-5 transition duration-fast active:scale-press relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md text-gray-700"
            data-testid="nav-account"
          >
            <div className="relative mb-0.5 sm:mb-1">
              <UserAvatar name={currentUser?.name || "Usuario"} avatar={currentUser?.avatar || undefined} size="xs" />
            </div>
            <span className="text-caption font-normal">Perfil</span>
          </button>
        </div>
      </nav>

      {/* Desktop: barra lateral izquierda (≥1024px) */}
      {/* Escritorio, estilo X: logo arriba, menu, Publicar al final del menu (verde, grande) y la cuenta abajo del todo.
          No hay cabecera de escritorio. */}
      <SidebarNav
        onLogoClick={() => setLocation(ROUTES.root)}
        pill
        profile={<ProfileMenuButton align="left" showName avatarSize="sm" pill />}
        className="w-auto border-0 py-0 px-0 lg:col-span-2 lg:py-6"
        items={[...tabs.filter((tab) => tab.id !== TAB.publish), ...tabs.filter((tab) => tab.id === TAB.publish)].map((tab) => ({
          id: tab.id,
          label: tab.label,
          icon: tab.icon,
          isActive: activeTab === tab.id,
          primary: tab.id === TAB.publish,
          onClick: () => handleTabClick(tab.id),
          onPrefetch: () => prefetchSection(tab.id, isTutor),
          badge: 'hasNotification' in tab && tab.hasNotification && 'unreadCount' in tab && (tab.unreadCount as number) > 0
            ? <UnreadBadge count={tab.unreadCount as number} size="icon" />
            : undefined,
        }))}
      />
    </>
  );
}

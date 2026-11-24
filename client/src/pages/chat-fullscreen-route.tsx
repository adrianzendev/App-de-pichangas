import { useEffect } from "react";
import { ROUTES } from "@/lib/routes";
import { useLocation } from "wouter";
import ChatFullscreen from "@/pages/chat-fullscreen";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MESSAGES_SPLIT_QUERY } from "@/lib/layout-queries";


/**
 * Destino en `/messages` equivalente al chat abierto en `/chat-fullscreen`: el split de
 * escritorio solo entiende `threadId`, o `userId` + `userName` (+ `taskId`) para un borrador.
 */
function desktopMessagesUrl(search: string): string {
  const params = new URLSearchParams(search);
  const threadId = params.get("threadId");
  if (threadId) return `${ROUTES.messages}?threadId=${encodeURIComponent(threadId)}`;
  const userId = params.get("userId");
  if (!userId) return ROUTES.messages;
  const next = new URLSearchParams({ userId, userName: params.get("userName") || "Usuario" });
  const taskId = params.get("taskId");
  if (taskId) next.set("taskId", taskId);
  return `${ROUTES.messages}?${next.toString()}`;
}

/**
 * Ruta `/chat-fullscreen`: el chat a pantalla completa es solo para celular. En escritorio
 * (>= 1024px) o tablet (>= 768px de ancho y >= 600px de alto) redirige, sin dejar la ruta en el historial, a `/messages` con la misma conversacion
 * para mantener el layout de 3 columnas, tanto al entrar/refrescar directo como al ampliar la
 * ventana con el chat ya abierto.
 *
 * @returns {JSX.Element | null} El chat a pantalla completa (movil) o nada mientras redirige.
 */
export default function ChatFullscreenRoute() {
  const isDesktop = useMediaQuery(MESSAGES_SPLIT_QUERY);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isDesktop) setLocation(desktopMessagesUrl(window.location.search), { replace: true });
  }, [isDesktop, setLocation]);

  return isDesktop ? null : <ChatFullscreen />;
}

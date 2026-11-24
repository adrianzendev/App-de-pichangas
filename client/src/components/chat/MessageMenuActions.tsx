import { useRef, type ReactNode } from "react";
import { useLongPress } from "@/hooks/use-long-press";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { MessageMenuTrigger } from "./MessageMenuTrigger";
import { ActionItems, type MenuAction } from "./menu-actions";

export { buildMessageMenuActions, type MenuAction } from "./menu-actions";

/**
 * Propiedades de {@link MessageMenuActions}.
 */
export interface MessageMenuActionsProps {
  /** La burbuja del mensaje (el area sobre la que funciona el clic derecho). */
  children: ReactNode;
  /** Acciones del mensaje (ver `buildMessageMenuActions`). */
  actions: MenuAction[];
  /** No pintar la flecha flotante: la tarjeta del adjunto ya trae la suya (documentos). */
  hideTrigger?: boolean;
  /** La burbuja es una foto: la flecha va sobre la imagen, en blanco. */
  onImage?: boolean;
  /** Mensaje propio: el menu de la flecha se abre a la izquierda; recibido, a la derecha (no invade la lista de chats). */
  isCurrentUser: boolean;
}

/**
 * Menu de acciones de una burbuja de mensaje (estilo WhatsApp). Un solo componente,
 * dos activadores sobre las MISMAS acciones: clic derecho (`ContextMenu` de Radix,
 * sin menu nativo del navegador) y la flecha {@link MessageMenuTrigger} arriba a la
 * derecha (solo al pasar el cursor, en escritorio). En movil la flecha no se muestra y
 * una pulsacion larga (~500 ms) sobre la burbuja abre el mismo menu.
 * Sin acciones devuelve la burbuja sin envolver.
 *
 * @param {MessageMenuActionsProps} props - Burbuja, acciones y opciones de la flecha.
 * @returns {JSX.Element} La burbuja con su menu.
 */
export function MessageMenuActions({ children, actions, hideTrigger, onImage, isCurrentUser }: MessageMenuActionsProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  // Long press (~500 ms): abre el MISMO ContextMenu lanzando el evento `contextmenu`
  // en la posicion del toque (Radix lo escucha). Un scroll cancela el gesto.
  const longPress = useLongPress((x, y) => {
    areaRef.current?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  });
  if (actions.length === 0) return <>{children}</>;
  return (
    <div className="group relative min-w-0 max-w-full">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {/* En tactil: sin seleccion de texto ni menu nativo del sistema al mantener presionado. */}
          <div
            ref={areaRef}
            className="min-w-0 max-w-full [@media(hover:none)]:select-none [@media(hover:none)]:[-webkit-touch-callout:none]"
            {...longPress}
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ActionItems actions={actions} Item={ContextMenuItem} />
        </ContextMenuContent>
      </ContextMenu>
      {!hideTrigger && (
        <MessageMenuTrigger
          actions={actions}
          variant={onImage ? "image-overlay" : "default"}
          align={isCurrentUser ? "end" : "start"}
          className={onImage ? "absolute top-2 right-2 z-dropdown" : "absolute top-1 right-1 z-dropdown"}
        />
      )}
    </div>
  );
}

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageBubble, type MessageBubbleProps } from "./MessageBubble";
import { estimateMessageSize, messageRowGap } from "./estimate-message-size";
import type { Message } from "./chat-types";

/**
 * Metodos que el padre puede invocar sobre la lista (scroll por indice).
 */
export interface MessageListHandle {
  /** Desplaza la lista virtualizada hasta el mensaje de ese indice. */
  scrollToIndex: (index: number, options?: { align?: "start" | "center" | "end" | "auto"; behavior?: "auto" | "smooth" }) => void;
}

/**
 * Propiedades de {@link MessageList}: el scroll element y el contenedor interno viven
 * en el padre (el auto-snap y el observer de la cotizacion los leen), y las props de la
 * burbuja se reenvian tal cual a cada fila.
 */
export interface MessageListProps {
  messages: Message[];
  /**
   * Elemento que scrollea (el `ChatCanvas` del padre), pasado como ESTADO y no como ref: un ref
   * todavia es `null` cuando corren los efectos de layout de este hijo (el padre lo adjunta despues),
   * el virtualizer no lo observaria y la lista quedaria vacia hasta otro render.
   */
  scrollElement: HTMLDivElement | null;
  /** Contenedor interno del virtualizer (alto = `getTotalSize()`), observado por el padre. */
  contentRef: RefObject<HTMLDivElement>;
  /** Props comunes de cada burbuja (todo menos el mensaje y el anterior). */
  bubbleProps: Omit<MessageBubbleProps, "msg" | "prevMessage">;
}

/**
 * Lista virtualizada de mensajes. Posee `useVirtualizer`, asi que los cambios de rango
 * visible mientras se scrollea re-renderizan SOLO este componente (antes re-renderizaban
 * toda la pagina del chat: cabecera, composer y modales).
 *
 * Historiales de 200-300 mensajes: renderizar todo en DOM trababa el scroll. `getItemKey`
 * por `msg.id` (no por indice) para que insertar mensajes viejos al principio
 * (`loadOlderMessages`) no invalide las medidas ya calculadas de los existentes. El estimado
 * inicial de cada fila sale de {@link estimateMessageSize} (por tipo de mensaje).
 *
 * @param {MessageListProps} props - Mensajes, elemento de scroll y props de las burbujas.
 * @returns {JSX.Element} El contenedor virtual con las filas visibles.
 */
export const MessageList = forwardRef<MessageListHandle, MessageListProps>(function MessageList(
  { messages, scrollElement, contentRef, bubbleProps },
  ref,
) {
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => estimateMessageSize(messages[index], index > 0 ? messages[index - 1] : null),
    overscan: 8,
    getItemKey: (index) => messages[index]?.id ?? index,
  });

  // El padre puede pedir un scroll (scroll inicial al fondo o al primer no leido) en su propio
  // efecto de layout, ANTES de que el virtualizer conozca el scroll element (llega por estado en
  // el render siguiente). Ese pedido se guarda y se ejecuta en cuanto el elemento existe; sin
  // esto el virtualizer lo ignoraba y el chat quedaba arriba.
  const pendingScroll = useRef<{ index: number; options?: Parameters<MessageListHandle["scrollToIndex"]>[1] } | null>(null);

  useImperativeHandle(ref, () => ({
    scrollToIndex: (index, options) => {
      if (!scrollElement) {
        pendingScroll.current = { index, options };
        return;
      }
      rowVirtualizer.scrollToIndex(index, options);
    },
  }), [rowVirtualizer, scrollElement]);

  useLayoutEffect(() => {
    if (!scrollElement || !pendingScroll.current) return;
    const { index, options } = pendingScroll.current;
    pendingScroll.current = null;
    rowVirtualizer.scrollToIndex(index, options);
  }, [scrollElement, rowVirtualizer]);

  return (
    <div ref={contentRef} style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.key}
          data-index={virtualRow.index}
          ref={rowVirtualizer.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${virtualRow.start}px)`,
            paddingBottom: messageRowGap(messages[virtualRow.index], messages[virtualRow.index + 1]),
          }}
        >
          <MessageBubble
            msg={messages[virtualRow.index]}
            prevMessage={virtualRow.index > 0 ? messages[virtualRow.index - 1] : null}
            {...bubbleProps}
          />
        </div>
      ))}
    </div>
  );
});

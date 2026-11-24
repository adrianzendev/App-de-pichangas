import { forwardRef, useEffect, useRef, type HTMLAttributes, type UIEvent } from "react";
import { cn } from "@/lib/utils";

// La barra de scroll solo se ve mientras se desplaza y se oculta 800ms despues (clase `.scrollbar-on-scroll`, index.css).
const SCROLLBAR_HIDE_MS = 800;

/**
 * Lienzo del historial de mensajes: contenedor con scroll vertical sobre fondo blanco.
 * Acepta `ref` (el scroll y la virtualizacion leen este elemento) y cualquier prop de `div`.
 * La barra de scroll es visible solo al desplazar.
 */
export const ChatCanvas = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, onScroll, ...props }, ref) => {
    const hideTimer = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(hideTimer.current), []);

    const handleScroll = (e: UIEvent<HTMLDivElement>) => {
      onScroll?.(e);
      const el = e.currentTarget;
      el.classList.add("is-scrolling");
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => el.classList.remove("is-scrolling"), SCROLLBAR_HIDE_MS);
    };

    return (
      <div
        ref={ref}
        className={cn("scrollbar-on-scroll flex-1 overflow-y-auto p-4 bg-white", className)}
        onScroll={handleScroll}
        {...props}
      />
    );
  }
);
ChatCanvas.displayName = "ChatCanvas";

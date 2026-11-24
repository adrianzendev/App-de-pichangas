import * as React from "react";
import { cn } from "@/lib/utils";

interface ClickableMediaProps extends Omit<React.ComponentProps<"button">, "aria-label"> {
  /** Obligatorio: lo que hace el toque ("Abrir imagen", "Abrir PDF"). */
  "aria-label": string;
}

// Envuelve una imagen o portada clicable del chat en un <button>: se alcanza con Tab y se activa con
// Enter/Espacio, con el foco visible del sistema. Sustituye al <img onClick> sin teclado.
export function ClickableMedia({ className, type = "button", ...props }: ClickableMediaProps) {
  return (
    <button
      type={type}
      className={cn(
        "block cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  );
}

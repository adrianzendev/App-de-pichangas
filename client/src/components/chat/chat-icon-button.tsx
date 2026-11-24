import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatIconButtonProps extends Omit<React.ComponentProps<"button">, "aria-label"> {
  /** Obligatorio: el boton solo tiene un icono. */
  "aria-label": string;
}

// Boton de solo icono del chat: objetivo tactil de 40px (`size-touch`), circular y con el foco de botones
// del sistema. Reemplaza los `<button className="w-8 h-8 ...">` sueltos (volver, opciones, adjuntar, cerrar...).
export const ChatIconButton = React.forwardRef<HTMLButtonElement, ChatIconButtonProps>(
  ({ className, type = "button", ...props }, ref) => (
    <Button ref={ref} type={type} variant="ghost" size="icon-lg" className={cn("shrink-0", className)} {...props} />
  )
);
ChatIconButton.displayName = "ChatIconButton";

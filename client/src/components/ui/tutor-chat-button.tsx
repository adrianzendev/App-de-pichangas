import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Boton "Chat" de las tarjetas y el panel de tutores (lista, detalle y destacados): un solo estilo.
// Reposo: blanco con texto negro y borde gris; hover: verde solido con letra blanca.
// `children` va junto al texto (p. ej. el contador de no leidos de Propuestas).
export const TutorChatButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant">>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant="secondary"
      size="sm"
      className={cn("border-gray-300 text-gray-900 hover:border-primary-600 hover:bg-primary-600 hover:text-white", className)}
      {...props}
    >
      Chat
      {children}
    </Button>
  ),
);
TutorChatButton.displayName = "TutorChatButton";

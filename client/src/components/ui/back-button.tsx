import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Boton "volver" unico de las pantallas de detalle: 40px (`size-touch`), solo icono, con aria-label y el foco de
// botones del sistema. No armar `<button><ArrowLeft/></button>` a mano en cada pantalla.
export const BackButton = React.forwardRef<HTMLButtonElement, Omit<React.ComponentProps<"button">, "children">>(
  ({ className, type = "button", "aria-label": ariaLabel = "Volver", ...props }, ref) => (
    <Button ref={ref} type={type} variant="ghost" size="icon-lg" aria-label={ariaLabel} className={cn("shrink-0 text-gray-900 hover:bg-gray-200", className)} {...props}>
      <ArrowLeft className="size-icon-lg" aria-hidden />
    </Button>
  )
);
BackButton.displayName = "BackButton";

import type { FormHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TicketBoxProps extends FormHTMLAttributes<HTMLElement> {
  /** Titulo en mayusculas de la caja (Jugador, Acompañantes...). */
  label?: string;
  /** `form` cuando la caja contiene campos que se guardan juntos. */
  as?: "div" | "form";
  children: ReactNode;
}

/** Caja del pase (jugador, acompañantes, cancha): UN solo contenedor para que todas se vean igual. */
export function TicketBox({ label, as: Tag = "div", className, children, ...props }: TicketBoxProps) {
  return (
    <Tag className={cn("min-w-0 rounded-sm bg-night-container p-3", className)} {...props}>
      {label && <span className="block text-caption font-bold uppercase text-night-muted">{label}</span>}
      {children}
    </Tag>
  );
}

import type { ReactNode } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

export interface PlayerRowProps {
  /** Numero de cupo (1 = primero en anotarse). */
  number?: number;
  name: string;
  avatar?: string | null;
  isMe?: boolean;
  /** Cupo libre ("tu lugar"): sin avatar ni circulo, solo el numero, el texto y la accion. */
  placeholder?: boolean;
  /** Texto en verde electrico (cupo libre / tu lugar). */
  highlight?: boolean;
  /** Accion al final de la fila (ej. "Separar ahora"). */
  action?: ReactNode;
  className?: string;
}

// Fila de jugador de la plantilla. La usan el detalle (confirmados, suplentes y el cupo libre) para que todas
// las filas midan y se lean igual.
export function PlayerRow({ number, name, avatar, isMe, placeholder, highlight, action, className }: PlayerRowProps) {
  return (
    <li className={cn("flex items-center gap-3 rounded-md bg-night-container px-2 py-1", className)}>
      {/* El cupo libre no lleva numero, pero reserva el ancho para alinear con las demas filas. */}
      <span className="w-4 shrink-0 text-right text-caption font-bold text-night-muted tabular-nums">{number ?? ""}</span>
      {!placeholder && <UserAvatar name={name} avatar={avatar} size="sm" />}
      <span className={cn("min-w-0 flex-1 truncate text-body", highlight ? "font-bold text-pitch" : "text-night-text")}>
        {isMe ? `${name} (tú)` : name}
      </span>
      {action}
    </li>
  );
}

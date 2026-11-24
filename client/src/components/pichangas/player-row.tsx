import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  /** Posicion en la lista: escalona la entrada de las filas. */
  index?: number;
  className?: string;
}

// Fila de jugador de la plantilla. La usan el detalle (confirmados, suplentes y el cupo libre) para que todas
// las filas midan y se lean igual.
export function PlayerRow({ number, name, avatar, isMe, placeholder, highlight, action, index = 0, className }: PlayerRowProps) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 14) * 0.03, ease: "easeOut" }}
      className={cn("flex items-center gap-3 rounded-md bg-night-container px-2 py-1", className)}
    >
      {/* El cupo libre no lleva numero, pero reserva el ancho para alinear con las demas filas. */}
      <span className="w-4 shrink-0 text-right text-caption font-bold text-night-muted tabular-nums">{number ?? ""}</span>
      {!placeholder && <UserAvatar name={name} avatar={avatar} size="sm" />}
      <span className={cn("min-w-0 flex-1 truncate text-body", highlight ? "font-bold text-pitch" : "text-night-text")}>
        {isMe ? `${name} (tú)` : name}
      </span>
      {action && (
        // El boton rebota al entrar (escalonado por fila) y responde al mouse y al toque. El hover y el toque se mantienen
        // aun con "reducir movimiento": son un cambio de tamano corto, no un desplazamiento.
        <motion.div
          className="shrink-0"
          initial={reduce ? false : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.15 + Math.min(index, 14) * 0.04 }}
          whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 500, damping: 15 } }}
          whileTap={{ scale: 0.9 }}
        >
          {action}
        </motion.div>
      )}
    </motion.li>
  );
}

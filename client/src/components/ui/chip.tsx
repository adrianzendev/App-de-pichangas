import * as React from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Seleccionable (fechas, montos): lleva `aria-pressed`. Sin `active` es un atajo (accion) y no es un interruptor. */
  active?: boolean;
  /** Solo formulario de Publicar: 28px visibles, radio 6 y texto de 12px, con zona tactil de 40px. Va en una fila `COMPACT_CHIP_ROW`. */
  compact?: boolean;
}

// Fila de chips compactos: con `gap-y-3` cada fila ocupa 40px, asi las zonas tactiles no se pisan.
export const COMPACT_CHIP_ROW = "flex flex-wrap gap-x-1 gap-y-3";

// Pastilla de atajo (`rounded-full`, h-10). `compact`: solo fechas y montos de Publicar.
// Los filtros de estado usan este mismo chip a traves de `FilterPills`.
export function Chip({ active, compact, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap border transition-all duration-fast active:scale-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
        compact
          ? "relative gap-1 h-7 px-2 rounded-chip before:absolute before:inset-x-0 before:-inset-y-chip-touch text-caption"
          : "gap-2 h-10 px-4 rounded-full text-label",
        // Borde de 2px al estar activo: 1px de borde + 1px de anillo interior, asi el chip no cambia de tamano.
        active ? "bg-white text-gray-900 font-semibold border-primary-600 ring-1 ring-inset ring-primary-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

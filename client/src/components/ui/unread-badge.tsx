import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "min-w-badge-sm h-badge-sm px-1",
  md: "min-w-badge-md h-badge-md px-1.5",
  lg: "min-w-badge-lg h-badge-lg px-1.5",
  // Contador sobre un icono: IDENTICO al del sidebar (mismo tamano que "sm" + esquina superior derecha).
  // El contenedor del icono debe ser `relative` y sin `overflow-hidden` (si no, se recorta).
  icon: "absolute -top-1.5 -right-1.5 min-w-badge-sm h-badge-sm px-1",
} as const;

interface UnreadBadgeProps {
  count: number;
  max?: number;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  /** Texto para lectores de pantalla tras el numero. */
  srLabel?: string;
}

export function UnreadBadge({ count, max = 99, size = "sm", className = "", srLabel = "sin leer" }: UnreadBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        SIZE_CLASSES[size],
        "flex items-center justify-center text-caption font-medium rounded-full bg-primary-600 text-white flex-shrink-0",
        className
      )}
    >
      <span aria-hidden>{count > max ? `${max}+` : count}</span>
      <span className="sr-only">{count} {srLabel}</span>
    </span>
  );
}

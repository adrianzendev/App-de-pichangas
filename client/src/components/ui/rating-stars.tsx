import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** Calificacion de 0 a 5 (admite decimales: la ultima estrella se llena en parcial). */
  value: number;
  size?: "sm" | "md" | "lg";
  /** Una sola estrella + el numero ("★ 4.8"), para filas densas. */
  compact?: boolean;
  /** Reemplaza el numero del modo `compact` (p. ej. "4.8 (12)" con su propia tipografia). */
  label?: ReactNode;
  className?: string;
}

const SIZES = { sm: "size-icon-sm", md: "size-icon-star", lg: "size-icon-md" } as const;

/** Color de toda estrella llena (lectura y selector): un solo lugar para cambiarlo. */
export const STAR_FILLED = "fill-primary-600 text-primary-600";

/** Numero de calificacion con un decimal, sin el ".0" de las exactas ("5", "4.8"). Un solo formato para lista y detalle. */
export const formatRating = (n: number) => n.toFixed(1).replace(/\.0$/, "");

// Calificacion de SOLO LECTURA (para elegir una nota esta `StarRating`). Un solo lugar para la media estrella:
// cada estrella es una gris con otra llena encima recortada al porcentaje que le toca.
export function RatingStars({ value, size = "md", compact, label, className }: RatingStarsProps) {
  const v = Math.min(5, Math.max(0, Number.isFinite(value) ? value : 0));
  const dim = SIZES[size];

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <Star aria-hidden className={cn(dim, "shrink-0", STAR_FILLED)} />
        {label ?? <span className="text-caption font-medium text-gray-700">{v.toFixed(1)}</span>}
      </span>
    );
  }

  return (
    <span role="img" aria-label={`${v.toFixed(1)} de 5 estrellas`} className={cn("inline-flex items-center", className)}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, v - i)) * 100;
        return (
          <span key={i} aria-hidden className="relative inline-flex">
            <Star className={cn(dim, "fill-gray-200 text-gray-200")} />
            {fill > 0 && (
              <Star
                className={cn(dim, "absolute inset-0", STAR_FILLED)}
                style={fill < 100 ? { clipPath: `inset(0 ${100 - fill}% 0 0)` } : undefined}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

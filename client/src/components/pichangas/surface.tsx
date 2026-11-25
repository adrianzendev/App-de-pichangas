import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Superficies del tema Pinkiball: UN solo origen para el fondo, el radio y la sombra de tarjetas y cajas.
// - card:  tarjeta sobre el fondo de la app (blanca en claro, azul noche en oscuro).
// - inset: caja interna dentro de una tarjeta (datos, celdas, resumenes).
export type SurfaceLevel = "card" | "inset";

const LEVEL: Record<SurfaceLevel, string> = {
  card: "rounded-md border border-night-high bg-night-container shadow-night-card",
  inset: "rounded-md bg-night-low",
};

/** Clases de una superficie, para elementos que no son un div (li animado, article, details) o que ya llevan su propio cn(). */
export const surfaceClass = (level: SurfaceLevel = "card") => LEVEL[level];

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  level?: SurfaceLevel;
  as?: "div" | "section" | "article" | "li" | "details";
}

export function Surface({ level = "card", as: Tag = "div", className, ...props }: SurfaceProps) {
  return <Tag className={cn(LEVEL[level], className)} {...props} />;
}

import { type ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  // true = sin mx-auto/max-w-content (672px) — ancho completo, alineado a
  // la izquierda solo con px-page-h. Usar cuando el padre ya acota el ancho
  // (p.ej. una columna de ThreeColumnLayout) o para que el contenido
  // arranque en el mismo eje izquierdo que esas columnas en vez de
  // centrarse como feed angosto de lectura.
  fullWidth?: boolean;
  // true = margen lateral compacto (`px-card-gap`) en vez de `px-page-h`: listas de tarjetas que
  // deben aprovechar el ancho (p. ej. Mensajes) en movil, tablet y escritorio.
  compact?: boolean;
}

export function Container({ children, className = "", fullWidth = false, compact = false }: ContainerProps) {
  return (
    <div
      className={`${compact ? "px-card-gap" : "px-page-h"} w-full ${fullWidth ? "" : "mx-auto max-w-content"} ${className}`}
    >
      {children}
    </div>
  );
}

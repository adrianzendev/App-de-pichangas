import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TaskDetailPanelProps {
  children: ReactNode;
  /** Desde `lg:` deja de ser overlay y ocupa su columna en el flujo (Inicio); sin esto es overlay siempre. */
  inlineOnDesktop?: boolean;
}

// Panel de detalle de pedido a pantalla completa (candidatos, vistas): overlay `fixed` del ancho del contenedor,
// por encima del resto (`z-modal`). Antes se copiaba a mano en Inicio, Pedidos y TaskDetailView.
// El contenido va dentro de `<div className="mx-auto max-w-content">` (ancho de lectura de 672px).
export function TaskDetailPanel({ children, inlineOnDesktop }: TaskDetailPanelProps) {
  return (
    <div
      className={cn(
        "fixed top-0 bottom-0 left-1/2 -translate-x-1/2 w-full max-w-container bg-white z-modal overflow-y-auto",
        inlineOnDesktop && "lg:static lg:inset-auto lg:translate-x-0 lg:max-w-none lg:z-auto lg:overflow-visible lg:bg-transparent"
      )}
    >
      {children}
    </div>
  );
}

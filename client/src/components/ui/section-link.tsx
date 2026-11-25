import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface SectionLinkProps {
  onClick: () => void;
  children: ReactNode;
  "data-testid"?: string;
}

// Enlace de cabecera de seccion ("Ver todos"): un solo estilo para Inicio (pedidos y tutores destacados).
export function SectionLink({ onClick, children, "data-testid": testId }: SectionLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-md text-body font-semibold text-green-600 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      data-testid={testId}
    >
      {children}
      <ChevronRight className="size-icon-md" aria-hidden />
    </button>
  );
}

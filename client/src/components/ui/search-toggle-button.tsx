import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchToggleButtonProps {
  /** Campo desplegado: el icono pasa a ser una X que lo cierra. */
  open: boolean;
  /** Hay texto buscado: punto verde sobre la lupa aunque el campo este cerrado. */
  active?: boolean;
  onClick: () => void;
  "aria-label"?: string;
  "data-testid"?: string;
}

// Lupa de la cabecera movil (a la derecha del titulo). Despliega o cierra el `SearchField` de la pantalla; en escritorio
// el campo va siempre visible y este boton no se monta. 40px (`size-touch`), solo icono, como `BackButton`.
export function SearchToggleButton({ open, active = false, onClick, "aria-label": ariaLabel = "Buscar", ...rest }: SearchToggleButtonProps) {
  const Icon = open ? X : Search;
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label={open ? "Cerrar búsqueda" : ariaLabel}
      aria-expanded={open}
      onClick={onClick}
      className="relative shrink-0 text-gray-900 hover:bg-gray-200"
      data-testid={rest["data-testid"]}
    >
      <Icon className="size-icon-lg" aria-hidden />
      {active && !open && <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-green-600" />}
    </Button>
  );
}

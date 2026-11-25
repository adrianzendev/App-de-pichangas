import * as React from "react";
import { Search } from "lucide-react";
import { FIELD_COMPLETE, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchFieldProps extends Omit<React.ComponentProps<"input">, "type"> {
  /** Texto para lectores de pantalla (el placeholder no basta). */
  "aria-label": string;
  /** Clases del contenedor (p. ej. `flex-1` dentro de una fila flex); `className` va al input. */
  wrapperClassName?: string;
}

// Campo de busqueda unico (Tutores, Pedidos, Mensajes): Input base de 48px con lupa a la izquierda y radio completo
// (`rounded-full`), a diferencia del resto de los campos de formulario (`rounded-control`).
// Con texto escrito el borde pasa a verde de 2px (FIELD_COMPLETE): avisa que hay una busqueda activa filtrando la lista.
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, wrapperClassName, ...props }, ref) => {
    const active = String(props.value ?? "").trim() !== "";
    return (
      <div className={cn("relative flex items-center", wrapperClassName)}>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-icon-md -translate-y-1/2 text-gray-700" />
        <Input ref={ref} type="text" className={cn("rounded-full pl-11 border-gray-200", active && FIELD_COMPLETE, className)} {...props} />
      </div>
    );
  }
);
SearchField.displayName = "SearchField";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldLinkRowProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Con error de validacion: borde `border-error` en lugar del de campo. */
  invalid?: boolean;
}

// Campo que se elige en OTRA pagina (Universidad, Especialidades): se ve como un campo (`rounded-control`, borde de campo, 48px minimo)
// con el valor elegido adentro y una flecha a la derecha. Al tocarlo navega; el `onClick` lo pone quien lo usa. Una sola fuente de
// su estilo: no armar `<button className="rounded-control border …">` sueltos en cada pantalla.
export const FieldLinkRow = React.forwardRef<HTMLButtonElement, FieldLinkRowProps>(
  ({ invalid, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-invalid={invalid || undefined}
      className={cn(
        "flex min-h-field w-full items-center justify-between gap-3 rounded-control border bg-white px-4 py-2 text-left text-base transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:border-primary-600 focus-visible:ring-2 focus-visible:ring-primary-100",
        invalid ? "border-error" : "border-field",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-2">{children}</span>
      <ChevronRight aria-hidden className="size-icon-lg shrink-0 text-gray-700" />
    </button>
  ),
);
FieldLinkRow.displayName = "FieldLinkRow";

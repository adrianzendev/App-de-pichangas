import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OutlinedFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

// Etiqueta sobre el borde: UN solo origen. Lleva fondo blanco para cortar la linea, asi que va sobre superficies blancas.
export const OUTLINED_LABEL = "absolute -top-2 left-3 bg-white px-1 text-caption font-semibold text-gray-800";

// Dato de solo lectura con la etiqueta sobre el borde: mismo alto minimo, radio y borde que los campos de formulario.
// La etiqueta lleva fondo blanco para cortar la linea, asi que va sobre superficies blancas (modales, tarjetas).
export function OutlinedField({ label, children, className }: OutlinedFieldProps) {
  return (
    <div className={cn("relative flex min-h-field min-w-0 flex-col justify-center rounded-control border border-field px-4 py-3", className)}>
      <span className={OUTLINED_LABEL}>{label}</span>
      {children}
    </div>
  );
}

// Lo mismo para un campo editable: la etiqueta se monta sobre el borde del propio Input, Textarea o Select, sin caja extra.
// Va despues del control para pintarse encima de el.
export function OutlinedControl({ label, htmlFor, children, className }: { label: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {children}
      <label htmlFor={htmlFor} className={OUTLINED_LABEL}>{label}</label>
    </div>
  );
}

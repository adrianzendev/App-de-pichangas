import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FilterSelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string } }) => void;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
  children?: React.ReactNode;
}

// Aplana <option> (incluye los de .map() y fragments) a {value, label}.
function collectOptions(children: React.ReactNode): { value: string; label: React.ReactNode }[] {
  const out: { value: string; label: React.ReactNode }[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string; children?: React.ReactNode };
    if (child.type === React.Fragment) {
      out.push(...collectOptions(props.children));
    } else if (child.type === "option") {
      out.push({ value: String(props.value ?? ""), label: props.children });
    }
  });
  return out;
}

// Filtro desplegable con el mismo panel que Select (no el <select> nativo del SO).
// Mantiene la API de <select>: hijos <option> y onChange(e) con e.target.value.
export function FilterSelect({ value, defaultValue, onChange, className, disabled, children, ...rest }: FilterSelectProps) {
  const options = collectOptions(children);
  return (
    <Select value={value} defaultValue={defaultValue} onValueChange={(v) => onChange?.({ target: { value: v } })} disabled={disabled}>
      {/* El valor actual siempre va en negrita, tambien el de por defecto ("Estado: Todos"). */}
      <SelectTrigger className={cn("h-10 w-auto gap-2 rounded-full border-gray-200 py-0 text-label font-semibold text-gray-900", className)} data-testid={rest["data-testid"]}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

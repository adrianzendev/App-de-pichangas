import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

interface FilterPillsProps<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

// Filtros de estado como chips sueltos (`Chip`): el activo lo define `Chip` (borde verde y negrita), los demas blancos con
// borde. Si no caben, la fila hace scroll horizontal.
export function FilterPills<T extends string>({ options, value, onChange, className }: FilterPillsProps<T>) {
  return (
    <div role="group" className={cn("flex items-center gap-2 overflow-x-auto scrollbar-none", className)}>
      {options.map((opt) => (
        <Chip
          key={opt.id}
          active={value === opt.id}
          onClick={() => onChange(opt.id)}
          className="shrink-0"
        >
          {opt.label}
        </Chip>
      ))}
    </div>
  );
}

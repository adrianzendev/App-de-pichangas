import { Minus, Plus } from "lucide-react";
import { NightIconButton } from "@/components/pichangas/night-controls";
import { cn } from "@/lib/utils";

export interface SeatStepperProps {
  label: string;
  value: number;
  /** Se bloquea "quitar" al llegar aqui. */
  min: number;
  /** Se bloquea "agregar" al llegar aqui. */
  max: number;
  onAdd: () => void;
  onRemove: () => void;
  className?: string;
}

// Selector de cupos (- N +) de la barra de accion del detalle. Comparte la seleccion con los "Lugar libre" de la plantilla.
export function SeatStepper({ label, value, min, max, onAdd, onRemove, className }: SeatStepperProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="text-label font-bold text-night-muted">{label}</span>
      <div className="flex items-center gap-1" role="group" aria-label={label}>
        <NightIconButton tone="soft" aria-label="Quitar un cupo" disabled={value <= min} onClick={onRemove}>
          <Minus className="size-icon-md" aria-hidden />
        </NightIconButton>
        <span className="w-8 text-center text-body font-bold text-night-text tabular-nums" aria-live="polite">{value}</span>
        <NightIconButton tone="soft" aria-label="Agregar un cupo" disabled={value >= max} onClick={onAdd}>
          <Plus className="size-icon-md" aria-hidden />
        </NightIconButton>
      </div>
    </div>
  );
}

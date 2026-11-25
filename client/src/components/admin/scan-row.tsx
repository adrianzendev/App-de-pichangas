import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pluralizeEs } from "@/lib/pluralize";

export interface ScanResult {
  scanned: number;
  newAlerts: number;
}

interface ScanRowProps {
  title: string;
  description: string;
  /** Lo que se escanea, en plural: "pedidos" | "mensajes". */
  noun: string;
  result: ScanResult | null;
  isPending: boolean;
  buttonLabel: string;
  onScan: () => void;
  /** Control extra a la izquierda del boton (ej. rango de dias). */
  children?: ReactNode;
}

function scanSummary({ scanned, newAlerts }: ScanResult, noun: string): string {
  if (newAlerts === 0) return `Sin alertas nuevas (${scanned} ${noun} escaneados)`;
  const n = newAlerts;
  return `${n} ${pluralizeEs(n, "alerta")} ${pluralizeEs(n, "nueva")} ${pluralizeEs(n, "creada")} (de ${scanned} ${noun} escaneados)`;
}

// Tarjeta de accion de escaneo. En movil apila texto y controles; desde `sm` va en una fila.
export function ScanRow({ title, description, noun, result, isPending, buttonLabel, onScan, children }: ScanRowProps) {
  return (
    <div className="bg-white rounded-lg border border-field p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-subheading font-semibold text-gray-900">{title}</p>
        <p className="text-caption text-gray-700">{description}</p>
        {result && (
          <p className="text-caption text-green-700 font-semibold mt-1 flex items-center gap-1">
            <Check className="size-icon-sm" /> {scanSummary(result, noun)}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-shrink-0">
        {children}
        <Button size="sm" variant="outline" className="sm:min-w-control-md" disabled={isPending} onClick={onScan}>
          {isPending ? "Escaneando…" : buttonLabel}
        </Button>
      </div>
    </div>
  );
}

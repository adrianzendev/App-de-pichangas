import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** `node` reemplaza al texto del valor (p. ej. los adjuntos como tarjetas de archivo en Pedidos). */
export interface SummaryRow { label: string; value: string; node?: ReactNode }

interface OrderSummaryProps {
  rows: SummaryRow[];
  /** Antes y despues del titulo, en su misma fila (Pedidos: volver y menu). */
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Con chevron para contraer/desplegar los datos y ganar alto (Pedidos). Sin esto siempre se ven (Publicar). */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

// Resumen del pedido: UN solo componente para /publish (se va llenando; lo vacio sale "Pendiente") y para el
// detalle de /orders (datos reales). Misma tarjeta que "Tutores destacados" del Inicio. El contenedor/padding de
// pagina lo pone quien lo usa.
export function OrderSummary({ rows, leading, trailing, collapsible = false, defaultOpen = true }: OrderSummaryProps) {
  const [open, setOpen] = useState(defaultOpen);
  const showRows = !collapsible || open;
  return (
    <section className="flex flex-col gap-card-gap rounded-lg bg-white" data-testid="order-summary">
      <div className={cn("flex items-center gap-1", (leading || trailing || collapsible) && "-mx-2")}>
        {leading}
        <h2 className={cn("flex-1 text-subheading font-semibold text-gray-900", !leading && (trailing || collapsible) && "px-2")}>Resumen del pedido</h2>
        {collapsible && (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-expanded={open}
            aria-label={open ? "Ocultar resumen" : "Mostrar resumen"}
            onClick={() => setOpen(!open)}
            className="hover:bg-gray-50"
            data-testid="order-summary-toggle"
          >
            <ChevronDown className={cn("size-icon-lg transition-transform", open && "rotate-180")} />
          </Button>
        )}
        {trailing}
      </div>
      {showRows && (
        <dl className="flex flex-col gap-card-gap">
          {rows.filter(r => r.label !== 'Notas' || r.value).map(r => (
            <div key={r.label}>
              <dt className="text-caption text-gray-700">{r.label}</dt>
              <dd className={`text-body mt-0.5 whitespace-pre-line break-words ${r.value ? (r.label === 'Título' ? 'font-semibold text-gray-900' : 'text-gray-900') : 'text-gray-700'}`}>
                {r.node ?? (r.value || 'Pendiente')}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

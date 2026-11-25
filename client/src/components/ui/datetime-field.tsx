import { useState } from "react";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineDateTimePicker } from "@/components/publish/inline-date-time-picker";
import { cn } from "@/lib/utils";

interface DateTimeFieldProps {
  /** `YYYY-MM-DDTHH:mm` (el mismo formato que usa Publicar) o vacio. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

// Campo de fecha y hora unico (Pedidos, Inicio, invitar tutor, admin): un boton con la apariencia de los campos
// que abre el MISMO selector que Publicar (`InlineDateTimePicker`: calendario + horas cada 15 min + plazos rapidos)
// dentro de un Dialog. Lo elegido se guarda al pulsar "Listo"; cerrar el dialogo lo descarta.
export function DateTimeField({ value, onChange, placeholder = "Seleccionar fecha y hora", className, id }: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const parsed = value ? new Date(value) : null;
  const label = parsed && !isNaN(parsed.getTime()) ? format(parsed, "d 'de' MMMM · hh:mm a", { locale: es }) : "";

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(value);
    setOpen(next);
  };

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => handleOpenChange(true)}
        className={cn(
          "flex h-field w-full items-center justify-between gap-3 rounded-control border bg-white px-4 text-left text-base transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:border-primary-600 focus-visible:ring-2 focus-visible:ring-primary-100",
          label ? "border-field text-gray-900" : "border-field text-muted",
          className
        )}
        data-testid="button-open-datetime"
      >
        <span className="truncate">{label || placeholder}</span>
        <Calendar className="h-5 w-5 shrink-0 text-gray-700" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fecha y hora de entrega</DialogTitle>
          </DialogHeader>
          <InlineDateTimePicker value={draft} onChange={setDraft} />
          <Button
            size="lg"
            type="button"
            className="w-full"
            disabled={!draft}
            onClick={() => { onChange(draft); setOpen(false); }}
            data-testid="button-confirm-datetime"
          >
            Listo
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetClose, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/**
 * Propiedades de {@link SidePanel}.
 */
export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  /** Titulo del header (junto a la ✕). */
  title: string;
  /** Descripcion solo para lectores de pantalla. */
  description: string;
  children: ReactNode;
}

/**
 * Panel lateral derecho estilo WhatsApp Web: pantalla completa en movil, sidebar de
 * 384px desde `md`, aparece con fade (sin barrido lateral). Header con ✕ a la izquierda
 * del titulo; el contenido hace scroll sobre el canvas neutro (`bg-gray-100`).
 *
 * @param {SidePanelProps} props - Estado de apertura, titulos y contenido.
 * @returns {JSX.Element} El panel.
 */
export function SidePanel({ open, onClose, title, description, children }: SidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* La ✕ por defecto del Sheet (ultimo hijo) se oculta; el slide del variant `right` se anula con `!` (tailwind-merge no lo trata como conflicto). */}
      <SheetContent
        side="right"
        className="data-[state=open]:!slide-in-from-right-0 data-[state=closed]:!slide-out-to-right-0 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:!duration-150 data-[state=closed]:!duration-150 w-full sm:max-w-none md:w-96 p-0 gap-0 flex flex-col bg-gray-100 [&>button:last-child]:hidden"
      >
        <SheetDescription className="sr-only">{description}</SheetDescription>
        <div className="flex items-center gap-3 px-4 py-3 bg-white shadow-sm flex-shrink-0">
          <SheetClose aria-label="Cerrar" className="rounded-full p-1.5 text-gray-700 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </SheetClose>
          <SheetTitle>{title}</SheetTitle>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

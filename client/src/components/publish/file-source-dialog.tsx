import type { PickSource } from "@/lib/file-picker";
import { Camera, FolderOpen, ImagePlus } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

interface FileSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Elemento que abrio el menu (clip o boton de adjuntar): el menu sale pegado a el. */
  anchor: HTMLElement | null;
  /** Lado del anclaje donde se alinea el menu: `end` para el clip del chat, `start` para botones anchos. */
  align?: "start" | "end";
  /** Origen elegido. Debe abrir el selector de inmediato (gesto del usuario): ver `useFilePicker`. */
  onPick: (source: PickSource) => void;
}

// Elegir de donde salen los archivos: camara, galeria o archivos. Menu anclado al boton que lo abre
// (sin modal ni titulo): un toque para abrir y otro para elegir.
export function FileSourceDialog({ open, onOpenChange, anchor, align = "end", onPick }: FileSourceDialogProps) {
  const options: { icon: typeof Camera; label: string; source: PickSource }[] = [
    { icon: Camera, label: 'Cámara', source: 'camera' },
    { icon: ImagePlus, label: 'Galería', source: 'gallery' },
    { icon: FolderOpen, label: 'Archivos', source: 'files' },
  ];
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent side="top" align={align} sideOffset={8} role="menu" aria-label="Añadir archivo"
        className="z-modal w-56 rounded-lg border-0 bg-white p-1.5 shadow-float">
        {options.map(({ icon: Icon, label, source }) => (
          <button key={label} type="button" role="menuitem"
            onClick={() => { onPick(source); onOpenChange(false); }}
            className="flex min-h-11 w-full items-center gap-3 rounded-row px-3 py-2 text-left text-body font-semibold text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Icon className="size-icon-lg text-primary-600" />
            {label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, type LucideProps } from "lucide-react";

/**
 * Propiedades de {@link ViewerIconButton}.
 */
export interface ViewerIconButtonProps {
  /** Icono de Lucide del boton. */
  icon: ComponentType<LucideProps>;
  /** Etiqueta accesible (tambien tooltip). */
  label: string;
  onClick: () => void;
}

/**
 * Boton de icono de la barra de los visores (20 px, blanco tenue, fondo al pasar el
 * cursor). Es el unico estilo de boton de la barra: cierre y descarga lo comparten.
 *
 * @param {ViewerIconButtonProps} props - Icono, etiqueta y callback.
 * @returns {JSX.Element} El boton.
 */
export function ViewerIconButton({ icon: Icon, label, onClick }: ViewerIconButtonProps) {
  return (
    <Button variant="ghost" size="icon-lg" onClick={onClick} aria-label={label} title={label} className="shrink-0 hover:bg-white/15">
      <Icon className="size-icon-lg text-white/80 hover:text-white" />
    </Button>
  );
}

/**
 * Propiedades de {@link MediaViewerHeader}.
 */
export interface MediaViewerHeaderProps {
  /** Nombre del archivo, a la izquierda (truncado). */
  title?: string;
  /** Cierra el visor: ✕ en el extremo derecho. */
  onClose: () => void;
  /** Si se pasa, muestra la descarga justo a la izquierda de la ✕. */
  onDownload?: () => void;
  /** Controles opcionales, entre el titulo y el grupo de acciones. */
  children?: ReactNode;
}

/**
 * Encabezado unico de los visores a pantalla completa (imagenes y documentos):
 * nombre del archivo a la izquierda y, pegadas al extremo derecho, las acciones
 * `[ ⤓ descargar ][ ✕ cerrar ]` (la ✕ al borde, la descarga a su costado izquierdo).
 * La paginacion y el zoom del PDF no van aqui: viven en la pildora flotante
 * {@link PdfFloatingToolbar}. Barra oscura semitransparente con borde inferior sutil.
 *
 * @param {MediaViewerHeaderProps} props - Titulo, callbacks y controles opcionales.
 * @returns {JSX.Element} La barra superior del visor.
 */
export function MediaViewerHeader({ title, onClose, onDownload, children }: MediaViewerHeaderProps) {
  return (
    <div className="bg-scrim/60 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
      <span className="flex-1 min-w-0 text-body font-medium text-white truncate">{title}</span>
      {children}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onDownload && <ViewerIconButton icon={Download} label="Descargar" onClick={onDownload} />}
        <ViewerIconButton icon={X} label="Cerrar" onClick={onClose} />
      </div>
    </div>
  );
}

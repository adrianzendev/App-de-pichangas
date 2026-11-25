import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MediaViewerHeader } from "@/components/chat/attachments/MediaViewerHeader";

/**
 * Propiedades de {@link ImagePreviewModal}.
 */
export interface ImagePreviewModalProps {
  /** URL de la imagen; null/"" = cerrado. */
  src: string | null;
  /** Nombre del archivo (se muestra en la barra superior). */
  title?: string;
  onClose: () => void;
  /** Si se pasa, muestra el boton de descarga. */
  onDownload?: () => void;
}

/**
 * Visor de imagenes a pantalla completa estilo WhatsApp Web: fondo oscuro, la
 * misma barra superior que el visor de documentos ({@link MediaViewerHeader}: ✕ a la
 * izquierda, descarga a la derecha) y la imagen centrada ocupando el maximo
 * posible. Dialog de Radix (portal): seguro anidado dentro de otro DialogContent.
 * Escape y toque en el fondo vacio cierran.
 *
 * @param {ImagePreviewModalProps} props - Imagen (null = cerrado), titulo y callbacks.
 * @returns {JSX.Element} El visor.
 */
export function ImagePreviewModal({ src, title, onClose, onDownload }: ImagePreviewModalProps) {
  return (
    <Dialog open={!!src} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        hideClose
        fullscreen
        className="bg-scrim/95"
      >
        <DialogTitle className="sr-only">{title || "Vista completa"}</DialogTitle>
        <MediaViewerHeader title={title} onClose={onClose} onDownload={onDownload} />
        <div
          className="flex-1 min-h-0 w-full flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <img
            src={src ?? ''}
            alt="Vista completa"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { ChevronDown, ChevronUp, ZoomIn, ZoomOut } from "lucide-react";

/**
 * Propiedades de {@link PdfFloatingToolbar}.
 */
export interface PdfFloatingToolbarProps {
  /** Pagina actual (1-based). */
  page: number;
  /** Total de paginas del documento (0 mientras carga). */
  pageCount: number;
  /** Sube una pagina. */
  onPrev: () => void;
  /** Baja una pagina. */
  onNext: () => void;
  /** Acerca el documento. */
  onZoomIn: () => void;
  /** Aleja el documento. */
  onZoomOut: () => void;
  /** Ya no se puede acercar mas. */
  zoomInDisabled?: boolean;
  /** Ya no se puede alejar mas. */
  zoomOutDisabled?: boolean;
}

/**
 * Pildora vertical flotante en el margen derecho del visor de PDF (estilo WhatsApp
 * Web): pagina actual, separador, total, flechas arriba/abajo (cambian de pagina) y
 * zoom +/-. Se posiciona sobre el visor (el contenedor padre debe ser `relative`).
 *
 * @param {PdfFloatingToolbarProps} props - Estado de paginacion/zoom y callbacks.
 * @returns {JSX.Element} La barra flotante.
 */
export function PdfFloatingToolbar({ page, pageCount, onPrev, onNext, onZoomIn, onZoomOut, zoomInDisabled, zoomOutDisabled }: PdfFloatingToolbarProps) {
  const btn = "flex size-touch items-center justify-center rounded-md hover:text-green-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-dropdown flex flex-col items-center gap-2 bg-gray-900/90 text-white p-2 rounded-xl backdrop-blur-md shadow-float select-none w-14">
      <span className="text-caption font-semibold">{pageCount ? page : "–"}</span>
      <span className="text-caption text-white/60">{pageCount || "–"}</span>
      <button type="button" aria-label="Página anterior" className={btn} disabled={page <= 1} onClick={onPrev}>
        <ChevronUp className="size-icon-md" />
      </button>
      <button type="button" aria-label="Página siguiente" className={btn} disabled={!pageCount || page >= pageCount} onClick={onNext}>
        <ChevronDown className="size-icon-md" />
      </button>
      <button type="button" aria-label="Acercar" className={btn} disabled={zoomInDisabled} onClick={onZoomIn}>
        <ZoomIn className="size-icon-md" />
      </button>
      <button type="button" aria-label="Alejar" className={btn} disabled={zoomOutDisabled} onClick={onZoomOut}>
        <ZoomOut className="size-icon-md" />
      </button>
    </div>
  );
}

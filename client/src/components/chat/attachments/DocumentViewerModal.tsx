import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { loadPdfjs } from "@/lib/pdf-thumbnail";
import { MediaViewerHeader } from "./MediaViewerHeader";
import { PdfFloatingToolbar } from "./PdfFloatingToolbar";

/**
 * Propiedades de {@link DocumentViewerModal}.
 */
export interface DocumentViewerModalProps {
  /** URL del PDF (http o blob:); null = cerrado. */
  url: string | null;
  /** Nombre original del archivo (titulo). */
  name?: string;
  onClose: () => void;
  /** Si se pasa, muestra el boton de descarga. */
  onDownload?: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
/** Margen horizontal reservado (px) para que la pagina no quede bajo la pildora lateral. */
const SIDE_GUTTER = 96;

/** Tamano de una pagina a escala 1. */
interface PageSize { w: number; h: number }

/**
 * Visor de PDF a pantalla completa y fondo oscuro (igual que el visor de imagenes):
 * encabezado compartido {@link MediaViewerHeader} (✕ + nombre, descarga) y todas las
 * paginas en una sola columna con scroll vertical continuo. Cada pagina se dibuja en
 * su `<canvas>` solo cuando se acerca al area visible (IntersectionObserver). La
 * pildora flotante {@link PdfFloatingToolbar} muestra la pagina actual segun el scroll
 * y permite saltar de pagina y hacer zoom. Usa el Dialog de Radix (portal): seguro
 * abrirlo desde dentro de otro modal.
 *
 * @param {DocumentViewerModalProps} props - URL (null = cerrado), nombre, cierre y descarga opcional.
 * @returns {JSX.Element} El dialogo con el visor.
 */
export function DocumentViewerModal({ url, name, onClose, onDownload }: DocumentViewerModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Array<HTMLDivElement | null>>([]);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const taskRef = useRef<PDFDocumentLoadingTask | null>(null);
  /** Por pagina: clave de escala ya dibujada y render en curso. */
  const drawn = useRef(new Map<number, { key: string; task?: RenderTask }>());

  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Cargar el documento al abrir; liberarlo al cerrar / cambiar de URL.
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setPage(1); setZoom(1); setSizes([]); setError(false); setLoading(true);
    drawn.current.clear();
    (async () => {
      try {
        const [pdfjs, data] = await Promise.all([
          loadPdfjs(),
          fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))),
        ]);
        const task = pdfjs.getDocument({ data });
        const doc = await task.promise;
        if (!alive) { void task.destroy(); return; }
        taskRef.current = task;
        docRef.current = doc;
        const pages = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)));
        if (!alive) return;
        setSizes(pages.map((p) => { const v = p.getViewport({ scale: 1 }); return { w: v.width, h: v.height }; }));
        setLoading(false);
      } catch {
        if (alive) { setError(true); setLoading(false); }
      }
    })();
    return () => {
      alive = false;
      drawn.current.forEach((d) => d.task?.cancel());
      drawn.current.clear();
      void taskRef.current?.destroy();
      taskRef.current = null;
      docRef.current = null;
    };
  }, [url]);

  // Escala base: ajusta el ancho de la pagina mas ancha al area visible.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || sizes.length === 0) return;
    const widest = Math.max(...sizes.map((s) => s.w));
    setFit(Math.max(el.clientWidth - SIDE_GUTTER, 200) / widest);
  }, [sizes]);

  const scale = fit * zoom;

  // Dibuja una pagina en su canvas (una sola vez por escala).
  const renderPage = useCallback(async (index: number) => {
    const doc = docRef.current;
    const holder = pageEls.current[index];
    if (!doc || !holder) return;
    const dpr = window.devicePixelRatio || 1;
    const key = `${scale.toFixed(3)}@${dpr}`;
    if (drawn.current.get(index)?.key === key) return;
    drawn.current.get(index)?.task?.cancel();
    const canvas = holder.querySelector("canvas");
    if (!canvas) return;
    try {
      const pdfPage = await doc.getPage(index + 1);
      const viewport = pdfPage.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      const task = pdfPage.render({ canvas, viewport });
      drawn.current.set(index, { key, task });
      await task.promise;
    } catch (e) {
      // RenderingCancelledException al cambiar de zoom o cerrar: esperado.
      if (!(e instanceof Error && e.name === "RenderingCancelledException")) setError(true);
    }
  }, [scale]);

  // Dibujar solo las paginas cercanas al area visible.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || sizes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) void renderPage(Number((en.target as HTMLElement).dataset.page)); }),
      { root, rootMargin: "800px 0px" },
    );
    pageEls.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [sizes, renderPage]);

  // Pagina actual segun el scroll (la ultima cuyo borde superior ya paso ~40% del alto visible).
  const onScroll = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    const probe = root.scrollTop + root.clientHeight * 0.4;
    let current = 1;
    pageEls.current.forEach((el, i) => { if (el && el.offsetTop <= probe) current = i + 1; });
    setPage(current);
  }, []);

  const goTo = (p: number) => {
    const target = Math.min(Math.max(1, p), Math.max(sizes.length, 1));
    pageEls.current[target - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Dialog open={!!url} onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* Pantalla completa oscura: la misma interfaz que el visor de imagenes. */}
      <DialogContent
        hideClose
        fullscreen
        className="bg-scrim/90 backdrop-blur-md"
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "PageUp") goTo(page - 1);
          if (e.key === "ArrowDown" || e.key === "PageDown") goTo(page + 1);
        }}
      >
        <DialogTitle className="sr-only">{name || "Documento PDF"}</DialogTitle>
        <MediaViewerHeader title={name || "Documento PDF"} onClose={onClose} onDownload={onDownload} />
        <div className="relative flex-1 min-h-0">
          <div ref={scrollRef} onScroll={onScroll} className="absolute inset-0 overflow-auto">
            <div className="min-w-full w-max flex flex-col items-center gap-4 py-8">
              {error && <p className="text-body text-white">No se pudo abrir el PDF.</p>}
              {sizes.map((s, i) => (
                <div
                  key={i}
                  data-page={i}
                  ref={(el) => { pageEls.current[i] = el; }}
                  className="bg-white shadow-float shrink-0"
                  style={{ width: s.w * scale, height: s.h * scale }}
                >
                  <canvas />
                </div>
              ))}
            </div>
          </div>
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
              <Spinner size="md" />
            </div>
          )}
          <PdfFloatingToolbar
            page={page}
            pageCount={sizes.length}
            onPrev={() => goTo(page - 1)}
            onNext={() => goTo(page + 1)}
            onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
            onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
            zoomInDisabled={zoom >= MAX_ZOOM}
            zoomOutDisabled={zoom <= MIN_ZOOM}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";

// pdfjs-dist pesa mucho: se importa dinamico, solo cuando hay un PDF que
// miniaturizar (no entra al bundle inicial).
const THUMB_WIDTH = 320; // px; suficiente para max-h-36 / tarjetas, bajo peso

// Cache por clave (URL o nombre+tamano+fecha del File): una sola generacion
// por PDF aunque la burbuja se re-renderice o se virtualice.
const cache = new Map<string, Promise<string | null>>();

export function isPdfName(name: string | null | undefined): boolean {
  return !!name && /\.pdf$/i.test(name);
}

// pdfjs ya configurado con su worker (lo comparten miniaturas y visor).
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerSrc } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  return pdfjs;
}

async function render(data: ArrayBuffer): Promise<string | null> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.7));
    return blob ? URL.createObjectURL(blob) : null;
  } finally {
    void task.destroy();
  }
}

// Miniatura de la primera pagina de un PDF (blob: URL de baja resolucion).
// Recibe un File (seleccion) o una URL (adjunto ya enviado / blob local).
// null = no es PDF o no se pudo generar -> la UI usa el icono <FileText />.
export function generateThumbnail(source: File | string): Promise<string | null> {
  const isFile = typeof source !== "string";
  if (isFile && !(source.type === "application/pdf" || isPdfName(source.name))) return Promise.resolve(null);
  const key = isFile ? `${source.name}:${source.size}:${source.lastModified}` : source;
  const hit = cache.get(key);
  if (hit) return hit;

  const job = (async () => {
    try {
      const data = isFile
        ? await source.arrayBuffer()
        : await fetch(source, { credentials: "include" }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))));
      return await render(data);
    } catch {
      return null;
    }
  })();
  cache.set(key, job);
  return job;
}

// source null = no aplica (no es PDF): no genera nada.
// `pending` distingue "aun generando" de "fallo / no aplica", para que la UI
// reserve el alto de la portada solo mientras se genera (sin salto de layout).
export function usePdfThumbnailState(source: File | string | null): { url: string | null; pending: boolean } {
  const [state, setState] = useState<{ url: string | null; pending: boolean }>({ url: null, pending: !!source });
  useEffect(() => {
    let alive = true;
    setState({ url: null, pending: !!source });
    if (source) generateThumbnail(source).then((u) => { if (alive) setState({ url: u, pending: false }); });
    return () => { alive = false; };
  }, [source]);
  return state;
}

export function usePdfThumbnail(source: File | string | null): string | null {
  return usePdfThumbnailState(source).url;
}

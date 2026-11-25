import { generateFriendlyFilename, getFileUrl, isImageFile } from "@/lib/file-url-utils";
import { isPdfName } from "@/lib/pdf-thumbnail";
import type { ChatAttachment, AttachmentRenderKind } from "./types";

// Medidas (px) de la imagen en la burbuja. Unica fuente: la caja reservada y el estimado del virtualizer las calculan en JS.
export const CHAT_IMAGE_MAX_W = 300; // imagen sola
export const CHAT_IMAGE_INLINE_MAX_W = 280; // imagen con texto debajo
export const CHAT_IMAGE_MAX_H = 320;

/**
 * Extension en mayusculas de un nombre de archivo ("informe.final.pdf" -> "PDF").
 *
 * @param {string} name - Nombre de archivo.
 * @returns {string} Extension en mayusculas, o "" si no tiene (1 a 5 caracteres).
 */
export function fileExtension(name: string): string {
  return /\.[a-z0-9]{1,5}$/i.test(name) ? name.split(".").pop()!.toUpperCase() : "";
}

/**
 * Resultado de consultar el Content-Type de un adjunto sin nombre original.
 */
export interface AttachmentProbe {
  /** Tipo de renderizado deducido del Content-Type. */
  kind: AttachmentRenderKind;
  /** Extension probable (sin punto) para nombrar el archivo, si se reconoce. */
  ext?: string;
}

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
  "text/plain": "txt",
  "text/csv": "csv",
};

/**
 * URL de la miniatura (WebP del ancho pedido) de una imagen de Object Storage; las demas
 * fuentes (`blob:`, `/uploads/`, externas) no tienen miniatura y se devuelven igual.
 * La burbuja muestra max. 300 CSS px, asi que 640px (por defecto) cubre pantallas 2x; los
 * recuadros chicos (cita de respuesta) usan 320. El visor usa el original. El servidor solo
 * acepta 320 y 640.
 *
 * @param {string} url - URL absoluta del adjunto.
 * @param {320 | 640} [width] - Ancho de la miniatura.
 * @returns {string} URL de la miniatura, o la misma URL si no aplica.
 */
export function thumbnailUrl(url: string, width: 320 | 640 = 640): string {
  return url.includes("/objects/") ? `${url}${url.includes("?") ? "&" : "?"}w=${width}` : url;
}

/**
 * Dimensiones de una imagen local (File) con la orientacion EXIF ya aplicada, para que el
 * mensaje optimista reserve la caja correcta mientras se envia.
 *
 * @param {File} file - Imagen seleccionada.
 * @returns {Promise<{ w: number; h: number } | null>} Ancho/alto en px, o `null` si no se pudo decodificar.
 */
export async function readImageSize(file: File): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const size = { w: bmp.width, h: bmp.height };
    bmp.close();
    return size;
  } catch {
    return null;
  }
}

const probeCache = new Map<string, Promise<AttachmentProbe | null>>();

/**
 * Consulta (HEAD) el Content-Type de un adjunto que no trae nombre original
 * (mensajes anteriores a `attachment_names`; las rutas `/objects/uploads/<uuid>`
 * no tienen extension) para saber si es imagen, PDF u otro documento.
 * El resultado se guarda en cache de modulo: cada ruta se consulta una sola vez.
 *
 * @param {string} url - URL absoluta del adjunto.
 * @returns {Promise<AttachmentProbe | null>} El tipo deducido, o `null` si la consulta falla.
 */
export function probeAttachment(url: string): Promise<AttachmentProbe | null> {
  const hit = probeCache.get(url);
  if (hit) return hit;
  const job = (async () => {
    try {
      const r = await fetch(url, { method: "HEAD", credentials: "include" });
      if (!r.ok) return null;
      const mime = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (mime.startsWith("image/")) return { kind: "image" as const };
      const ext = MIME_EXT[mime];
      return { kind: mime === "application/pdf" ? ("pdf" as const) : ("document" as const), ext };
    } catch {
      return null;
    }
  })();
  probeCache.set(url, job);
  return job;
}

/**
 * Decide como pintar un adjunto.
 *
 * Con nombre original conocido la extension manda (un PDF guardado en
 * `/objects/` no se intenta como `<img>`). Sin nombre (mensajes antiguos) se usa
 * el resultado de {@link probeAttachment} cuando ya llego; mientras tanto, los
 * `blob:` y las rutas de Object Storage se intentan como imagen y, si el
 * navegador no puede decodificarlas (`failed`), caen a documento.
 *
 * @param {string} path - Ruta guardada del adjunto.
 * @param {string | undefined} originalName - Nombre original, si se conoce.
 * @param {boolean} failed - La imagen ya fallo al cargar (no era imagen).
 * @param {AttachmentProbe | undefined} probe - Tipo deducido por Content-Type, si ya se consulto.
 * @returns {AttachmentRenderKind} `image`, `pdf` o `document`.
 */
export function resolveAttachmentKind(path: string, originalName: string | undefined, failed: boolean, probe?: AttachmentProbe): AttachmentRenderKind {
  if (originalName) {
    if (isImageFile(originalName) && !failed) return "image";
    return isPdfName(originalName) ? "pdf" : "document";
  }
  if (probe) return probe.kind === "image" && failed ? "document" : probe.kind;
  const maybeImage = path.startsWith("blob:") || path.startsWith("/objects/") || isImageFile(path);
  return maybeImage && !failed ? "image" : "document";
}

/**
 * Convierte los arrays paralelos de un mensaje (`attachments`, `attachmentNames`,
 * `attachmentSizes`) en una lista de adjuntos listos para la UI. SIEMPRE devuelve
 * un adjunto por ruta: todos pasan por el mismo selector de tarjetas.
 *
 * @param {object} msg - Mensaje con los arrays de adjuntos.
 * @param {Set<string>} failedImages - Rutas que ya fallaron como imagen.
 * @param {Map<string, AttachmentProbe>} [probes] - Tipos deducidos por Content-Type (adjuntos sin nombre).
 * @returns {ChatAttachment[]} Adjuntos resueltos (misma longitud y orden que `msg.attachments`).
 */
export function buildChatAttachments(
  msg: { attachments?: string[] | null; attachmentNames?: string[] | null; attachmentSizes?: number[] | null; attachmentDims?: Array<{ w: number; h: number } | null> | null },
  failedImages: Set<string>,
  probes?: Map<string, AttachmentProbe>,
): ChatAttachment[] {
  return (msg.attachments ?? []).map((path, i) => {
    const originalName = msg.attachmentNames?.[i] || undefined;
    const probe = originalName ? undefined : probes?.get(path);
    const friendly = generateFriendlyFilename(path, i + 1);
    return {
      path,
      url: path.startsWith("blob:") ? path : getFileUrl(path),
      originalName,
      // Sin nombre original: nombre amigable + extension deducida del Content-Type.
      name: originalName || (probe?.ext ? `${friendly}.${probe.ext}` : friendly),
      size: msg.attachmentSizes?.[i],
      dims: msg.attachmentDims?.[i] ?? null,
      kind: resolveAttachmentKind(path, originalName, failedImages.has(path), probe),
    };
  });
}

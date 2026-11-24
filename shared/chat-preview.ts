export const ATTACHMENT_PLACEHOLDER = "📎 Archivo adjunto";

/**
 * Datos reducidos del mensaje citado que viajan junto a una respuesta.
 */
export interface ReplyPreview {
  id: string;
  /** Texto del mensaje original (puede ser el placeholder de adjunto). */
  message: string;
  senderId: string;
  /** Nombre del autor del mensaje original. */
  senderName: string;
  attachments: string[] | null;
  attachmentNames: string[] | null;
}

export type AttachmentKind = "image" | "file";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

// Tipo de un adjunto por su nombre original o, si no hay, por la extension de
// la ruta. Rutas de Object Storage (/objects/uploads/<uuid>) no tienen
// extension: sin nombre original el tipo es desconocido (null) y el servidor
// lo resuelve con el Content-Type del objeto.
export function attachmentKindFromName(name: string | null | undefined, path: string): AttachmentKind | null {
  const n = name || path;
  if (n.startsWith("blob:")) return "image";
  if (IMAGE_EXT.test(n)) return "image";
  if (/\.[a-z0-9]{1,5}$/i.test(n)) return "file";
  return name ? "file" : null;
}

// "image" solo si TODOS los adjuntos son imagen; null si no hay adjuntos o
// alguno es desconocido.
export function chatAttachmentKind(attachments?: string[] | null, names?: (string | null)[] | null): AttachmentKind | null {
  if (!attachments || attachments.length === 0) return null;
  const kinds = attachments.map((a, i) => attachmentKindFromName(names?.[i], a));
  if (kinds.some(k => k === null)) return null;
  return kinds.every(k => k === "image") ? "image" : "file";
}

// Texto del ultimo mensaje en la lista de conversaciones. Sin emoji: el
// icono (Lucide) lo pinta la UI segun el tipo. Adjunto sin texto propio:
// "Foto" (imagen) o el nombre del documento ("Archivo" si no se conoce);
// con texto, el texto.
export function chatPreviewText(
  message: string | null | undefined,
  attachments?: string[] | null,
  names?: (string | null)[] | null,
  kind: AttachmentKind | null = chatAttachmentKind(attachments, names),
): string {
  if (!attachments || attachments.length === 0) return message || "";
  const text = (message || "").trim();
  if (text && text !== ATTACHMENT_PLACEHOLDER) return text;
  if (kind === "image") return "Foto";
  return names?.find(n => !!n) || "Archivo";
}

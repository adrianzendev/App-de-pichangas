/**
 * Tipo de renderizado de un adjunto en la burbuja del chat.
 * - `image`: se pinta como imagen (borde a borde si es el unico contenido).
 * - `pdf`: tarjeta de documento con miniatura de la primera pagina.
 * - `document`: tarjeta de documento generica (Excel, Word, TXT, ZIP, PDF sin nombre...).
 */
export type AttachmentRenderKind = "image" | "pdf" | "document";

/**
 * Metadatos basicos de un archivo para mostrar en una tarjeta.
 */
export interface FileMetaProps {
  /** Nombre a mostrar (original si se conoce; si no, uno amigable). */
  name: string;
  /** Peso en bytes; 0/undefined/null = desconocido. */
  size?: number | null;
}

/**
 * Adjunto de un mensaje ya resuelto para la UI: ruta guardada, URL utilizable,
 * nombre/peso y tipo de renderizado.
 */
export interface ChatAttachment extends FileMetaProps {
  /** Ruta tal como se guarda en `chat_messages.attachments` (o `blob:` local mientras se envia). */
  path: string;
  /** URL absoluta lista para `<img src>` / `fetch` / visor. */
  url: string;
  /** Nombre original conocido (undefined en mensajes anteriores a `attachment_names`). */
  originalName?: string;
  /** Como se debe pintar (imagen, PDF con portada o documento generico). */
  kind: AttachmentRenderKind;
  /** Dimensiones en px de la imagen, si el servidor las guardo (permite reservar la caja antes de cargar). */
  dims?: { w: number; h: number } | null;
}

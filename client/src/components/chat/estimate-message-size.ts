import { isImageFile } from "@/lib/file-url-utils";
import { isPdfName } from "@/lib/pdf-thumbnail";
import { CHAT_IMAGE_MAX_H, CHAT_IMAGE_MAX_W } from "./attachments/attachment-utils";
import { parseQuoteFromMessage } from "./chat-quote-utils";
import type { Message } from "./chat-types";

// Alturas aproximadas (px) de cada pieza de una fila del chat. Solo son el
// estimado INICIAL del virtualizer: una vez montada, la fila se mide de verdad.
// Cuanto mas cerca de la altura real, menos se reajusta el alto total (y la
// barra de scroll) al recorrer zonas todavia no medidas.
/**
 * Espacio vertical (px) entre burbujas. Unico punto de edicion; igual para emisor y receptor:
 * - `MESSAGE_ROW_GAP` (4): mensajes SEGUIDOS del mismo remitente (rachas pegadas, ambos lados).
 * - `MESSAGE_TURN_GAP` (12): cuando CAMBIA el remitente (emisor <-> receptor).
 * `messageRowGap` decide cual aplica; `MessageList` lo usa como `paddingBottom` de la fila.
 */
export const MESSAGE_ROW_GAP = 4;
export const MESSAGE_TURN_GAP = 12;
export function messageRowGap(msg: Message | undefined, next: Message | undefined): number {
  return next && msg && next.senderId !== msg.senderId ? MESSAGE_TURN_GAP : MESSAGE_ROW_GAP;
}
const ROW_GAP = MESSAGE_ROW_GAP;
const DATE_SEPARATOR = 36;
const REPLY_QUOTE = 52;
const QUOTE_CARD = 230;
const IMAGE = 220; // caja reservada (ImageAttachmentCard, 4:3 al ancho maximo)
const PDF = 230; // portada h-36 + tarjeta de documento
const DOCUMENT = 96;
const TEXT_LINE = 24; // text-body: linea de 24px
const TEXT_PADDING = 24;
const CHARS_PER_LINE = 30; // burbuja ~260px a 16px

/** Alto de la caja de imagen (ancho max. 300px, alto max. 320px, sin ampliar). */
function imageHeight(d: { w: number; h: number }): number {
  const w = Math.min(CHAT_IMAGE_MAX_W, CHAT_IMAGE_MAX_H * (d.w / d.h), d.w);
  return Math.round(w * (d.h / d.w));
}

/**
 * Altura estimada de la fila de un mensaje (para `estimateSize` del virtualizer).
 *
 * @param {Message | undefined} msg - Mensaje de la fila.
 * @param {Message | null | undefined} prev - Mensaje anterior (para el separador de fecha).
 * @returns {number} Alto aproximado en px, incluido el espacio entre filas.
 */
export function estimateMessageSize(msg: Message | undefined, prev?: Message | null): number {
  if (!msg) return 80;
  let h = ROW_GAP;

  const day = (m: Message) => new Date(m.createdAt || m.timestamp).toDateString();
  if (!prev || day(prev) !== day(msg)) h += DATE_SEPARATOR;
  if (msg.replyTo) h += REPLY_QUOTE;

  if (parseQuoteFromMessage(msg.message || "")) {
    h += QUOTE_CARD;
  } else if (msg.message) {
    h += TEXT_PADDING + TEXT_LINE * Math.max(1, Math.ceil(msg.message.length / CHARS_PER_LINE));
  }

  (msg.attachments ?? []).forEach((path, i) => {
    const name = msg.attachmentNames?.[i] || "";
    const dim = msg.attachmentDims?.[i];
    if (dim) h += imageHeight(dim);
    else if (!name) h += IMAGE; // adjunto antiguo sin nombre: se intenta como imagen
    else if (isImageFile(name)) h += IMAGE;
    else if (isPdfName(name)) h += PDF;
    else h += DOCUMENT;
  });

  return h;
}

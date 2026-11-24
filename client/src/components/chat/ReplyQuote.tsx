import { useEffect, useState } from "react";
import { ChatIconButton } from "./chat-icon-button";
import { FileText, Image as ImageIcon, X } from "lucide-react";
import { chatAttachmentKind, chatPreviewText, type ReplyPreview } from "@shared/chat-preview";
import { getFileUrl } from "@/lib/file-url-utils";
import { probeAttachment, thumbnailUrl } from "@/components/chat/attachments/attachment-utils";

/**
 * Propiedades de {@link ReplyQuote}.
 */
export interface ReplyQuoteProps {
  /** Datos reducidos del mensaje citado. */
  replyTo: ReplyPreview;
  /** Id del usuario que mira el chat: si es el autor del citado se muestra "Tú". */
  meId: string;
  /** Clases extra (margen segun el layout de la burbuja). */
  className?: string;
  /** Si se pasa, muestra una X para cancelar (barra del composer). */
  onCancel?: () => void;
}

/**
 * Caja de cita estilo WhatsApp: borde lateral verde, fondo sutil `bg-black/5`, nombre
 * del autor en verde y el texto citado (o "Foto" / nombre del archivo, con su icono
 * Lucide) truncado a dos lineas. Si el mensaje citado es una imagen, a la derecha va su
 * miniatura cuadrada (`w-10 h-10 object-cover`). Se usa dentro de la burbuja de una
 * respuesta y, con `onCancel`, como barra de pre-respuesta sobre el composer.
 *
 * @param {ReplyQuoteProps} props - Mensaje citado, usuario actual y opciones.
 * @returns {JSX.Element} La cita.
 */
export function ReplyQuote({ replyTo, meId, className = "", onCancel }: ReplyQuoteProps) {
  const nameKind = chatAttachmentKind(replyTo.attachments, replyTo.attachmentNames);
  const hasAttachment = !!replyTo.attachments?.length;
  const firstPath = replyTo.attachments?.[0];

  // Adjunto sin nombre original (mensajes antiguos): el tipo se deduce por Content-Type (HEAD cacheado).
  const [probedImage, setProbedImage] = useState(false);
  useEffect(() => {
    if (nameKind !== null || !firstPath?.startsWith("/objects/")) return;
    let alive = true;
    probeAttachment(getFileUrl(firstPath)).then((p) => { if (alive && p?.kind === "image") setProbedImage(true); });
    return () => { alive = false; };
  }, [nameKind, firstPath]);
  const kind = nameKind ?? (probedImage ? "image" : null);

  const text = chatPreviewText(replyTo.message, replyTo.attachments, replyTo.attachmentNames, kind);
  // Miniatura solo si TODOS los adjuntos son imagen (kind === "image"): la del primero.
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumbSrc = kind === "image" && firstPath
    ? thumbnailUrl(firstPath.startsWith("blob:") ? firstPath : getFileUrl(firstPath), 320)
    : null;
  return (
    <div className={`flex items-center justify-between gap-2 overflow-hidden rounded-md border-l-4 border-green-600 bg-scrim/5 px-2 py-1 min-w-0 ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="text-caption font-semibold text-green-600 truncate">
          {replyTo.senderId === meId ? "Tú" : replyTo.senderName}
        </p>
        {/* Icono y texto en la MISMA linea (flex; line-clamp en un hijo, no en el flex). */}
        <div className="flex items-center gap-1 text-caption text-gray-700 min-w-0">
          {hasAttachment && (kind === "image"
            ? <ImageIcon className="size-icon-star shrink-0" />
            : <FileText className="size-icon-star shrink-0" />)}
          <span className="line-clamp-2 break-words min-w-0">{text}</span>
        </div>
      </div>
      {thumbSrc && !thumbFailed && (
        <img
          src={thumbSrc}
          alt="Vista previa"
          loading="lazy"
          decoding="async"
          className="size-icon-box object-cover rounded-md flex-shrink-0"
          onError={() => setThumbFailed(true)}
        />
      )}
      {onCancel && (
        <ChatIconButton onClick={onCancel} aria-label="Cancelar respuesta" className="-my-2 -mr-2">
          <X className="size-icon-md" />
        </ChatIconButton>
      )}
    </div>
  );
}

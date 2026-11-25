import type { ReactNode } from "react";
import { DocumentAttachmentCard } from "./DocumentAttachmentCard";
import { ImageAttachmentCard } from "./ImageAttachmentCard";
import { PdfPreviewCard } from "./PdfPreviewCard";
import type { MenuAction } from "../menu-actions";
import type { ChatAttachment } from "./types";

/**
 * Propiedades de {@link MessageAttachment}.
 */
export interface MessageAttachmentProps {
  /** Adjunto ya resuelto (ver `buildChatAttachments`). */
  attachment: ChatAttachment;
  /** El mensaje es del usuario actual. */
  isCurrentUser: boolean;
  /** El mensaje aun se esta enviando. */
  isSending: boolean;
  /** El receptor ya descargo el archivo. */
  downloaded?: boolean;
  /** El adjunto es el unico contenido de la burbuja (imagen borde a borde / tarjeta sin doble contenedor). */
  fill?: boolean;
  /** Hora + checks que la tarjeta integra en su propio diseno (solo con `fill`). */
  footer?: ReactNode;
  /** Acciones del mensaje para la flecha de opciones de la tarjeta de documento. */
  menuActions?: MenuAction[];
  /** Leyenda que acompana a un documento (se pinta dentro de la tarjeta, sobre los botones). */
  caption?: string;
  /** Abrir una imagen en el visor a pantalla completa. */
  onOpenImage: (attachment: ChatAttachment) => void;
  /** Abrir un PDF en el visor de documentos. */
  onOpenPdf: (attachment: ChatAttachment) => void;
  /** Abrir cualquier otro documento (por defecto, en el navegador). */
  onOpenOther: (attachment: ChatAttachment) => void;
  /** Descargar el archivo. */
  onDownload: (attachment: ChatAttachment) => void;
  /** Una "imagen" no se pudo decodificar: marcarla como documento. */
  onImageError: (attachment: ChatAttachment) => void;
}

/**
 * Selector de tarjeta de adjunto: segun `attachment.kind` pinta una imagen
 * ({@link ImageAttachmentCard}), un PDF con portada ({@link PdfPreviewCard}) o un
 * documento generico ({@link DocumentAttachmentCard}), conectando los callbacks
 * correspondientes.
 *
 * @param {MessageAttachmentProps} props - Adjunto, estado del mensaje y callbacks.
 * @returns {JSX.Element} La tarjeta adecuada para el tipo de archivo.
 */
export function MessageAttachment({
  attachment, isCurrentUser, isSending, downloaded, fill, footer, caption, menuActions,
  onOpenImage, onOpenPdf, onOpenOther, onDownload, onImageError,
}: MessageAttachmentProps) {
  if (attachment.kind === "image") {
    return (
      <ImageAttachmentCard
        src={attachment.url}
        isCurrentUser={isCurrentUser}
        isSending={isSending}
        downloaded={downloaded}
        fill={fill}
        footer={footer}
        dims={attachment.dims}
        onOpen={() => onOpenImage(attachment)}
        onError={() => onImageError(attachment)}
      />
    );
  }

  const card = {
    name: attachment.name,
    size: attachment.size,
    isCurrentUser,
    isSending,
    downloaded,
    bare: fill,
    footer: fill ? footer : undefined,
    caption,
    menuActions,
    onSave: () => onDownload(attachment),
  };

  return attachment.kind === "pdf"
    ? <PdfPreviewCard {...card} pdfSrc={attachment.url} onOpen={() => onOpenPdf(attachment)} />
    : <DocumentAttachmentCard {...card} onOpen={() => onOpenOther(attachment)} />;
}

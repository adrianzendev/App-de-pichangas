import { Skeleton } from "@/components/ui/skeleton";
import { usePdfThumbnailState } from "@/lib/pdf-thumbnail";
import { ClickableMedia } from "../clickable-media";
import { DocumentAttachmentCard, type DocumentAttachmentCardProps } from "./DocumentAttachmentCard";

/**
 * Propiedades de {@link PdfPreviewCard}: las de la tarjeta de documento mas la
 * fuente del PDF para generar la portada.
 */
export interface PdfPreviewCardProps extends Omit<DocumentAttachmentCardProps, "header"> {
  /** URL (http o `blob:`) del PDF del que se extrae la primera pagina. */
  pdfSrc: string;
}

/**
 * Tarjeta de PDF: la portada (pagina 1, `h-36 object-cover`) arriba y debajo
 * la tarjeta de documento estandar (extension, peso, nombre, hora y acciones).
 * Mientras la portada se genera reserva su alto (`h-36` con skeleton) para que
 * la fila no cambie de tamano al aparecer; si falla, no ocupa espacio y se ve
 * como una tarjeta de documento normal. Hacer clic en la portada abre el visor.
 *
 * @param {PdfPreviewCardProps} props - Propiedades de la tarjeta de documento + `pdfSrc`.
 * @returns {JSX.Element} La tarjeta del PDF con su miniatura.
 */
export function PdfPreviewCard({ pdfSrc, ...card }: PdfPreviewCardProps) {
  const { url: thumb, pending } = usePdfThumbnailState(pdfSrc);
  return (
    <DocumentAttachmentCard
      {...card}
      header={thumb ? (
        <ClickableMedia aria-label="Abrir PDF" onClick={card.onOpen} className="w-full">
          <img src={thumb} alt="Vista previa" className="block h-pdf-cover w-full object-cover object-top" />
        </ClickableMedia>
      ) : pending ? (
        <Skeleton className="h-pdf-cover w-full rounded-none bg-gray-300" aria-hidden="true" />
      ) : undefined}
    />
  );
}

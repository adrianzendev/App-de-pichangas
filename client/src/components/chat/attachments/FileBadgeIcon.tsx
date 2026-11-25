import { FileText } from "lucide-react";

/**
 * Propiedades de {@link FileBadgeIcon}.
 */
export interface FileBadgeIconProps {
  /** Extension del archivo, con o sin punto y en cualquier caso ("pdf", "XLSX", ".docx"). */
  extension: string;
  /** Tamano del cuadro: `sm` (32 px, chips) o `md` (48 px, tarjetas del chat). */
  size?: "sm" | "md";
}

/**
 * Color y contenido de la insignia segun la extension (estilo WhatsApp): Excel
 * verde "X", Word azul "W", PowerPoint rojo "P", PDF rojo "PDF"; el resto, gris
 * con el icono de documento.
 *
 * @param {string} ext - Extension normalizada en mayusculas.
 * @returns {{ bg: string; label: string | null }} Clase de fondo y letra (`null` = icono de documento).
 */
function badgeFor(ext: string): { bg: string; label: string | null } {
  switch (ext) {
    case "XLSX": case "XLS": case "CSV": return { bg: "bg-file-excel", label: "X" };
    case "DOCX": case "DOC": return { bg: "bg-file-word", label: "W" };
    case "PPTX": case "PPT": return { bg: "bg-file-ppt", label: "P" };
    case "PDF": return { bg: "bg-file-pdf", label: "PDF" };
    default: return { bg: "bg-file-default", label: null };
  }
}

/**
 * Cuadro redondeado con el color distintivo del tipo de archivo y su letra o
 * icono interno. Se reutiliza en las tarjetas de documento del chat (`md`) y en
 * el chip de "Archivos seleccionados" antes de enviar (`sm`).
 *
 * @param {FileBadgeIconProps} props - Extension y tamano.
 * @returns {JSX.Element} La insignia (decorativa, `aria-hidden`).
 */
export function FileBadgeIcon({ extension, size = "md" }: FileBadgeIconProps) {
  const badge = badgeFor(extension.replace(/^\./, "").toUpperCase());
  const box = size === "sm" ? "size-icon-xl rounded-md" : "size-thumb rounded-md";
  const long = !!badge.label && badge.label.length > 1;
  const text = size === "sm" || long ? "text-caption" : "text-heading";
  const icon = size === "sm" ? "size-icon-md" : "size-icon-badge";
  return (
    <div className={`${box} flex items-center justify-center flex-shrink-0 text-white font-bold ${badge.bg} ${text}`} aria-hidden>
      {badge.label ?? <FileText className={icon} />}
    </div>
  );
}

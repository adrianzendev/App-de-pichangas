import { DeleteIconButton } from "@/components/ui/delete-button";
import { fileMetaText } from "@/lib/file-url-utils";
import { fileExtension } from "./attachment-utils";
import { FileBadgeIcon } from "./FileBadgeIcon";

/**
 * Propiedades de {@link SelectedFileChip}.
 */
export interface SelectedFileChipProps {
  /** Archivo elegido por el usuario, aun sin enviar. */
  file: File;
  /** Quita el archivo de la seleccion. */
  onRemove: () => void;
}

/**
 * Chip de un archivo no-imagen en la barra "Archivos seleccionados" (pre-envio):
 * insignia de color por tipo, nombre truncado, `EXT • PESO` en la segunda linea y
 * papelera (`DeleteIconButton`) para quitarlo.
 *
 * @param {SelectedFileChipProps} props - Archivo y callback de eliminacion.
 * @returns {JSX.Element} El chip del archivo seleccionado.
 */
export function SelectedFileChip({ file, onRemove }: SelectedFileChipProps) {
  const ext = fileExtension(file.name);
  const meta = fileMetaText(ext, file.size);
  return (
    <div className="flex items-center gap-2 bg-white p-2 rounded-md shadow-sm">
      <FileBadgeIcon extension={ext} size="sm" />
      <div className="min-w-0">
        <span className="text-caption font-medium text-gray-900 truncate max-w-chip block">{file.name}</span>
        <span className="text-caption text-gray-700 block">{meta}</span>
      </div>
      <DeleteIconButton onClick={onRemove} aria-label="Quitar archivo" className="-my-2 -mr-2 shrink-0" />
    </div>
  );
}

import { useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { FilePickerError, pickFiles, type PickOptions, type PickSource } from "@/lib/file-picker";
import { reportAttachmentFailure } from "@/lib/report-attachment-failure";

const PERMISSION_MESSAGE: Record<PickSource, string> = {
  camera: "No hay permiso para usar la cámara. Actívalo en los ajustes del dispositivo.",
  gallery: "No hay permiso para acceder a tus fotos. Actívalo en los ajustes del dispositivo.",
  files: "No hay permiso para acceder a tus archivos. Actívalo en los ajustes del dispositivo.",
};

/**
 * Selector de archivos para la UI: `pick(source)` abre el selector y entrega los archivos a `onFiles`.
 * Cancelar no hace nada; permiso denegado o lectura fallida muestran un aviso y nunca lanzan hacia el componente.
 *
 * @param onFiles - Recibe siempre una lista no vacia.
 * @param defaults - Opciones del selector (p. ej. `accept` propio de la pantalla); `pick` puede sobrescribirlas.
 */
export function useFilePicker(onFiles: (files: File[]) => void, defaults: PickOptions = {}) {
  const { toast } = useToast();
  const onFilesRef = useRef(onFiles);
  useEffect(() => { onFilesRef.current = onFiles; });
  const { accept, multiple } = defaults;

  const pick = useCallback(
    async (source: PickSource, options: PickOptions = {}) => {
      try {
        const files = await pickFiles(source, { accept, multiple, ...options });
        if (files.length > 0) onFilesRef.current(files);
      } catch (error) {
        const code = error instanceof FilePickerError ? error.code : "read-failed";
        reportAttachmentFailure({
          reason: code,
          source,
          files: error instanceof FilePickerError ? error.files : [],
          detail: error instanceof FilePickerError ? undefined : String((error as Error)?.message ?? error),
        });
        toast({
          title: "No se pudo añadir el archivo",
          description: code === "permission-denied" ? PERMISSION_MESSAGE[source] : "No se pudo leer el archivo. Inténtalo de nuevo.",
          variant: "destructive",
        });
      }
    },
    [toast, accept, multiple],
  );

  return { pick };
}

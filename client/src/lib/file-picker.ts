// Seleccion de archivos/fotos desacoplada de la UI. Hoy usa <input type="file"> en memoria (web).
//
// Capacitor: al instalar @capacitor/camera (+ @capacitor/filesystem) basta con cambiar `pickFiles` para que
// llame a `pickNative` cuando `Capacitor.isNativePlatform()` sea true. Contrato de `pickNative`:
//   - camera  -> Camera.getPhoto({ source: CameraSource.Camera, resultType: Uri })  -> fetch(webPath) -> File
//   - gallery -> Camera.pickImages({ limit })                                        -> fetch(webPath) -> File
//   - files   -> selector de documentos del sistema                                  -> File
//   - permiso denegado -> lanzar FilePickerError("permission-denied"); fallo al leer -> "read-failed".
// Ni los modales ni `useFilePicker` cambian.

export type PickSource = "camera" | "gallery" | "files";

export type FilePickerErrorCode = "permission-denied" | "read-failed";

export class FilePickerError extends Error {
  /** `files`: los archivos que entrego el selector (si los hubo), para reportar cual fallo. */
  constructor(public readonly code: FilePickerErrorCode, message?: string, public readonly files: File[] = []) {
    super(message ?? code);
    this.name = "FilePickerError";
  }
}

export interface PickOptions {
  /** Atributo `accept` (por defecto: imagenes para camara y galeria, cualquier archivo para `files`). */
  accept?: string;
  /** Por defecto: una foto con la camara, varias en galeria y archivos. */
  multiple?: boolean;
}

/**
 * Abre el selector del origen indicado. Devuelve `[]` si el usuario cancela.
 * Debe llamarse de forma sincrona dentro del gesto del usuario (clic): los navegadores bloquean el selector si no.
 *
 * @throws {FilePickerError} `read-failed` si algun archivo llega vacio o ilegible; `permission-denied` en nativo.
 */
export function pickFiles(source: PickSource, options: PickOptions = {}): Promise<File[]> {
  return pickWeb(source, options);
}

function pickWeb(source: PickSource, { accept, multiple }: PickOptions): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    if (source === "files") {
      if (accept) input.accept = accept;
    } else {
      input.accept = accept ?? "image/*";
    }
    if (source === "camera") input.capture = "environment";
    input.multiple = multiple ?? source !== "camera";

    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      // Un archivo de 0 bytes es lo que entregan los proveedores en la nube (Drive, iCloud) cuando falla la lectura.
      if (files.some((f) => f.size === 0)) reject(new FilePickerError("read-failed", undefined, files));
      else resolve(files);
    });
    input.addEventListener("cancel", () => resolve([]));
    input.click();
  });
}

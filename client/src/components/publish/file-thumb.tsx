import { usePdfThumbnail } from "@/lib/pdf-thumbnail";
import { FileBadgeIcon, fileExtension } from "@/components/chat/attachments";

export interface UploadedFile {
  id: string; name: string; size: number; preview?: string;
  status: 'uploading' | 'done' | 'error'; progress: number;
  serverPath?: string; errorMessage?: string;
  /** Rechazado antes de subir (p. ej. por peso): reintentar no serviria. */
  rejected?: boolean;
}

/* ─── FileThumb: vista previa de un adjunto (misma logica visual que el chat) ───
   Imagen: foto completa. PDF: portada de la pagina 1. Otros: insignia por tipo. */
export function FileThumb({ file, source }: { file: UploadedFile; source?: File }) {
  const ext = fileExtension(file.name);
  const cover = usePdfThumbnail(ext === "PDF" && !file.preview ? source ?? null : null);
  const src = file.preview ?? cover;
  return (
    <div className={`w-full h-full flex items-center justify-center ${file.status === 'uploading' ? 'opacity-50' : ''}`}>
      {src
        ? <img src={src} className="w-full h-full object-contain" alt={file.name} />
        : <FileBadgeIcon extension={ext} size="md" />}
    </div>
  );
}

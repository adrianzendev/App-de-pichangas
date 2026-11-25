import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { FileBadgeIcon } from "@/components/chat/attachments/FileBadgeIcon";
import { DocumentViewerModal } from "@/components/chat/attachments/DocumentViewerModal";
import { isPdfName } from "@/lib/pdf-thumbnail";
import { useToast } from "@/hooks/use-toast";
import { getFileUrl, isImageFile, downloadFile, generateFriendlyFilename, fileTypeLabel, fileMetaText } from "@/lib/file-url-utils";
import { useQuery } from "@tanstack/react-query";

interface EnhancedFileDisplayProps {
  files: string[];
  // Nombre original de cada archivo (mismo orden); si falta, se genera uno amigable.
  names?: string[];
  // Peso en bytes de cada archivo (mismo orden); si falta, se consulta al servidor.
  sizes?: number[];
  title?: string;
  showTitle?: boolean;
  // Sin tarjeta Bento por fila (para usar dentro de un modal que ya es el contenedor).
  flat?: boolean;
}

// Adjuntos de pedidos en Object Storage (/objects/uploads/<uuid>) no tienen
// extension: el tipo real sale del Content-Type.
async function isPdfByContentType(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', credentials: 'include' });
    return r.ok && (r.headers.get('content-type') || '').includes('application/pdf');
  } catch {
    return false;
  }
}

// "PDF · 240 KB". Los adjuntos de Object Storage no traen extension ni peso en
// el nombre: salen del HEAD (Content-Type / Content-Length).
function useFileMeta(url: string) {
  return useQuery({
    // v2: las respuestas anteriores (persistidas en IndexedDB) venian sin peso.
    queryKey: ["file-meta", "v2", url],
    staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch(url, { method: "HEAD", credentials: "include" });
      if (!r.ok) return null;
      const size = Number(r.headers.get("content-length"));
      return { type: fileTypeLabel(r.headers.get("content-type") || ""), size: size > 0 ? size : 0 };
    },
  });
}

function FileMeta({ url, filename, size }: { url: string; filename: string; size?: number }) {
  const { data } = useFileMeta(url);
  const nameExt = filename.includes(".") ? filename.split(".").pop()!.toUpperCase() : "";
  const text = fileMetaText(data?.type || nameExt, size || data?.size);
  return text ? <span className="block text-caption text-gray-500">{text}</span> : null;
}

// Misma insignia por tipo que el chat (Word azul, Excel verde, PDF coral...).
function FileTypeBadge({ url, filename }: { url: string; filename: string }) {
  const { data } = useFileMeta(url);
  const nameExt = filename.includes(".") ? filename.split(".").pop()! : "";
  return <FileBadgeIcon extension={nameExt || data?.type || ""} size="md" />;
}

export function EnhancedFileDisplay({ files, names, sizes, title = "Archivos adjuntos", showTitle = true, flat = false }: EnhancedFileDisplayProps) {
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; file: string; name: string } | null>(null);
  // PDF abierto en el visor modal (mismo que el chat): url, nombre y archivo original.
  const [pdfViewer, setPdfViewer] = useState<{ url: string; name: string; file: string } | null>(null);
  // Objeto de Object Storage sin extension (/objects/uploads/<uuid>) que se
  // intento mostrar como imagen y fallo (onError) -- no era imagen en
  // realidad (ej. PDF sin extension). Mismo patron que chat-fullscreen.tsx
  // (failedImages) para no repetir el intento ni abrir el lightbox roto.
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const isPDF = (filename: string): boolean => {
    return getFileExtension(filename) === 'pdf';
  };

  const handleDownload = (filename: string, friendlyName?: string) => {
    downloadFile(filename, friendlyName);
    const displayName = friendlyName || filename.split('/').pop() || filename;
    toast({
      title: "Descarga iniciada",
      description: `Descargando ${displayName}`,
    });
  };

  const handleView = async (filename: string, friendlyName?: string) => {
    const fileUrl = getFileUrl(filename);
    const tryAsImage = (isImageFile(filename) || filename.startsWith('/objects/')) && !failedImages.has(filename);
    if (tryAsImage) {
      setFullscreenImage({ url: fileUrl, file: filename, name: friendlyName || filename.split("/").pop() || filename });
    } else if (isPdfName(filename) || (await isPdfByContentType(fileUrl))) {
      setPdfViewer({ url: fileUrl, name: friendlyName || filename.split('/').pop() || filename, file: filename });
    } else {
      // Word, Excel, etc.: el navegador no los muestra. Abrir la URL los bajaria con el nombre interno (<uuid>.docx).
      handleDownload(filename, friendlyName);
    }
  };

  const closeFullscreen = () => {
    setFullscreenImage(null);
  };

  return (
    <>
      <div>
        {showTitle && (
          <h4 className="text-label font-medium text-gray-900 mb-3">{title}</h4>
        )}
        <div className="space-y-2">
          {files.map((file, index) => {
            const filename = file.split('/').pop() || file;
            const friendlyName = names?.[index] || generateFriendlyFilename(file, index + 1);
            // Objeto de Object Storage sin extension en el nombre
            // (/objects/uploads/<uuid>): isImageFile() por nombre no
            // alcanza. Se intenta como imagen igual, el onError decide (via
            // failedImages) si en realidad no lo era -- mismo patron ya
            // usado en chat-fullscreen.tsx para las burbujas del chat.
            const isImage = isImageFile(filename) || file.startsWith('/objects/');
            const tryAsImage = isImage && !failedImages.has(file);
            const isPdf = isPDF(filename);

            return (
              <div
                key={file}
                className={`flex items-center gap-3 overflow-hidden ${flat ? "py-1" : "p-3 bg-card rounded-lg border border-border"}`}
              >
                {/* Icon/Thumbnail */}
                {tryAsImage ? (
                  <div
                    className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 cursor-pointer bg-gray-200"
                    onClick={() => handleView(file, friendlyName)}
                  >
                    <img
                      src={getFileUrl(file)}
                      alt={filename}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={() => setFailedImages((prev) => new Set(prev).add(file))}
                    />
                  </div>
                ) : (
                  <div className={isPdf ? "cursor-pointer" : undefined} onClick={isPdf ? () => handleView(file, friendlyName) : undefined}>
                    <FileTypeBadge url={getFileUrl(file)} filename={filename} />
                  </div>
                )}

                {/* Filename + tipo y peso */}
                <div className="flex-1 min-w-0">
                  <span className="block text-label text-gray-700 truncate">{friendlyName}</span>
                  <FileMeta url={getFileUrl(file)} filename={filename} size={sizes?.[index]} />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(isImage || isPdf) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleView(file, friendlyName)}
                      aria-label={`Ver ${friendlyName}`}
                      title="Ver"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(file, friendlyName)}
                    aria-label={`Descargar ${friendlyName}`}
                    className="text-primary-600"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ImagePreviewModal
        src={fullscreenImage?.url ?? null}
        title={fullscreenImage?.name}
        onClose={closeFullscreen}
        onDownload={fullscreenImage ? () => handleDownload(fullscreenImage.file, fullscreenImage.name) : undefined}
      />
      <DocumentViewerModal
        url={pdfViewer?.url ?? null}
        name={pdfViewer?.name}
        onClose={() => setPdfViewer(null)}
        onDownload={pdfViewer ? () => handleDownload(pdfViewer.file, pdfViewer.name) : undefined}
      />
    </>
  );
}

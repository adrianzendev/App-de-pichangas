import * as React from "react";
import { useRef, useState } from "react";
import { fileToDataUrl } from "@/lib/utils";
import { TASK_FILE_MAX_BYTES, TASK_FILE_MAX_MB } from "@shared/file-limits";
import type { UploadedFile } from "./file-thumb";

// Archivos del pedido: cada uno se sube en segundo plano apenas se elige (POST /api/tasks/upload) y muestra
// su progreso. `fileObjectsRef` guarda los File originales para reintentar y para la portada de los PDF.
export function useFileUploads() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileObjectsRef = useRef<Map<string, File>>(new Map());

  const uploadFileInBackground = async (file: File, fileId: string) => {
    try {
      const formData = new FormData();
      formData.append('files', file);
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: Math.round((e.loaded / e.total) * 100) } : f));
        }
      });
      const result = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else { try { reject(new Error(JSON.parse(xhr.responseText).message || 'Upload failed')); } catch { reject(new Error('Upload failed')); } }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', '/api/tasks/upload');
        xhr.withCredentials = true;
        xhr.send(formData);
      });
      if (result.files?.length > 0) {
        setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'done' as const, progress: 100, serverPath: result.files[0].filename } : f));
      } else throw new Error('No file path returned');
    } catch (err: any) {
      setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error' as const, errorMessage: err.message } : f));
    }
  };

  const retryUpload = (fileId: string, file: File) => {
    setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'uploading' as const, progress: 0, errorMessage: undefined } : f));
    uploadFileInBackground(file, fileId);
  };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      fileObjectsRef.current.set(fileId, file);
      const newFile: UploadedFile = { id: fileId, name: file.name, size: file.size, status: 'uploading', progress: 0 };
      if (file.type.startsWith('image/')) {
        fileToDataUrl(file)
          .then((preview) => setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, preview } : f)))
          .catch(() => {});
      }
      if (file.size > TASK_FILE_MAX_BYTES) {
        setUploadedFiles(prev => [...prev, { ...newFile, status: 'error', rejected: true, errorMessage: `Supera el máximo de ${TASK_FILE_MAX_MB} MB. Se aceptan PDF, Word, Excel, imágenes y más.` }]);
        return;
      }
      setUploadedFiles(prev => [...prev, newFile]);
      uploadFileInBackground(file, fileId);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { processFiles(Array.from(e.target.files)); if (e.target) e.target.value = ''; }
  };

  const resetFiles = () => { setUploadedFiles([]); fileObjectsRef.current.clear(); };

  return { uploadedFiles, setUploadedFiles, fileObjectsRef, processFiles, retryUpload, handleFileChange, resetFiles };
}

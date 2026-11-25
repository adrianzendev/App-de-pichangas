/**
 * Código b4c5d6 - Utility for consistent file URL construction
 * This ensures all file URLs include protocol and host for proper loading
 */

export function getFileUrl(filename: string): string {
  if (!filename) return '';
  
  const protocol = window.location.protocol;
  const host = window.location.host;
  
  // NEW: Handle Object Storage paths (persist in production)
  // These paths are already complete and should be returned as-is
  if (filename.startsWith('/objects/')) {
    const fullUrl = `${protocol}//${host}${filename}`;
    return fullUrl;
  }
  
  // COMPREHENSIVE FIX: Handle all types of malformed paths
  let cleanFilename = filename;
  
  // Step 1: Extract from full URLs with domains
  if (filename.includes('http')) {
    const urlParts = filename.split('/');
    cleanFilename = urlParts[urlParts.length - 1];
  }
  
  // Step 2: Handle paths that start with /uploads/ (old database entries)
  else if (filename.startsWith('/uploads/')) {
    // Extract just the filename from "/uploads/filename.ext"
    cleanFilename = filename.split('/').pop() || filename;
  }
  
  // Step 3: Handle paths that start with uploads/ (without leading slash)
  else if (filename.startsWith('uploads/')) {
    cleanFilename = filename.split('/').pop() || filename;
  }
  
  // IMPORTANT: Encode the filename to handle spaces and special characters
  const encodedFilename = encodeURIComponent(cleanFilename);
  
  // Determine correct path based on file type
  let relativePath: string;
  if (cleanFilename.includes('chat-')) {
    // Chat files go to uploads/chat/
    relativePath = `/uploads/chat/${encodedFilename}`;
  } else if (cleanFilename.includes('receipt-')) {
    // Payment receipts go to uploads/payments/
    relativePath = `/uploads/payments/${encodedFilename}`;
  } else {
    // Regular task files go to uploads/
    relativePath = `/uploads/${encodedFilename}`;
  }
  
  const fullUrl = `${protocol}//${host}${relativePath}`;
  
  
  return fullUrl;
}

// Peso legible estilo WhatsApp: < 1 MB en KB, >= 1 MB en MB con un decimal.
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "DOCX · 164 KB": unica fuente del texto tipo + peso (chat y adjuntos de pedidos).
export function fileMetaText(ext: string, size?: number | null): string {
  return [ext, size ? formatFileSize(size) : ""].filter(Boolean).join(" · ");
}

export function isImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename);
}

export function isObjectStorageUUID(filename: string): boolean {
  const name = filename.split('/').pop() || filename;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
}

export function generateFriendlyFilename(filename: string, index: number = 1): string {
  if (!filename) return 'Archivo';
  
  const originalFilename = filename.split('/').pop() || filename;
  
  if (isObjectStorageUUID(originalFilename)) {
    return `Archivo_adjunto_${index.toString().padStart(2, '0')}`;
  }
  
  const lastDot = originalFilename.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot < originalFilename.length - 1;
  const extension = hasExtension ? originalFilename.substring(lastDot + 1).toLowerCase() : '';
  const nameWithoutExt = hasExtension ? originalFilename.substring(0, lastDot) : originalFilename;
  
  let cleanName = nameWithoutExt
    .replace(/\d{10,}/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/[^a-zA-Z0-9\s\-_áéíóúñÁÉÍÓÚÑ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (!cleanName || cleanName.length < 2) {
    if (isImageFile(filename)) {
      cleanName = 'Imagen';
    } else if (['pdf'].includes(extension)) {
      cleanName = 'Documento';
    } else if (['doc', 'docx'].includes(extension)) {
      cleanName = 'Documento_Word';
    } else if (['xls', 'xlsx'].includes(extension)) {
      cleanName = 'Hoja_Calculo';
    } else if (['ppt', 'pptx'].includes(extension)) {
      cleanName = 'Presentacion';
    } else {
      cleanName = 'Archivo';
    }
    cleanName += `_${index.toString().padStart(2, '0')}`;
  } else {
    if (cleanName.length > 30) {
      cleanName = cleanName.substring(0, 30);
    }
  }
  
  return extension ? `${cleanName}.${extension}` : cleanName;
}

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'text/plain': '.txt',
  'application/zip': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-zip-compressed': '.zip',
  'application/octet-stream': '',
};

const CONTENT_TYPE_TO_LABEL: Record<string, string> = {
  'application/pdf': 'Documento',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentacion',
  'application/vnd.ms-powerpoint': 'Presentacion',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento_Word',
  'application/msword': 'Documento_Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Hoja_Calculo',
  'application/vnd.ms-excel': 'Hoja_Calculo',
  'image/jpeg': 'Imagen',
  'image/png': 'Imagen',
  'image/gif': 'Imagen',
  'image/webp': 'Imagen',
};

// Etiqueta corta del tipo ("PDF", "DOCX") desde el Content-Type; '' si no se reconoce.
export function fileTypeLabel(contentType: string): string {
  const ext = CONTENT_TYPE_TO_EXT[contentType.split(';')[0].trim()] || '';
  return ext.slice(1).toUpperCase();
}

export function downloadFile(filename: string, customName?: string) {
  const fileUrl = getFileUrl(filename);
  const isObjectStorage = filename.startsWith('/objects/');
  const rawName = filename.split('/').pop() || filename;
  const isUUID = isObjectStorageUUID(rawName);
  const downloadName = customName || rawName;
  const lastDot = downloadName.lastIndexOf('.');
  const hasRealExtension = lastDot > 0 && (downloadName.length - lastDot) <= 6;
  
  if (isObjectStorage || isUUID || !hasRealExtension) {
    fetch(fileUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const ext = CONTENT_TYPE_TO_EXT[contentType] || '';
        const label = CONTENT_TYPE_TO_LABEL[contentType] || 'Archivo';
        const finalName = hasRealExtension ? downloadName : `${label}_adjunto${ext}`;
        return response.blob().then(blob => ({ blob, finalName }));
      })
      .then(({ blob, finalName }) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(error => {
        console.error(`[DOWNLOAD] Error: ${error}`);
        // Respaldo con el atributo download: abrir la URL perderia el nombre original.
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  } else {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = downloadName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
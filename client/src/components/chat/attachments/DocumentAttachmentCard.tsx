import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { fileMetaText } from "@/lib/file-url-utils";
import { MessageMenuTrigger } from "../MessageMenuTrigger";
import type { MenuAction } from "../menu-actions";
import { fileExtension } from "./attachment-utils";
import { FileBadgeIcon } from "./FileBadgeIcon";
import type { FileMetaProps } from "./types";

/**
 * Propiedades de {@link DocumentAttachmentCard}.
 */
export interface DocumentAttachmentCardProps extends FileMetaProps {
  /** El mensaje es del usuario actual (cambia el tono del fondo cuando no es `bare`). */
  isCurrentUser: boolean;
  /** El mensaje aun se esta enviando: las acciones se reemplazan por "Enviando…". */
  isSending: boolean;
  /** El receptor ya descargo el archivo (muestra "Descargado"). */
  downloaded?: boolean;
  /** "Abrir": visor interno si es soportado (PDF) o el archivo en el navegador. */
  onOpen: () => void;
  /** "Guardar como…": descarga directa. */
  onSave: () => void;
  /** Sin fondo/borde/ancho propios: la tarjeta ES la burbuja (documento solo, sin texto). */
  bare?: boolean;
  /** Hora + checks. Con `caption`, van a la derecha de la leyenda; sin ella, en la fila de metadatos. */
  footer?: ReactNode;
  /** Acciones del mensaje: si hay, la flecha de opciones aparece arriba a la derecha, junto al nombre. */
  menuActions?: MenuAction[];
  /** Leyenda (texto del mensaje): bloque entre los datos del archivo y la barra de acciones. */
  caption?: string;
  /** Contenido a todo el ancho sobre la fila del documento (p. ej. portada de un PDF). */
  header?: ReactNode;
}

/**
 * Tarjeta unificada para archivos de documento (Excel, Word, PDF, TXT, ZIP...)
 * con estilo de mensajeria moderna: ancho `w-chat-doc max-w-full`, insignia
 * de color por extension, nombre (2 lineas max.), `EXT · PESO` con la hora y
 * los checks en la misma fila, y una barra de acciones 50/50 ("Abrir" /
 * "Guardar como…") pegada al borde inferior.
 *
 * @param {DocumentAttachmentCardProps} props - Metadatos del archivo, estado de envio y acciones.
 * @returns {JSX.Element} La tarjeta del documento.
 */
export function DocumentAttachmentCard({
  name, size, isCurrentUser, isSending, downloaded, onOpen, onSave, bare, footer, header, caption, menuActions,
}: DocumentAttachmentCardProps) {
  const ext = fileExtension(name);
  const meta = fileMetaText(ext, size);
  const action = "h-10 flex items-center justify-center whitespace-nowrap text-gray-900 hover:bg-scrim/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <div className={bare ? "w-full" : `w-chat-doc max-w-full rounded-xl overflow-hidden border border-border ${isCurrentUser ? "bg-white/60" : "bg-gray-100"}`}>
      {header}
      <div className="flex items-center gap-3 p-3">
        <FileBadgeIcon extension={ext} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <span className="text-body font-medium text-gray-900 line-clamp-2 break-all">{name}</span>
            {menuActions && <MessageMenuTrigger actions={menuActions} align={isCurrentUser ? "end" : "start"} className="-mr-1 -mt-0.5 p-0.5" />}
          </div>
          {(meta || (footer && !caption)) && (
            // Metadatos a la izquierda; hora + checks a la derecha en la MISMA fila
            // Si no cabe todo (movil angosto, hora + "Descargado"), la hora baja a su propia
            // fila alineada a la derecha en vez de salirse de la burbuja.
            <div className="flex flex-wrap items-end justify-between gap-x-2">
              <span className="text-caption text-gray-700 truncate min-w-0">{meta}</span>
              {footer && !caption && <span className="flex flex-wrap items-center justify-end gap-x-1 min-w-0 max-w-full">{footer}</span>}
            </div>
          )}
          {downloaded && !isCurrentUser && (
            <span className="text-caption text-primary-600 flex items-center gap-0.5">
              <Check className="size-icon-sm" /> Descargado
            </span>
          )}
        </div>
      </div>
      {caption && (
        // Leyenda a la izquierda; hora + checks a la derecha, en la misma fila final.
        <div className="px-3 py-2 text-body relative flex flex-wrap items-end justify-between gap-2">
          <span className="min-w-0 break-words whitespace-pre-line">{caption}</span>
          {footer && <span className="ml-auto flex items-center gap-1 whitespace-nowrap">{footer}</span>}
        </div>
      )}
      <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-center text-caption font-medium">
        {isSending ? (
          <span className="col-span-2 h-10 flex items-center justify-center gap-2 text-gray-700">
            <Spinner size="xs" className="border" /> Enviando…
          </span>
        ) : (
          <>
            <button type="button" className={action} onClick={onOpen}>Abrir</button>
            <button type="button" className={action} onClick={onSave}>Guardar como…</button>
          </>
        )}
      </div>
    </div>
  );
}

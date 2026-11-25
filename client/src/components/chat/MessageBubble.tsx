import { memo, useEffect, useState } from "react";
import { Check, CheckCheck, Download, ShieldOff } from "lucide-react";
import { QuoteCardMenu } from "./QuoteCardMenu";
import { Spinner } from "@/components/ui/spinner";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { DocumentViewerModal } from "@/components/chat/attachments/DocumentViewerModal";
import { MessageAttachment } from "@/components/chat/attachments/MessageAttachment";
import { buildChatAttachments, probeAttachment, type AttachmentProbe } from "@/components/chat/attachments/attachment-utils";
import type { ChatAttachment } from "@/components/chat/attachments/types";
import { MessageMenuActions, buildMessageMenuActions } from "@/components/chat/MessageMenuActions";
import { ReplyQuote } from "@/components/chat/ReplyQuote";
import type { Message } from "@/components/chat/chat-types";
import { BUBBLE_TIME_CLASS, BUBBLE_TIME_OVERLAY_CLASS, SYSTEM_MESSAGE_CLASS, bubbleTextClass, bubbleToneClass, BUBBLE_OTHER_SURFACE } from "@/components/chat/chat-bubble-styles";
import { extractQuoteTitle, formatChatTimestamp, parseQuoteFromMessage, stripQuoteFromMessage } from "@/components/chat/chat-quote-utils";
import { fmtDayLabelLong } from "@/lib/date-format";
import { formatPrice } from "@/lib/timezone-utils";
import { getFileUrl } from "@/lib/file-url-utils";
import { getTimeRemaining } from "@/utils/task-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ATTACHMENT_PLACEHOLDER } from "@shared/chat-preview";

/**
 * Propiedades de {@link MessageBubble}.
 */
export interface MessageBubbleProps {
  msg: Message;
  prevMessage: Message | null;
  currentUserId: string;
  anchorTaskId: string;
  taskInfoTitle?: string | null;
  taskInfoDescription?: string | null;
  taskInfoCurrency?: string | null;
  taskInfoDeadline?: string | Date | null;
  canHireAnchorTask: boolean;
  latestQuoteMessageId?: string | null;
  isTutorViewer: boolean;
  onViewTask: (taskId: string) => void;
  onOpenTaskDetail: (open: boolean) => void;
  onNewQuoteTask: (taskId: string) => void;
  onOpenQuoteModal: (open: boolean) => void;
  onDeliveryTask: (taskId: string) => void;
  onOpenMarkCompleted: (open: boolean) => void;
  onHire: (open: boolean) => void;
  onFileDownload: (msg: Message, filename: string) => void;
  /** Responder / citar este mensaje. */
  onReply: (msg: Message) => void;
  // Banner flotante "inteligente": el padre observa (IntersectionObserver)
  // si la tarjeta inline de cotizacion vigente esta en viewport para
  // ocultar el banner fijo y no duplicar el CTA. Ref estable (useCallback
  // vacio en el padre) para no romper memo() de esta burbuja -- se adjunta
  // solo en la burbuja que efectivamente muestra el boton Contratar.
  quoteCardRef?: (el: HTMLDivElement | null) => void;
}

// Memoizado: props estables (setters de useState, funciones useCallback,
// primitivos derivados de datos del task que no cambian con cada keystroke
// del input) evitan re-renderizar cada burbuja de mensaje al tipear en el
// composer. El parseo de cotizacion/fecha vive aca adentro, no en el
// .map() del padre, para que memo() de verdad salte ese trabajo.
/**
 * Burbuja de un mensaje del chat: solo maneja el LAYOUT (separador de fecha, burbuja
 * propia/ajena, cotizacion, cita de respuesta, hora y checks). El renderizado de
 * adjuntos lo delega en `MessageAttachment` y el menu (clic derecho + flecha) en
 * `MessageMenuActions`; los visores (imagen / documento) se abren desde aqui.
 *
 * @param {MessageBubbleProps} props - Mensaje, contexto de la conversacion y callbacks.
 * @returns {JSX.Element | null} La burbuja (null para mensajes del admin que se ocultan).
 */
export const MessageBubble = memo(function MessageBubble({
  msg,
  prevMessage,
  currentUserId,
  anchorTaskId,
  taskInfoTitle,
  taskInfoDescription,
  taskInfoCurrency,
  taskInfoDeadline,
  canHireAnchorTask,
  latestQuoteMessageId,
  isTutorViewer,
  onViewTask,
  onOpenTaskDetail,
  onNewQuoteTask,
  onOpenQuoteModal,
  onDeliveryTask,
  onOpenMarkCompleted,
  onHire,
  onFileDownload,
  onReply,
  quoteCardRef,
}: MessageBubbleProps) {
  const isCurrentUser = msg.senderId === currentUserId;
  const isAdminMessage = msg.senderId === 'admin-001';
  // Los adjuntos de Object Storage (/objects/uploads/<uuid>) no tienen
  // extension en el path -> isImageFile() por nombre no alcanza. Se
  // intenta renderizar como <img> igual y, si el navegador no puede
  // decodificarlo (onError), recien ahi se sabe que no era una imagen y
  // cae al fallback de documento.
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  // Adjuntos sin nombre original (mensajes antiguos): tipo real por Content-Type.
  const [probes, setProbes] = useState<Map<string, AttachmentProbe>>(new Map());
  useEffect(() => {
    let alive = true;
    (msg.attachments ?? []).forEach((path, i) => {
      if (msg.attachmentNames?.[i] || !path.startsWith('/objects/')) return;
      probeAttachment(getFileUrl(path)).then((probe) => {
        if (alive && probe) setProbes((prev) => (prev.has(path) ? prev : new Map(prev).set(path, probe)));
      });
    });
    return () => { alive = false; };
  }, [msg.attachments, msg.attachmentNames]);
  // Lightbox de la imagen adjunta tocada: {url, filename} para poder descargar
  // (y marcar 'Descargado') sin salir del chat.
  const [selectedImage, setSelectedImage] = useState<{ url: string; filename: string; name?: string } | null>(null);
  // Visor de PDF: click en la tarjeta/portada abre el documento pagina por pagina.
  const [pdfViewer, setPdfViewer] = useState<{ url: string; name?: string; filename: string } | null>(null);
  const messageDate = new Date(msg.createdAt || msg.timestamp);
  const quotePrice = !isAdminMessage ? parseQuoteFromMessage(msg.message || '') : null;
  const isAnchorTaskQuote = !msg.taskId || msg.taskId === anchorTaskId;
  // Solo la cotizacion mas reciente del pedido ancla conserva el boton —
  // ver plan "cotizaciones viejas inactivas" (una cotizacion nueva no
  // invalida nada en la base, solo cambia como se ve la tarjeta vieja).
  const isLatestQuote = !quotePrice || latestQuoteMessageId == null || msg.id === latestQuoteMessageId;
  const showHireButtonOnQuote = !!quotePrice && isAnchorTaskQuote && canHireAnchorTask && isLatestQuote;
  const showSupersededQuoteBadge = !!quotePrice && isAnchorTaskQuote && !isLatestQuote;
  const quoteTitle = quotePrice
    ? extractQuoteTitle(msg.message || '') || (isAnchorTaskQuote ? taskInfoTitle : null) || 'Propuesta de cotización'
    : null;
  const quoteDescription = quotePrice ? stripQuoteFromMessage(msg.message || '', quoteTitle) : null;
  // quoteTaskDescription/quoteTimeRemaining salen de taskInfo, que llega
  // sembrado en la respuesta de mensajes (ver seedTaskCache en el padre).
  const quoteTaskDescription = quotePrice && isAnchorTaskQuote ? taskInfoDescription : null;
  const quoteTimeRemaining = quotePrice && isAnchorTaskQuote && taskInfoDeadline
    ? getTimeRemaining(taskInfoDeadline)
    : null;

  // Filter: Hide deprecated/harmful admin messages globally
  if (isAdminMessage) {
    const msgLower = (msg.message || '').toLowerCase();
    if (msgLower.includes('pedido asignado a otro tutor') ||
        msgLower.includes('asignado a otro')) {
      return null;
    }
    if (msgLower.includes('período de gracia') ||
        msgLower.includes('periodo de gracia') ||
        msg.message.includes('📋') ||
        msg.message.includes('🕐') ||
        msg.message.includes('✅ Si estás conforme')) {
      return null;
    }
  }

  const prevMessageDate = prevMessage ? new Date(prevMessage.createdAt || prevMessage.timestamp) : null;
  const showDateSeparator = !prevMessageDate ||
    (messageDate.toDateString() !== prevMessageDate.toDateString());

  // Hora + ticks dentro de la burbuja, abajo a la derecha (estilo WhatsApp).
  // inline=true (burbuja solo de texto): se posiciona absoluta en la esquina
  // y el texto reserva su ancho con un espaciador inline (`metaSpacer`), asi
  // la hora queda pegada a la ultima linea y solo baja a renglon propio si el
  // texto ocupa todo el ancho. inline=false (adjuntos, tarjeta de cotizacion):
  // fila propia debajo del contenido.
  const hasAttachments = !!msg.attachments && msg.attachments.length > 0;
  const inlineMeta = !quotePrice && !hasAttachments;
  // Adjuntos resueltos (tipo de tarjeta por nombre original / extension).
  const attachments = buildChatAttachments(msg, failedImages, probes);
  const noOwnText = !msg.message?.trim() || msg.message.trim() === '📎 Archivo adjunto';
  // Solo imagen(es), sin texto: la imagen ocupa la burbuja de borde a borde y la
  // hora/checks flotan sobre su esquina inferior derecha.
  const imageOnly = !quotePrice && attachments.length > 0 && noOwnText && attachments.every(a => a.kind === 'image');
  // Un solo documento (no imagen) y sin texto propio: la tarjeta ES la burbuja
  // (estilo WhatsApp), sin doble contenedor; hora y checks van dentro de ella.
  const docOnlyAttachment = !quotePrice && attachments.length === 1 && noOwnText
    && attachments[0].kind !== 'image';
  // Con texto (caption): el adjunto va PRIMERO, el texto justo debajo y la hora en
  // el pie (estilo WhatsApp). Aplica a un documento nombrado o a imagen(es).
  const captionLayout = !quotePrice && attachments.length > 0 && !noOwnText
    && (attachments.every(a => a.kind === 'image')
      || (attachments.length === 1 && attachments[0].kind !== 'image'));
  const captionIsDoc = captionLayout && attachments[0].kind !== 'image';
  // Menu contextual: texto propio (sin placeholder de adjunto) y acciones sobre el primer adjunto.
  const menuText = noOwnText ? null : msg.message;
  const menuActions = buildMessageMenuActions({
    text: quotePrice ? null : menuText,
    hasAttachment: !quotePrice && attachments.length > 0,
    canDownload: msg.status !== 'sending',
    onOpen: () => attachments[0] && openAttachment(attachments[0]),
    onDownload: () => attachments[0] && onFileDownload(msg, attachments[0].path),
    // Responder: no mientras se envia (aun no tiene id real) ni en cotizaciones.
    onReply: msg.status === 'sending' || quotePrice ? undefined : () => onReply(msg),
  });
  // Documento: la flecha de opciones vive dentro de la tarjeta (junto al nombre).
  const docHasOwnMenu = !quotePrice && attachments.length > 0 && attachments[0].kind !== 'image';
  const hasImage = attachments.some(a => a.kind === 'image');
  const openAttachment = (a: ChatAttachment) => {
    if (a.kind === 'image') setSelectedImage({ url: a.url, filename: a.path, name: a.originalName });
    else if (a.kind === 'pdf') setPdfViewer({ url: a.url, name: a.name, filename: a.path });
    else onFileDownload(msg, a.path); // Word, Excel, etc.: abrir la URL perderia el nombre original.
  };
  const metaSpacer = (
    <span aria-hidden className={`inline-block align-bottom ${isCurrentUser ? "w-skeleton-lg" : "w-skeleton-sm"}`} />
  );
  // Hora + checks. Variantes: `inline` (dentro del texto, esquina), `block` (bajo el contenido), `compact` (dentro de una
  // tarjeta de documento, sin margen) y `overlay` (sobre la imagen: todo en blanco).
  const renderMeta = (variant: "inline" | "block" | "compact" | "overlay") => {
    const overlay = variant === "overlay";
    const idle = overlay ? "text-white" : "text-gray-700";
    const read = overlay ? "text-white" : "text-primary-600";
    return (
    <div className={variant === "inline" ? "absolute bottom-2.5 right-4 flex items-center gap-1" : variant === "block" ? "flex items-center justify-end gap-1 mt-1" : "flex items-center justify-end gap-1"}>
      <span className={overlay ? BUBBLE_TIME_OVERLAY_CLASS : BUBBLE_TIME_CLASS}>
        {formatChatTimestamp(msg.createdAt || msg.timestamp)}
      </span>
      {isCurrentUser && (
        <div className="flex items-center">
          {msg.status === 'sending' ? (
            <Spinner size="xs" className={`border ${idle}`} />
          ) : msg.readAt ? (
            <CheckCheck className={`size-icon-star ${read}`} />
          ) : msg.deliveredAt ? (
            <CheckCheck className={`size-icon-star ${idle}`} />
          ) : (
            <Check className={`size-icon-star ${idle}`} />
          )}
        </div>
      )}
      {isCurrentUser && msg.attachments && msg.attachments.length > 0 && msg.fileDownloadedAt && (
        <span className={`text-caption ${read} flex items-center gap-0.5 ml-1`}>
          <Download className="size-icon-xs" /> Descargado
        </span>
      )}
    </div>
    );
  };

  return (
    <div>
      {showDateSeparator && (
        <div className="my-3 text-center text-caption font-medium text-gray-700">
          {fmtDayLabelLong(messageDate)}
        </div>
      )}

      {msg.moderationStatus === 'hidden' ? (
        // Oculto por moderacion: misma posicion que la burbuja original, sin texto ni adjuntos ni menu de acciones.
        <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
          <div className={`flex max-w-bubble items-center gap-2 px-4 py-3 text-body italic text-gray-700 ${bubbleToneClass(isCurrentUser)}`} data-testid={`message-hidden-${msg.id}`}>
            <ShieldOff className="size-icon-md shrink-0" aria-hidden />
            <span>Mensaje ocultado por moderación</span>
          </div>
        </div>
      ) : isAdminMessage ? (
        <div className="flex justify-center my-3">
          <div className={SYSTEM_MESSAGE_CLASS}>
            <span className="font-semibold">Administración:</span> {msg.message}
          </div>
        </div>
      ) : (
        <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-bubble min-w-0 ${isCurrentUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
            <MessageMenuActions
              actions={menuActions}
              hideTrigger={docHasOwnMenu}
              onImage={hasImage}
              isCurrentUser={isCurrentUser}
            >
            <div
              ref={showHireButtonOnQuote ? quoteCardRef : undefined}
              className={`min-w-0 max-w-full text-gray-900 ${inlineMeta || imageOnly ? "relative " : ""}${
                quotePrice
                  ? `${BUBBLE_OTHER_SURFACE} rounded-lg p-4`
                  : `${docOnlyAttachment || captionIsDoc ? 'p-0 overflow-hidden w-chat-doc max-w-full border border-border' : imageOnly ? 'p-0 overflow-hidden' : captionLayout ? 'p-0 overflow-hidden w-fit min-w-48' : 'px-4 py-3'} ${bubbleToneClass(isCurrentUser)}`
              }`}
            >
              {msg.replyTo && !quotePrice && (
                <ReplyQuote
                  replyTo={msg.replyTo}
                  meId={currentUserId}
                  className={docOnlyAttachment || captionLayout || imageOnly ? 'm-2 mb-0' : 'mb-2'}
                />
              )}
              {quotePrice ? (
                // Mismo contenedor/estructura que la Card de Pedidos
                // (simple-task-card.tsx / tutor-task-card.tsx): titulo+menu,
                // descripcion, tiempo restante, footer con divisor. A
                // diferencia de esas cards, esta NO muestra badge de estado
                // ni seccion de "Tutor:" — el footer es precio + Contratar.
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-subheading font-semibold text-gray-900 line-clamp-2 break-anywhere flex-1">
                      {quoteTitle}
                    </h3>
                    <QuoteCardMenu
                      isCurrentUser={isCurrentUser}
                      testId={`button-quote-menu-${msg.id}`}
                      items={[
                        {
                          label: "Ver detalles del pedido",
                          testId: `button-ver-pedido-${msg.id}`,
                          onSelect: () => {
                            onViewTask(msg.taskId || anchorTaskId);
                            onOpenTaskDetail(true);
                          },
                        },
                        ...(isTutorViewer ? [
                          {
                            label: "Nueva cotización",
                            onSelect: () => {
                              onNewQuoteTask(msg.taskId || anchorTaskId);
                              onOpenQuoteModal(true);
                            },
                          },
                          {
                            label: "Entregar pedido",
                            onSelect: () => {
                              onDeliveryTask(msg.taskId || anchorTaskId);
                              onOpenMarkCompleted(true);
                            },
                          },
                        ] : []),
                      ]}
                    />
                  </div>
                  {quoteTaskDescription && (
                    <p className="text-body text-gray-700 line-clamp-2 mb-2 break-anywhere">
                      {quoteTaskDescription}
                    </p>
                  )}
                  {quoteTimeRemaining && !quoteTimeRemaining.isExpired && (
                    <div className="text-caption text-gray-700 mb-2">{quoteTimeRemaining.text}</div>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3">
                    <span className="text-heading font-bold text-gray-900">
                      {formatPrice(quotePrice, taskInfoCurrency)}
                    </span>
                    {showHireButtonOnQuote && (
                      <Button
                        onClick={() => onHire(true)}
                        className="shrink-0"
                        data-testid={`button-contratar-${msg.id}`}
                      >
                        Contratar
                      </Button>
                    )}
                    {showSupersededQuoteBadge && (
                      <Badge
                        variant="neutral"
                        className="shrink-0"
                        data-testid={`badge-oferta-reemplazada-${msg.id}`}
                      >
                        Cotización expirada
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                (() => {
                  // Placeholder guardado cuando se manda un adjunto sin
                  // texto (ver mutationFn de envio) — se sigue guardando
                  // en msg.message porque otras vistas (lista de
                  // conversaciones) lo usan como preview, pero no tiene
                  // sentido repetirlo como titulo arriba del adjunto que
                  // ya se ve.
                  const isAttachmentPlaceholder = msg.message?.trim() === ATTACHMENT_PLACEHOLDER;
                  if (isAttachmentPlaceholder && msg.attachments && msg.attachments.length > 0) return null;
                  if (captionLayout) return null; // el caption se pinta debajo del adjunto
                  return (
                    <div className="text-body break-words whitespace-pre-line">
                      {msg.message}
                      {inlineMeta && metaSpacer}
                    </div>
                  );
                })()
              )}

              {attachments.length > 0 && (
                <div className={`${docOnlyAttachment || imageOnly || captionLayout ? '' : 'mt-2 '}space-y-2`}>
                  {attachments.map((att, i) => (
                    <MessageAttachment
                      key={`attach-${msg.id}-${i}-${att.path}`}
                      attachment={att}
                      isCurrentUser={isCurrentUser}
                      isSending={msg.status === 'sending'}
                      downloaded={!!msg.fileDownloadedAt}
                      fill={docOnlyAttachment || imageOnly || captionLayout}
                      footer={docOnlyAttachment || captionIsDoc || (imageOnly && i === attachments.length - 1) ? renderMeta(docOnlyAttachment || captionIsDoc ? "compact" : "overlay") : undefined}
                      caption={captionIsDoc ? msg.message : undefined}
                      menuActions={i === 0 && docHasOwnMenu ? menuActions : undefined}
                      onOpenImage={openAttachment}
                      onOpenPdf={openAttachment}
                      onOpenOther={openAttachment}
                      onDownload={(a) => onFileDownload(msg, a.path)}
                      onImageError={(a) => setFailedImages((prev) => new Set(prev).add(a.path))}
                    />
                  ))}
                </div>
              )}
              {captionLayout && !captionIsDoc && (
                <>
                  {/* w-0 + min-w-full: el texto se ajusta al ancho de la imagen (como WhatsApp) y no ensancha la burbuja. */}
                  <div className="w-0 min-w-full px-3 pt-2 pb-1 text-body break-words whitespace-pre-line">{msg.message}</div>
                  <div className="px-3 pb-2">{renderMeta("block")}</div>
                </>
              )}
              {!(quotePrice && quoteDescription) && !docOnlyAttachment && !imageOnly && !captionLayout && renderMeta(inlineMeta ? "inline" : "block")}
              <DocumentViewerModal
                url={pdfViewer?.url ?? null}
                name={pdfViewer?.name}
                onClose={() => setPdfViewer(null)}
                onDownload={pdfViewer && msg.status !== 'sending' ? () => onFileDownload(msg, pdfViewer.filename) : undefined}
              />
              <ImagePreviewModal
                src={selectedImage?.url ?? null}
                title={selectedImage?.name}
                onClose={() => setSelectedImage(null)}
                onDownload={selectedImage && msg.status !== 'sending' ? () => onFileDownload(msg, selectedImage.filename) : undefined}
              />
            </div>
            </MessageMenuActions>
            {quotePrice && quoteDescription && (
              <div
                className={`${bubbleTextClass(isCurrentUser)} mt-1.5 relative`}
              >
                {quoteDescription}
                {metaSpacer}
                {renderMeta("inline")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

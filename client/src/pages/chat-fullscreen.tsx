import { OutlinedControl } from "@/components/ui/outlined-field";
import { pluralizeEs } from "@/lib/pluralize";
import { ROUTES, TAB, normalizeFromSection, tutorRoute } from "@/lib/routes";
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, memo } from "react";
import { BackButton } from "@/components/ui/back-button";
import { ListScreen } from "@/components/ui/list-screen";
import { TutorProfileContent } from "@/components/sections/tutor-profile-content";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Upload, MessageCircle, ShieldAlert } from "lucide-react";
import { FileSourceDialog } from "@/components/publish/file-source-dialog";
import { StarRating } from "@/components/ui/star-rating";
import { ChatIconButton } from "@/components/chat/chat-icon-button";
import { apiRequest, queryClient, responseErrorMessage } from "@/lib/queryClient";
import { chatPollInterval } from "@/lib/impersonation";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useWebSocketFixed } from '@/hooks/useWebSocketFixed';
import { generateStudentAlias } from '@/utils/student-anonymization';
import { parseISO } from "date-fns";
import { chatPreviewText, chatAttachmentKind, type ReplyPreview } from "@shared/chat-preview";
import { ReplyQuote } from "@/components/chat/ReplyQuote";
import { ChatCanvas } from "@/components/chat/ChatCanvas";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { Message } from "@/components/chat/chat-types";
import { parseQuoteFromMessage, formatChatTimestamp } from "@/components/chat/chat-quote-utils";
import { MessageList, type MessageListHandle } from "@/components/chat/MessageList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useTypingIndicator } from "@/components/chat/use-typing-indicator";
import { usePdfThumbnail, isPdfName } from "@/lib/pdf-thumbnail";
import { useVisualViewportHeight } from "@/hooks/use-visual-viewport-height";
import { useFilePicker } from "@/hooks/use-file-picker";
import { useChatSafety } from "@/components/chat/ChatSafetyDialogs";
import type { PickSource } from "@/lib/file-picker";
import { DocumentViewerModal } from "@/components/chat/attachments/DocumentViewerModal";
import { SelectedFileChip } from "@/components/chat/attachments/SelectedFileChip";
import { reportAttachmentFailure } from "@/lib/report-attachment-failure";
import { MessageAttachment } from "@/components/chat/attachments/MessageAttachment";
import { buildChatAttachments, probeAttachment, readImageSize, type AttachmentProbe } from "@/components/chat/attachments/attachment-utils";
import type { ChatAttachment } from "@/components/chat/attachments/types";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { formatPrice, formatDateForUser, formatTimeForUser } from "@/lib/timezone-utils";
import type { ChatThreadSummary } from "@/components/sections/messages-section";
import { getTimeRemaining } from "@/utils/task-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HireModal } from "@/components/ui/hire-modal";
import { TaskQuickViewDialog } from "@/components/ui/task-quick-view-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Eye, TestTube, FileText, CheckCircle, Check, CheckCheck, Download } from "lucide-react";
import { downloadFile, isImageFile, generateFriendlyFilename } from "@/lib/file-url-utils";
import type { PublicTutor } from "@shared/schema";
import { fmtTime12, fmtDayLabelLong } from "@/lib/date-format";
import { Spinner } from "@/components/ui/spinner";
import { fetchMessagesPage, fetchThreadMessages, threadMessagesKey, hasMoreKey, setHasMoreCache, seedTaskCache } from "@/lib/chat-queries";
import {
  mapLegacyToBackend, 
  getHiringStateConfig, 
  isChatReadonly, 
  getBanner,
  type BackendHiringStatus 
} from "@/lib/hiring-states";

interface ChatFullscreenOverrideParams {
  threadId?: string;
  userId?: string;
  userName?: string;
  // Modo legado order-centric (ej. ChatSection en Inicio de alumno): un
  // hilo puede no existir todavia, se abre directo por tarea + usuario.
  taskId?: string;
  taskTitle?: string;
}

interface ChatFullscreenWorkingProps {
  // Split-view desktop (Mensajes en dos columnas): permite abrir un hilo
  // sin navegar de pagina, y ajusta el layout para vivir dentro de la
  // columna derecha en vez de ocupar la pantalla entera.
  overrideParams?: ChatFullscreenOverrideParams;
  embedded?: boolean;
}

// Distancia al fondo (px) que cuenta como "el usuario volvio al fondo" (reactiva el auto-scroll).
const USER_AT_BOTTOM_PX = 24;
// Distancia al fondo (px) bajo la cual un cambio de alto del contenido (imagen, fila medida) re-ancla al fondo.
const SNAP_NEAR_BOTTOM_PX = 48;
// Documentos admitidos en el chat (el selector "Archivos"; imagenes van por Camara/Galeria).
const CHAT_FILE_ACCEPT = ".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.csv";

export default function ChatFullscreenWorking({ overrideParams, embedded = false }: ChatFullscreenWorkingProps = {}) {
  
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Dimensiones de las imagenes seleccionadas, leidas al elegirlas: el mensaje optimista
  // (blob:) nace con su caja final, igual que el mensaje ya guardado en el servidor.
  const selectedFileDimsRef = useRef(new WeakMap<File, { w: number; h: number } | null>());
  useEffect(() => {
    selectedFiles.forEach((f) => {
      if (!isImageFile(f.name) || selectedFileDimsRef.current.has(f)) return;
      readImageSize(f).then((dims) => selectedFileDimsRef.current.set(f, dims));
    });
  }, [selectedFiles]);

  // Thumbnail de imagen en el draft de adjuntos (antes de enviar). Object
  // URL por archivo — se recalcula cuando selectedFiles cambia (agregar,
  // quitar, enviar) y el useEffect de abajo revoca las anteriores para no
  // filtrar memoria.
  const selectedFilePreviewUrls = useMemo(
    () => selectedFiles.map(f => (isImageFile(f.name) ? URL.createObjectURL(f) : null)),
    [selectedFiles]
  );
  useEffect(() => {
    return () => {
      selectedFilePreviewUrls.forEach(url => { if (url) URL.revokeObjectURL(url); });
    };
  }, [selectedFilePreviewUrls]);
  // Teclado virtual en iOS Safari: alto real visible (null = sin teclado). Solo en pantalla completa.
  const keyboardViewportHeight = useVisualViewportHeight();
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showTaskDetailSheet, setShowTaskDetailSheet] = useState(false);
  // Pedido a mostrar en el sheet "Ver detalles": null = el pedido ancla
  // actual (taskInfo); si se abre desde una tarjeta de cotizacion de un
  // pedido viejo del mismo hilo, se apunta a ese pedido especifico.
  const [viewingQuoteTaskId, setViewingQuoteTaskId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentSent, setPaymentSent] = useState(false);
  const [newQuoteAmount, setNewQuoteAmount] = useState('');
  const [showMarkCompletedModal, setShowMarkCompletedModal] = useState(false);
  // Pedido especifico sobre el que actua "Nueva cotizacion" / "Entregar
  // pedido" cuando se abren desde el menu de una tarjeta de cotizacion
  // (un hilo puede tener varios pedidos, cada uno con su propia accion).
  const [quoteActionTaskId, setQuoteActionTaskId] = useState<string | null>(null);
  const [deliveryActionTaskId, setDeliveryActionTaskId] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  // Mensaje al que se esta respondiendo (barra sobre el composer).
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [fileMenuAnchor, setFileMenuAnchor] = useState<HTMLElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  // El virtualizer necesita el scroll element como ESTADO, no solo como ref: `MessageList` (hijo)
  // corre sus efectos de layout antes de que este padre adjunte el ref del `ChatCanvas`, asi que
  // con el ref a secas lee `null` y, si nada mas re-renderiza, la lista queda vacia (bug: chats de
  // 1 mensaje que "a veces" no mostraban nada). Al adjuntarse el nodo el estado cambia y re-renderiza.
  const [messagesScrollEl, setMessagesScrollEl] = useState<HTMLDivElement | null>(null);
  const setMessagesContainer = useCallback((el: HTMLDivElement | null) => {
    messagesContainerRef.current = el;
    setMessagesScrollEl(el);
  }, []);
  const virtualContentRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<MessageListHandle>(null);
  const initialScrollDone = useRef(false);

  // Banner flotante "inteligente" (estilo Fiverr): oculta el banner fijo de
  // arriba cuando la tarjeta inline de cotizacion vigente (la que ya
  // muestra su propio boton Contratar, ver showHireButtonOnQuote en
  // MessageBubble) esta visible en el viewport del chat, para no duplicar
  // el CTA. Un solo IntersectionObserver reusado (no uno por burbuja) —
  // observe/unobserve se mueve al nodo actual via el ref callback de abajo.
  // Todas las validaciones de negocio (canHireAnchorTask, etc.) siguen
  // intactas: esto solo decide si el banner se OCULTA cuando igual seria
  // elegible, nunca lo habilita cuando no lo era.
  const [inlineQuoteCardVisible, setInlineQuoteCardVisible] = useState(false);
  const quoteCardObserverRef = useRef<IntersectionObserver | null>(null);
  const observedQuoteCardEl = useRef<Element | null>(null);

  useEffect(() => {
    const root = messagesContainerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setInlineQuoteCardVisible(entry.isIntersecting);
      },
      { root, threshold: 0.4 }
    );
    quoteCardObserverRef.current = observer;
    if (observedQuoteCardEl.current) observer.observe(observedQuoteCardEl.current);
    return () => observer.disconnect();
  }, []);

  // Ref estable (identidad fija) para no romper memo() de MessageBubble --
  // se pasa igual a las 200+ burbujas del historial, cada una decide
  // internamente si es "la" tarjeta vigente antes de adjuntarlo (ver
  // `ref={showHireButtonOnQuote ? quoteCardRef : undefined}` mas abajo).
  const quoteCardRef = useCallback((el: HTMLDivElement | null) => {
    const observer = quoteCardObserverRef.current;
    if (observedQuoteCardEl.current && observer) {
      observer.unobserve(observedQuoteCardEl.current);
    }
    observedQuoteCardEl.current = el;
    if (el && observer) {
      observer.observe(el);
    } else if (!el) {
      // La tarjeta se desmonto (scrolleada fuera del rango virtualizado, o
      // ya no es la cotizacion vigente) -> tratar como no visible.
      setInlineQuoteCardVisible(false);
    }
  }, []);
  // Ventana de gracia para el ResizeObserver del contenedor de mensajes
  // (ver mas abajo) — se activa tras un scroll intencional al FONDO
  // (apertura sin no-leidos, o mensaje nuevo), nunca cuando se aterriza en
  // el primer no-leido. Dentro de este lapso se corrige el scroll SIEMPRE
  // que el contenido/contenedor cambie de alto, sin depender de
  // isNearBottom (que puede dar falso negativo si el cambio de alto ya
  // crecio el gap por encima del umbral).
  const scrollGraceUntilRef = useRef(0);
  // El usuario subio a leer historial a proposito: mientras sea true NINGUN auto-scroll
  // (ventana de gracia, snaps por cambio de alto, mensajes ajenos) lo devuelve al fondo.
  // Se detecta por INTENCION (rueda hacia arriba, dedo que arrastra hacia abajo, clic en la
  // barra de scroll), no por `scrollTop`, que tambien cambia por scrolls programaticos y por los
  // ajustes del virtualizer. Vuelve a false al llegar al fondo, al enviar un mensaje o al
  // cambiar de conversacion.
  const userScrolledUpRef = useRef(false);
  const touchStartYRef = useRef(0);
  const scrollIntentHandlers = useMemo(() => ({
    onWheel: (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.deltaY < 0) userScrolledUpRef.current = true;
    },
    onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => {
      touchStartYRef.current = e.touches[0]?.clientY ?? 0;
    },
    onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => {
      // dedo hacia abajo = el contenido sube = el usuario mira mensajes anteriores
      if ((e.touches[0]?.clientY ?? 0) - touchStartYRef.current > 6) userScrolledUpRef.current = true;
    },
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => {
      // clic sobre la barra de scroll (a la derecha del contenido) = arrastre manual
      if (e.target === e.currentTarget && e.nativeEvent.offsetX >= e.currentTarget.clientWidth) userScrolledUpRef.current = true;
    },
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < USER_AT_BOTTOM_PX) userScrolledUpRef.current = false;
    },
  }), []);
  const prevMessagesLengthRef = useRef(0);
  const isLoadingOlderRef = useRef(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const urlTaskId = overrideParams?.taskId ?? (urlParams.get('taskId') || '');
  const urlUserId = overrideParams?.userId ?? (urlParams.get('userId') || '');
  const urlUserName = overrideParams?.userName ?? (urlParams.get('userName') || 'Usuario');
  const taskTitle = overrideParams?.taskTitle ?? (urlParams.get('taskTitle') || 'Conversación');
  const returnTaskId = urlParams.get('returnTaskId') || '';
  const fromSection = normalizeFromSection(urlParams.get('from'));
  const shouldReadChat = urlParams.get('readChat') !== 'false'; // Only mark as read if explicitly true or not specified

  // Modo hilo continuo (user-centric, fase estudiante): en vez de taskId+userId
  // fijos, la pantalla recibe un threadId y resuelve por detras el pedido a
  // traves del cual se puede seguir escribiendo (puede no haber ninguno).
  const urlThreadId = overrideParams?.threadId ?? (urlParams.get('threadId') || '');
  const isThreadMode = !!urlThreadId;

  const { data: threadDetail } = useQuery<{
    id: string;
    otherUserId: string;
    otherUserName: string;
    otherUserAvatar: string | null;
    otherUserInactive?: boolean;
    sendableTaskId: string | null;
  }>({
    queryKey: ["/api/chat/threads", urlThreadId],
    queryFn: async () => {
      const response = await fetch(`/api/chat/threads/${urlThreadId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Error loading thread');
      return response.json();
    },
    enabled: isThreadMode,
    staleTime: 10000,
  });

  // taskId/userId/userName efectivos: en modo hilo vienen del hilo resuelto
  // (taskId puede quedar vacio si no hay pedido activo — el composer se
  // deshabilita mas abajo); en modo legado (order-centric) vienen tal cual
  // de la URL, sin cambios de comportamiento.
  // Resumen del hilo ya en cache (lista /api/chat/threads): permite arrancar
  // el fetch del pedido y pintar la tarjeta de cotizacion sin esperar
  // GET /api/chat/threads/:id (cascada de 2 peticiones = skeleton visible).
  const threadSummary = isThreadMode
    ? queryClient.getQueryData<ChatThreadSummary[]>(["/api/chat/threads"])?.find(t => t.id === urlThreadId)
    : undefined;
  const taskId = isThreadMode
    ? (threadDetail ? (threadDetail.sendableTaskId || '') : (threadSummary?.sendableTaskId || ''))
    : urlTaskId;
  const otherUserInactive = isThreadMode ? !!(threadDetail?.otherUserInactive ?? threadSummary?.otherUserInactive) : false;
  const userId = isThreadMode ? (threadDetail?.otherUserId || urlUserId) : urlUserId;
  const userName = isThreadMode ? (threadDetail?.otherUserName || urlUserName) : urlUserName;


  // Get current user
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ["/api/user/current"],
    staleTime: 60000,
  });

  // Initialize WebSocket
  const { sendTyping, onlineUsers } = useWebSocketFixed((currentUser as any)?.id);
  const isOtherUserOnline = onlineUsers.has(userId);

  // "Escribiendo…": emision y recepcion por WS (ver use-typing-indicator.ts).
  const { otherTyping, notifyTyping, stopMyTyping } = useTypingIndicator(userId, sendTyping);

  // Pedido ancla: staleTime 0 -> siempre revalida en segundo plano (expiracion
  // fresca), pero ya no descarta la cache (sin gcTime:0) para que reabrir un
  // chat muestre el ultimo dato al instante en vez de un skeleton.
  const { data: taskInfo, refetch: refetchTaskInfo } = useQuery({
    queryKey: ["/api/tasks", taskId],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
    enabled: !!taskId,
    staleTime: 0,
    // Dato embebido en la lista de hilos mientras llega el pedido real. No
    // cuenta como isLoading (sin skeleton). Se omite para completados: les
    // falta `delivery`, que usa el calculo de garantia.
    placeholderData: threadSummary?.sendableTask
      && threadSummary.sendableTask.id === taskId
      && threadSummary.sendableTask.status !== 'completed'
      ? (threadSummary.sendableTask as any)
      : undefined,
  });

  // Detalles de un pedido especifico citado en una tarjeta de cotizacion
  // (distinto del pedido ancla) — solo se pide cuando el alumno lo abre.
  const { data: quoteTaskInfo } = useQuery({
    queryKey: ["/api/tasks", viewingQuoteTaskId],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${viewingQuoteTaskId}`, { credentials: 'include' });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!viewingQuoteTaskId,
    staleTime: 60000,
  });

  const detailSheetTask = viewingQuoteTaskId ? quoteTaskInfo : taskInfo;

  // Check if task is expired (status is 'expired' OR deadline passed with status 'active'/'available')
  const isTaskExpired = useMemo(() => {
    if (!taskInfo) return false;
    if (taskInfo.status === 'expired') return true;
    if ((taskInfo.status === 'active' || taskInfo.status === 'available') && taskInfo.deadline) {
      const deadline = new Date(taskInfo.deadline);
      return deadline < new Date();
    }
    return false;
  }, [taskInfo]);

  // Hiring State System - Determinar el estado del chat
  const chatState = useMemo(() => {
    if (!taskInfo) {
      return { 
        backendStatus: 'SELECTION' as BackendHiringStatus, 
        isReadonly: false, 
        banner: undefined,
        config: getHiringStateConfig('SELECTION')
      };
    }
    
    // Si está expirado, es CANCELLED
    if (isTaskExpired) {
      const config = getHiringStateConfig('CANCELLED');
      return {
        backendStatus: 'CANCELLED' as BackendHiringStatus,
        isReadonly: true,
        banner: getBanner('CANCELLED'),
        config
      };
    }
    
    // Mapear estado legacy al nuevo sistema
    const backendStatus = mapLegacyToBackend(taskInfo.status);
    const config = getHiringStateConfig(backendStatus);
    let isReadonly = isChatReadonly(backendStatus);
    let banner = getBanner(backendStatus);
    
    // BLOQUEO en casos específicos
    const currentUserData = currentUser as any;
    const iAmTutor = currentUserData?.userType === 'tutor';
    const iAmStudent = currentUserData?.userType === 'student';
    
    if (iAmTutor) {
      // Caso 1: ANTI-SABOTAJE - Otro tutor fue seleccionado Y pago fue confirmado
      // Durante payment_pending: bloquear chat pero NO marcar como cerrado
      const paymentConfirmed = taskInfo.status === 'in_progress' || taskInfo.status === 'completed' || taskInfo.status === 'in_review';
      const anotherTutorSelected = taskInfo.assignedTutorId && 
                                    taskInfo.assignedTutorId !== currentUserData?.id;
      // Bloquear chat si hay otro tutor seleccionado (incluyendo payment_pending)
      if (anotherTutorSelected) {
        isReadonly = true;
        // Solo mostrar banner de "cerrado" si el pago ya fue confirmado
        if (paymentConfirmed) {
          banner = '🔒 Este pedido fue asignado a otro tutor';
        }
      }
      
      // Caso 2: Pedido completado - verificar período de gracia de 7 días
      if (taskInfo.status === 'completed') {
        const delivery = (taskInfo as any).delivery;
        const GRACE_PERIOD_DAYS = 7;
        
        if (delivery?.createdAt) {
          const deliveryDate = new Date(delivery.createdAt);
          const gracePeriodEnd = new Date(deliveryDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
          const now = new Date();
          
          if (now > gracePeriodEnd) {
            // Período de gracia expirado - bloquear chat
            isReadonly = true;
            banner = '✅ Este pedido ya fue completado';
          } else {
            // Dentro del período de gracia - chat abierto
            const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            banner = `📝 Pedido completado - ${daysRemaining} ${pluralizeEs(daysRemaining, "día")} ${pluralizeEs(daysRemaining, "restante")} para revisiones`;
          }
        } else {
          // Sin delivery info - mantener chat abierto para período de gracia
          // Esto ocurre cuando el delivery aún no se ha cargado o no existe
          banner = '📝 Pedido completado - Período de revisión activo';
        }
      }
      
      // Caso 3: Tarea cancelada
      if (taskInfo.status === 'cancelled') {
        isReadonly = true;
        banner = '⛔ Este pedido fue cancelado';
      }
    }
    
    // BLOQUEO PARA ESTUDIANTES - Cuando ya eligió un tutor (pago enviado o aprobado)
    if (iAmStudent) {
      // Si hay tutor asignado, bloquear chat con otros tutores
      // Esto aplica desde payment_pending (pago enviado) hasta completed
      const hasAssignedTutor = taskInfo.assignedTutorId;
      const isChattingWithAssignedTutor = taskInfo.assignedTutorId === userId;
      const taskHasPaymentOrInProgress = taskInfo.status === 'payment_pending' || 
                                          taskInfo.status === 'in_progress' || 
                                          taskInfo.status === 'completed';
      
      if (hasAssignedTutor && !isChattingWithAssignedTutor && taskHasPaymentOrInProgress) {
        isReadonly = true;
        banner = '🔒 Ya enviaste el pago a otro tutor';
      }
    }
    
    return { backendStatus, isReadonly, banner, config };
  }, [taskInfo, isTaskExpired, currentUser]);

  // Get other user information (tutor for students, student for tutors)
  // Si la lista de chats ya trae nombre/avatar/lastSeen del otro usuario (threadSummary) no se
  // consulta la DB: la consulta solo corre al entrar directo por URL, sin lista en cache.
  const { data: fetchedUserInfo } = useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error loading user info');
      }
      return response.json();
    },
    enabled: !!userId && !threadSummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  const otherUserInfo = fetchedUserInfo ?? (threadSummary && {
    name: threadSummary.otherUserName,
    avatar: threadSummary.otherUserAvatar,
    lastSeen: threadSummary.otherUserLastSeen,
    email: undefined,
    university: undefined,
  });

  // Alias for backward compatibility
  const tutorInfo = otherUserInfo;

  // Fetch all tutors list so the student can view the tutor's profile (only needed for students)
  const { data: allTutors } = useQuery<PublicTutor[]>({
    queryKey: ["/api/tutors"],
    enabled: (currentUser as any)?.userType === 'student',
    staleTime: 5 * 60 * 1000,
  });

  // Build the tutor profile object from otherUserInfo + tutor record (para navegar a /tutor/:id)
  const tutorProfileData = (() => {
    if ((currentUser as any)?.userType !== 'student' || !otherUserInfo || !allTutors) return null;
    const tutorRecord = allTutors.find((t: PublicTutor) => t.user_id === userId);
    if (!tutorRecord) return null;
    return {
      id: tutorRecord.id,
      slug: tutorRecord.slug,
      userId: tutorRecord.user_id,
      name: otherUserInfo.name || userName,
      email: otherUserInfo.email || "",
      university: otherUserInfo.university || "",
      avatar: otherUserInfo.avatar || undefined,
      rating: tutorRecord.rating || "0.00",
      specialties: tutorRecord.specialties || [],
      profession: tutorRecord.profession || "",
      bio: tutorRecord.bio || "",
      isVerified: tutorRecord.isVerified || false,
      lastSeen: otherUserInfo.lastSeen || null,
    };
  })();

  // Perfil: solo el alumno puede abrirlo (el tutor ve al alumno anonimizado).
  const canOpenProfile = !!tutorProfileData;
  // En el split de escritorio (`embedded`) el perfil reemplaza al chat dentro de su misma columna (como en Tutores); fuera de el
  // navega a la pagina del tutor. Al cambiar de conversacion se vuelve al chat.
  const [showProfileInline, setShowProfileInline] = useState(false);
  useEffect(() => { setShowProfileInline(false); }, [userId]);
  const handleOpenProfile = () => {
    if (!tutorProfileData) return;
    if (embedded) setShowProfileInline(true);
    else setLocation(tutorRoute(tutorProfileData));
  };

  // Get bank accounts for STUDENT's country (the one who pays)
  const studentCountry = (currentUser as any)?.country || 'PE';
  const { data: bankAccounts } = useQuery({
    queryKey: ["/api/bank-accounts/country", studentCountry],
    queryFn: async () => {
      const response = await fetch(`/api/bank-accounts/country/${studentCountry}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!studentCountry && showPaymentModal,
    staleTime: 5 * 60 * 1000,
  });

  // Check if payment already exists for this task+tutor combination
  const { data: existingPayment } = useQuery({
    queryKey: ["/api/payment-verifications/check", taskId, userId],
    queryFn: async () => {
      const response = await fetch(`/api/payment-verifications/check?taskId=${taskId}&tutorId=${userId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        return null; // If not found, return null (no payment yet)
      }
      const payment = await response.json();
      return payment;
    },
    enabled: !!taskId && !!userId && (currentUser as any)?.userType === 'student',
    staleTime: 30000,
  });

  // Update paymentSent state when we detect an existing payment
  useEffect(() => {
    if (existingPayment) {
      setPaymentSent(true);
    }
  }, [existingPayment]);


  // Get messages for this conversation (paginated: latest 50).
  // Modo hilo: historial completo del hilo (todos los pedidos compartidos),
  // via el endpoint por threadId — no depende de que haya un taskId activo.
  const messagesQueryKey = useMemo(
    () => isThreadMode
      ? [...threadMessagesKey(urlThreadId)]
      : ["/api/chat/messages", taskId, userId],
    [isThreadMode, urlThreadId, taskId, userId]
  );
  const messagesEnabled = isThreadMode ? !!urlThreadId : (!!taskId && !!userId);
  const { data: messages = [], isPending: messagesPending } = useQuery({
    queryKey: messagesQueryKey,
    queryFn: () => isThreadMode
      ? fetchThreadMessages(urlThreadId)
      : fetchMessagesPage(`/api/chat/messages/${taskId}/${userId}?limit=20`, messagesQueryKey),
    enabled: messagesEnabled,
    // Fallback si el WS esta caido, no el canal principal (ver Ronda 1) —
    // no necesita reaccionar en 30s. 30s->2min->10min: al reconectar el WS el chat invalida
    // esta query (websocket_reconnected), asi que el poll es solo la red de seguridad.
    refetchInterval: () => chatPollInterval(600000),
    refetchIntervalInBackground: false,
    staleTime: 20000,
    // Sin override de gcTime: usa el default global (7 dias, queryClient.ts),
    // que matchea el maxAge del persister de IndexedDB. Antes era 300000
    // (5 min) — un hilo no visitado en ese lapso se borraba del cache y el
    // siguiente write del persister lo perdia de disco tambien. Con el
    // default largo, reabrir cualquier hilo visitado (aunque haya sido hace
    // dias) muestra el ultimo estado guardado al instante; staleTime (20s)
    // ya se encarga de revalidar en segundo plano.
  });

  // hasMore lo escribe el fetcher (chat-queries.ts) en la cache. Esta query
  // solo lo lee: el queryFn devuelve el valor ya cacheado (nunca pisa el
  // dato, tampoco cuando invalidateQueries(["/api/chat/messages"]) hace
  // match por prefijo) y staleTime Infinity evita refetch propio.
  const { data: hasMore = false } = useQuery<boolean>({
    queryKey: hasMoreKey(messagesQueryKey),
    queryFn: () => queryClient.getQueryData<boolean>(hasMoreKey(messagesQueryKey)) ?? false,
    enabled: messagesEnabled,
    staleTime: Infinity,
  });

  // Foco automatico en el composer al abrir esta conversacion (p.ej. desde
  // "Chatear" en el perfil de tutor -> /messages?threadId=X). En split-view
  // desktop, messages-desktop-split.tsx remonta este componente con
  // key={thread.id} por cada seleccion, asi que este efecto corre de nuevo.
  // Depende de userLoading/showSpinner (no []): el guard mas abajo
  // devuelve un spinner mientras cargan, asi que el input
  // real todavia no existe en el primer render y un efecto sin estas deps
  // se perderia el mount real del composer.
  const showSpinner = userLoading || (messagesEnabled && messagesPending);
  useEffect(() => {
    if (showSpinner) return;
    messageInputRef.current?.focus();
  }, [showSpinner]);

  // Mensajes instantáneos: el WS ya llega global (sin salas), así que
  // solo invalidamos si el evento pertenece a ESTA conversación abierta.
  // El poll de 30s de arriba queda como fallback si el WS está caído.
  // Requiere useWebSocketFixed (el singleton, ver su comentario en
  // hooks/useWebSocketFixed.ts) como fuente del evento 'websocket_message'
  // — es el unico hook de WS que mantiene la conexion viva sin matar la
  // presencia del usuario al perder foco de pestaña (SESSION_STATE.md fix #5).
  //
  // REGLA: cualquier actualizacion de UI a partir de 'new_message' va por
  // queryClient.setQueryData (sincronico, con el mensaje ya completo que
  // trae el propio WS) ANTES de cualquier invalidateQueries. invalidate
  // dispara un fetch async sin garantia de orden de llegada; con 2+
  // invalidaciones casi simultaneas (WS + onSuccess del POST propio) la
  // respuesta mas vieja puede resolver despues y pisar la mas nueva en el
  // cache (bug real, ver fix #4 en SESSION_STATE.md). setQueryData nunca
  // tiene esa carrera porque no espera red. invalidateQueries se mantiene
  // solo como respaldo, DESPUES del setQueryData, para sincronizar campos
  // que unicamente el server calcula (unreadCount, sendableTaskId).
  // Badge/negrita/hora verde de la lista lateral salen de threads[].unreadCount.
  // Chat abierto y visible = leido: se pone en 0 en el cache al instante (0 ms),
  // sin esperar el POST de mark-read ni un refetch. cancelQueries evita que un
  // GET /threads ya en vuelo (con el unreadCount viejo del server) lo pise.
  // Tambien el badge de la barra de navegacion (/api/chat/last-messages, task-centric,
  // clave `${taskId}-${idA}-${idB}`): se pone en 0 cada conversacion con esta persona.
  const clearThreadUnread = useCallback(() => {
    const meId = (currentUser as any)?.id;
    queryClient.cancelQueries({ queryKey: ["/api/chat/threads"], exact: true });
    queryClient.cancelQueries({ queryKey: ["/api/chat/last-messages"] });
    queryClient.setQueryData(["/api/chat/threads"], (old: any[] | undefined) => {
      const isThis = (t: any) => t.unreadCount > 0 && (t.id === urlThreadId || t.otherUserId === userId);
      return old?.some(isThis) ? old.map((t) => (isThis(t) ? { ...t, unreadCount: 0 } : t)) : old;
    });
    queryClient.setQueryData(["/api/chat/last-messages"], (old: Record<string, any> | undefined) => {
      if (!old || !meId || !userId) return old;
      const isThis = ([k, v]: [string, any]) => v?.unreadCount > 0 && k.includes(meId) && k.includes(userId);
      const entries = Object.entries(old);
      return entries.some(isThis) ? Object.fromEntries(entries.map((e) => (isThis(e) ? [e[0], { ...e[1], unreadCount: 0 }] : e))) : old;
    });
  }, [queryClient, urlThreadId, userId, currentUser]);

  useEffect(() => {
    const meId = (currentUser as any)?.id;
    const handleWsMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      // Acuse de lectura de la otra persona: pinta el doble check verde en
      // mis mensajes sin esperar un refetch.
      if (msg?.type === 'messages_read' && msg.readByUserId !== meId && Array.isArray(msg.messageIds)) {
        const ids = new Set<string>(msg.messageIds);
        queryClient.setQueryData(messagesQueryKey, (old: Message[] | undefined) =>
          old?.some(m => ids.has(m.id) && !m.readAt)
            ? old.map(m => (ids.has(m.id) ? { ...m, readAt: msg.readAt } : m))
            : old
        );
        return;
      }
      // El admin oculto un mensaje: ambas partes lo ven oculto al instante, sin recargar.
      if (msg?.type === 'message_moderated' && msg.messageId) {
        queryClient.setQueryData(messagesQueryKey, (old: Message[] | undefined) =>
          old?.some(m => m.id === msg.messageId)
            ? old.map(m => (m.id === msg.messageId
                ? { ...m, message: 'Mensaje ocultado por moderación', moderationStatus: 'hidden' as const, attachments: [], attachmentNames: [], attachmentSizes: [], attachmentDims: [] }
                : m))
            : old
        );
        queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"], exact: true });
        return;
      }
      if (msg?.type !== 'new_message' && msg?.type !== 'message_sent') return;
      const sameConversation =
        (msg.senderId === meId && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === meId) ||
        (!!taskId && msg.taskId === taskId);
      if (sameConversation) {
        // Actualizacion sincronica del chat abierto: el WS ya trae el
        // mensaje completo (msg.message = el savedMessage real), no hace
        // falta esperar un GET para pintarlo. Antes esto era
        // invalidateQueries (2 fetches en carrera con el de threads de
        // abajo, sin garantia de orden) — ahora el chat abierto siempre
        // gana porque no espera red.
        // Solo para mensajes de LA OTRA persona: el propio mensaje del
        // usuario ya lo reconcilia sendMessageMutation.onSuccess via
        // tempId (sin ambiguedad, mismo request). El servidor tambien nos
        // manda a nosotros mismos el eco por WS (sendToUser(user.id,...))
        // y puede llegar ANTES que la respuesta del POST — si este bloque
        // corriera igual para el propio mensaje, el dedupe por id real no
        // detecta el `temp-...` (id distinto) y agrega una fila nueva;
        // cuando el POST resuelve, onSuccess reemplaza el temp- por el
        // mismo mensaje real -> queda duplicado en pantalla.
        if (msg.senderId !== meId) {
          queryClient.setQueryData(
            messagesQueryKey,
            (old: Message[] | undefined) => {
              if (!msg.message?.id) return old;
              if ((old || []).some(m => m.id === msg.message.id)) return old;
              return [...(old || []), msg.message];
            }
          );
        }
        // El preview (ultimo mensaje) de la lista de conversaciones vive en
        // esta otra query (messages-section.tsx). Antes esto solo
        // invalidaba y esperaba un refetch — con 2+ invalidaciones casi
        // simultaneas (esta y la de sendMessageMutation.onSuccess) las
        // respuestas podian llegar desordenadas y la mas vieja pisaba a la
        // mas nueva, dejando el preview stale (bug reportado). msg.message
        // ya trae threadId (server/storage.ts createChatMessage siempre lo
        // setea) — parchear el cache directo, determinista, sin esperar red.
        const threadKnown = !!queryClient.getQueryData<any[]>(["/api/chat/threads"])?.some((t) => t.id === msg.message?.threadId);
        queryClient.setQueryData(
          ["/api/chat/threads"],
          (old: any[] | undefined) => {
            if (!old || !msg.message?.threadId) return old;
            const idx = old.findIndex((t) => t.id === msg.message.threadId);
            if (idx === -1) return old;
            const updated = { ...old[idx], lastMessage: chatPreviewText(msg.message.message, msg.message.attachments, msg.message.attachmentNames), lastMessageKind: chatAttachmentKind(msg.message.attachments, msg.message.attachmentNames), lastMessageAt: msg.message.createdAt };
            return [updated, ...old.filter((_, i) => i !== idx)];
          }
        );
        // exact:true: no debe hacer match por prefijo con messagesQueryKey
        // (ya actualizado arriba) ni con el detalle del hilo. Se mantiene
        // como respaldo: cubre hilos todavia no cacheados y sincroniza
        // campos que solo el server sabe (unreadCount, sendableTaskId).
        // Eco de mi propio envio con hilo ya cacheado: onSuccess ya lo parcho,
        // no hace falta otro GET. Mensaje ajeno en el chat abierto: se lee en
        // vivo, asi que unreadCount=0 ya (el effect de mark-read invalida
        // DESPUES del POST; invalidar aqui traeria el conteo viejo del server).
        const incoming = msg.senderId !== meId;
        if (incoming && shouldReadChat) clearThreadUnread();
        if (!threadKnown || (incoming && !shouldReadChat)) queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"], exact: true });
      }
    };
    window.addEventListener('websocket_message', handleWsMessage);
    return () => window.removeEventListener('websocket_message', handleWsMessage);
  }, [currentUser, userId, taskId, messagesQueryKey, queryClient, shouldReadChat, clearThreadUnread]);

  // Load older messages (prepend) keeping scroll position
  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || isLoadingOlderRef.current || messages.length === 0) return;
    isLoadingOlderRef.current = true;
    setLoadingOlder(true);

    const oldest = messages[0] as any;
    const before = oldest.createdAt || oldest.timestamp;

    try {
      const url = isThreadMode
        ? `/api/chat/threads/${urlThreadId}/messages?limit=50&before=${encodeURIComponent(before)}`
        : `/api/chat/messages/${taskId}/${userId}?limit=50&before=${encodeURIComponent(before)}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error loading older messages');
      const result = await response.json();
      setHasMoreCache(messagesQueryKey, !!result.hasMore);
      seedTaskCache(result.tasks);

      const addedCount = (result.messages as Message[]).length;
      queryClient.setQueryData(
        messagesQueryKey,
        (old: Message[] | undefined) => [...(result.messages as Message[]), ...(old || [])]
      );

      // Restore scroll position so content doesn't jump: se ancla por INDICE al que era
      // el primer mensaje (ahora en addedCount). Con scrollHeight - prevScrollHeight las
      // filas prependeadas aun no estan medidas (estimados) y el contenido saltaba al medirse.
      requestAnimationFrame(() => {
        if (addedCount > 0) messageListRef.current?.scrollToIndex(addedCount, { align: 'start', behavior: 'auto' });
      });
    } catch (e) {
      console.error('Failed to load older messages:', e);
    } finally {
      isLoadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasMore, messages, taskId, userId, queryClient, isThreadMode, urlThreadId, messagesQueryKey]);

  // Cotizacion vigente de ESTE pedido (la mas reciente): una sola pasada, sin copiar ni ordenar
  // el historial. De ahi salen el precio de la conversacion y el id de la tarjeta de cotizacion
  // vigente (las demas muestran "Oferta reemplazada" en vez del boton Contratar).
  //
  // Solo mira mensajes del pedido ancla (taskId) — en un hilo continuo que mezcla varios
  // pedidos, buscar en TODO el historial traia el precio de una cotizacion vieja de otro pedido
  // (bug reportado: barra mostraba un precio que no correspondia a nada activo).
  // Con tiempos iguales gana el primero del historial (como el sort estable anterior).
  const latestAnchorQuote = useMemo(() => {
    let best: { id: string; price: string; time: number } | null = null;
    for (const m of messages as Message[]) {
      if (m.taskId && m.taskId !== taskId) continue;
      const price = parseQuoteFromMessage(m.message || '');
      if (!price) continue;
      const time = new Date(m.createdAt || m.timestamp || '').getTime();
      if (!best || time > best.time) best = { id: m.id, price, time };
    }
    return best;
  }, [messages, taskId]);
  // Sin cotizacion en el chat: presupuesto inicial del pedido.
  const currentPrice = latestAnchorQuote?.price ?? (taskInfo?.budget?.toString() || '0');
  const latestQuoteMessageId = latestAnchorQuote?.id ?? null;

  // Auto-scroll to bottom - instant for new messages. Via el virtualizer
  // (scrollToIndex), no un sentinel DOM al final — con virtualizacion el
  // ultimo mensaje no siempre esta montado.
  const scrollToBottom = (_instant = false) => {
    if (messages.length === 0) return;
    // Siempre 'auto': con filas sin medir, 'smooth' calcula el destino con estimados y se corrige
    // al medir (animacion que se estira/frena), y snapToRealBottom la interrumpe a los 2 frames.
    messageListRef.current?.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'auto' });
  };

  // scrollToIndex calcula la posicion con estimateSize (80px, fijo) hasta
  // que la fila objetivo se monta y measureElement mide su alto REAL via
  // ResizeObserver (1-2 frames despues). Burbujas reales rara vez miden
  // 80px (texto multi-linea, sobre todo la tarjeta de cotizacion del fix
  // #7 — bastante mas alta) asi que "el fondo" calculado con el estimado
  // queda corto apenas la medicion real corre: el chat "sube" sin que
  // nadie lo mueva (bug reportado). scrollTop = scrollHeight directo no
  // depende de estimados, siempre es el fondo real — mismo patron que ya
  // usa loadOlderMessages (mas abajo) para restaurar posicion tras
  // prependear mensajes viejos.
  const snapToRealBottom = () => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  // Umbral generoso (150px): evita pisarle el scroll a alguien que subio
  // a proposito a leer historial cuando algo ajeno (banner de reseña,
  // etc) cambia el alto del composer despues del scroll inicial.
  const isNearBottom = (threshold = 150) => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };
  // Snap diferido (rAF / timeout) que respeta si el usuario ya subio a leer.
  const snapIfFollowing = () => {
    if (!userScrolledUpRef.current) snapToRealBottom();
  };
  // La burbuja "escribiendo" agrega alto al final: si el usuario ya estaba abajo, seguirla.
  useEffect(() => {
    if (otherTyping && !userScrolledUpRef.current && isNearBottom(200)) snapToRealBottom();
  }, [otherTyping]);

  // Scroll inicial (primer unread o fondo): useLayoutEffect, no useEffect.
  // useEffect corre DESPUES de que el navegador ya pinto el frame — se veia
  // "aparece arriba, despues salta" (flash reportado). useLayoutEffect corre
  // sincronico antes del paint, el usuario nunca ve la posicion intermedia.
  // Por eso tambien sin requestAnimationFrame (ya no hace falta, y
  // reintroduciria el frame de espera que se esta eliminando).
  useLayoutEffect(() => {
    if (messages.length === 0) return;
    if (isLoadingOlderRef.current) return;
    if (initialScrollDone.current) return;

    initialScrollDone.current = true;
    prevMessagesLengthRef.current = messages.length;

    const firstUnread = messages.findIndex(
      (msg: Message) => msg.senderId !== (currentUser as any)?.id && !msg.readAt
    );

    if (firstUnread !== -1) {
      // Va al primer no-leido (incluye indice 0 — findIndex ya devuelve -1
      // cuando no hay ninguno, `> 0` excluia el caso valido de que el
      // primer mensaje cargado sea el primer no-leido, bug encontrado
      // verificando este fix con Playwright: rafaga de no-leidos que llena
      // toda la pagina cargada caia siempre al else de abajo). NO al fondo
      // — no activar la ventana de gracia ni corregir hacia abajo aca,
      // pisaria el punto de lectura que se le esta mostrando al usuario
      // (el ResizeObserver de abajo
      // solo corrige dentro de esta ventana o si isNearBottom, y aca no
      // estamos ni queremos estar cerca del fondo).
      messageListRef.current?.scrollToIndex(firstUnread, { align: 'start', behavior: 'auto' });
    } else {
      scrollGraceUntilRef.current = Date.now() + 3000;
      scrollToBottom(true);
      requestAnimationFrame(() => requestAnimationFrame(snapIfFollowing));
      setTimeout(snapIfFollowing, 50);
    }
  }, [messages, (currentUser as any)?.id]);

  // Scroll para mensajes NUEVOS que llegan mientras el chat ya esta abierto
  // (no la carga inicial) — este si debe verse animado/smooth. Se guarda el
  // largo previo para no re-disparar en el mismo commit donde el efecto de
  // arriba recien hizo el scroll inicial (initialScrollDone.current ya
  // quedaria en true ahi mismo, este efecto correria igual sin este chequeo).
  useEffect(() => {
    if (messages.length === 0) return;
    if (isLoadingOlderRef.current) return;
    if (!initialScrollDone.current) return;
    if (messages.length === prevMessagesLengthRef.current) return;
    prevMessagesLengthRef.current = messages.length;

    // Mensaje ajeno y lejos del fondo (ej. leyendo la rafaga de no-leidos
    // desde el primer no-leido tras abrir el chat, Disparador #1): no
    // pisar esa lectura. Mensaje propio siempre sigue al fondo (accion
    // propia, se espera el salto).
    const lastMessage = messages[messages.length - 1] as any;
    const isOwnMessage = lastMessage?.senderId === (currentUser as any)?.id;
    if (!isOwnMessage && (userScrolledUpRef.current || !isNearBottom())) return;
    if (isOwnMessage) userScrolledUpRef.current = false; // accion propia: se sigue al fondo

    scrollGraceUntilRef.current = Date.now() + 3000;
    scrollToBottom();
    requestAnimationFrame(() => requestAnimationFrame(snapIfFollowing));
    setTimeout(snapIfFollowing, 50);
  }, [messages, (currentUser as any)?.id]);

  // Reset initial scroll flag SOLO en un cambio real de conversacion, no en
  // el primer montaje. Un useEffect siempre corre una vez al montar (no hay
  // "valor previo" con que comparar la primera vez) — si reseteamos el flag
  // ahi, el useLayoutEffect de scroll inicial (arriba) queda re-armado justo
  // despues del primer pintado correcto, y si `messages`/`currentUser?.id`
  // cambian de referencia otra vez poco despues (ej. la revalidacion en
  // background por staleTime, Ronda 9), se dispara un SEGUNDO scroll visible
  // (salta al fondo, despues sube al no-leido) en vez de ir directo. Guardar
  // la identidad previa evita actuar en esa primera corrida.
  const chatIdentityRef = useRef<string | null>(null);
  useEffect(() => {
    const currentIdentity = `${isThreadMode ? urlThreadId : taskId}|${userId}`;
    if (chatIdentityRef.current !== null && chatIdentityRef.current !== currentIdentity) {
      initialScrollDone.current = false;
      userScrolledUpRef.current = false;
    }
    chatIdentityRef.current = currentIdentity;
  }, [isThreadMode ? urlThreadId : taskId, userId]);

  // En modo hilo, "hay algo que marcar como leido" depende del threadId
  // resuelto, no del taskId (que puede estar vacio sin pedido activo).
  const canMarkAsRead = isThreadMode ? !!urlThreadId : (!!taskId && !!userId);
  const markReadUrl = isThreadMode
    ? `/api/chat/threads/${urlThreadId}/mark-read`
    : `/api/chat/mark-read/${taskId}/${userId}`;

  // Mark messages as read when chat opens (only if shouldReadChat is true)
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!canMarkAsRead || !currentUser || !shouldReadChat) return;

      clearThreadUnread();
      try {
        const response = await fetch(markReadUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          // Sidebar de mensajes lee unreadCount de esta otra key (Ronda 13).
          // Primero threads: antes esperaba el refetch pesado de last-messages.
          queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"], exact: true });
          await queryClient.refetchQueries({ queryKey: ["/api/chat/last-messages"] });
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    // Mark as read immediately when chat opens (only if shouldReadChat is true)
    markMessagesAsRead();
  }, [canMarkAsRead, markReadUrl, currentUser, shouldReadChat]);

  useEffect(() => {
    const handleReconnect = () => {
      if (canMarkAsRead) {
        queryClient.invalidateQueries({ queryKey: messagesQueryKey });
        queryClient.invalidateQueries({ queryKey: ["/api/chat/last-messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"], exact: true });
      }
    };
    window.addEventListener('websocket_reconnected', handleReconnect);
    return () => window.removeEventListener('websocket_reconnected', handleReconnect);
  }, [canMarkAsRead, messagesQueryKey]);

  // Also mark as read when new messages arrive (only if shouldReadChat is true)
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!canMarkAsRead || !currentUser || messages.length === 0 || !shouldReadChat) return;

      clearThreadUnread();
      try {
        await fetch(markReadUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        // Silently update badges
        queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"], exact: true });
        queryClient.refetchQueries({ queryKey: ["/api/chat/last-messages"] });
      } catch (error) {
        // Silent fail for subsequent reads
      }
    };

    markMessagesAsRead();
  }, [messages.length, shouldReadChat, canMarkAsRead, markReadUrl]);

  const optimisticBlobUrlsRef = useRef(new Map<string, string[]>());
  const revokeOptimisticBlobs = (tempId: string) => {
    optimisticBlobUrlsRef.current.get(tempId)?.forEach(u => URL.revokeObjectURL(u));
    optimisticBlobUrlsRef.current.delete(tempId);
  };
  // Al cerrar el chat con un envio aun en vuelo, los blobs optimistas no deben quedar en memoria.
  useEffect(() => {
    const pending = optimisticBlobUrlsRef.current;
    return () => {
      pending.forEach(urls => urls.forEach(u => URL.revokeObjectURL(u)));
      pending.clear();
    };
  }, []);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, files, fileNames, targetTaskId, replyToId, tempId }: { message: string; files?: File[]; fileNames?: string[]; targetTaskId?: string; replyToId?: string; tempId: string }) => {
      const formData = new FormData();
      formData.append('clientMsgId', tempId); // dedup del servidor por envio, no por texto
      const sendTaskId = targetTaskId || taskId;
      if (sendTaskId) formData.append('taskId', sendTaskId); // sin pedido en comun: mensaje directo, server ya no lo exige
      formData.append('receiverId', userId);
      formData.append('message', message || '📎 Archivo adjunto');
      if (replyToId) formData.append('replyToId', replyToId);
      
      // Handle regular file uploads (File objects)
      if (files) {
        files.forEach(file => {
          formData.append('files', file);
        });
      }
      
      // Handle existing file names (for payment receipts already uploaded)
      if (fileNames) {
        fileNames.forEach(fileName => {
          formData.append('existingFiles', fileName);
        });
      }

      const response = await fetch('/api/chat/send', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(await responseErrorMessage(response, `HTTP ${response.status}: `));
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Reemplazo puntual: swapear el mensaje optimista por el real que
      // devuelve el POST, sin invalidar/refetchear toda la lista. Antes
      // esto disparaba un GET completo de mensajes en cada envio (visible
      // en consola como "Loaded N messages") — trabajo redundante, el
      // usuario ya tiene todo lo que necesita en `data`.
      queryClient.setQueryData(
        messagesQueryKey,
        (old: Message[] | undefined) => (old || []).map(m => m.id === variables.tempId ? data : m)
      );
      revokeOptimisticBlobs(variables.tempId);
      // El servidor censuro datos de contacto (telefono, enlace, email): el mensaje ya se ve con asteriscos; se le avisa al emisor.
      if (data?.moderation?.censored) {
        toast({ title: "Mensaje enviado sin datos de contacto", description: data.moderation.notice, icon: ShieldAlert });
      }
      // Preview del ultimo mensaje en la lista de conversaciones
      // (messages-section.tsx). Parche directo del cache, determinista —
      // antes solo invalidaba y esperaba un refetch, que podia perder la
      // carrera contra el invalidate del eco por WS (bug reportado: sidebar
      // se quedaba con el texto/hora viejos). `data` es el savedMessage
      // real devuelto por el POST, ya trae threadId.
      const threadKnown = !!queryClient.getQueryData<any[]>(["/api/chat/threads"])?.some((t) => t.id === data?.threadId);
      queryClient.setQueryData(
        ["/api/chat/threads"],
        (old: any[] | undefined) => {
          if (!old || !data?.threadId) return old;
          const idx = old.findIndex((t) => t.id === data.threadId);
          if (idx === -1) return old;
          const updated = { ...old[idx], lastMessage: chatPreviewText(data.message, data.attachments, data.attachmentNames), lastMessageKind: chatAttachmentKind(data.attachments, data.attachmentNames), lastMessageAt: data.createdAt };
          return [updated, ...old.filter((_, i) => i !== idx)];
        }
      );
      // `exact:true` para que NO haga match por prefijo con
      // ["/api/chat/threads", urlThreadId, "messages"] (el chat que
      // acabamos de reconciliar arriba) ni con el detalle del hilo. Se
      // mantiene solo para hilos aun no cacheados (primer mensaje a un
      // contacto nuevo): si ya estaba en cache, el parche de arriba basta.
      if (!threadKnown) queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"], exact: true });
    },
    onError: (error, variables) => {
      console.error('Send error:', error);
      // Adjunto que no se pudo enviar: al panel Errores. Los 5xx ya los registra el servidor; aqui van los cortes
      // de red (la subida nunca llego) y los rechazos 4xx, que el servidor no registra.
      if (variables.files?.length && !/^HTTP 5\d\d/.test(error.message)) {
        reportAttachmentFailure({ reason: "send-failed", files: variables.files, detail: error.message });
      }

      // Remove the optimistic message that failed (solo esa, no cualquier
      // otro envio "sending" que pueda estar en vuelo al mismo tiempo)
      queryClient.setQueryData(
        messagesQueryKey,
        (old: Message[] | undefined) => (old || []).filter(m => m.id !== variables.tempId)
      );
      revokeOptimisticBlobs(variables.tempId);
      // El input ya se vacio al enviar: devolver el texto para no perderlo (solo si el usuario no escribio otra cosa).
      if (variables.message && !variables.targetTaskId) setMessage((cur) => cur || variables.message);

      // Check if task expired - refresh task info to update UI
      if (error.message.includes('TASK_EXPIRED') || error.message.includes('El tiempo del pedido')) {
        refetchTaskInfo();
        toast({
          title: "Pedido expirado",
          description: "El tiempo del pedido ha terminado. Debes republicar para continuar.",
          variant: "destructive",
        });
        return;
      }

      if (error.message.includes('USER_BLOCKED')) {
        toast({
          title: "No se pudo enviar",
          description: "No puedes enviar mensajes a este usuario.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Error al enviar mensaje",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Datos reducidos del mensaje citado. El server no manda senderName en los
  // mensajes normales: si lo escribio el otro participante, es `userName`.
  const toReplyPreview = (m: Message): ReplyPreview => ({
    id: m.id,
    message: m.message,
    senderId: m.senderId,
    senderName: m.senderName || (m.senderId === userId ? userName : 'Usuario'),
    attachments: m.attachments ?? null,
    attachmentNames: m.attachmentNames ?? null,
  });

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && selectedFiles.length === 0) return;
    stopMyTyping();

    // Optimistic update: add message immediately with "sending" status
    const tempId = `temp-${Date.now()}`;
    const optimisticAttachments = selectedFiles.map(f => (isImageFile(f.name) || isPdfName(f.name) ? URL.createObjectURL(f) : f.name));
    const blobUrls = optimisticAttachments.filter(u => u.startsWith('blob:'));
    if (blobUrls.length > 0) optimisticBlobUrlsRef.current.set(tempId, blobUrls);
    const optimisticMessage: Message = {
      id: tempId,
      taskId,
      senderId: (currentUser as any)?.id || '',
      receiverId: userId,
      message: trimmedMessage || '📎 Archivo adjunto',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      senderName: (currentUser as any)?.name || 'Yo',
      status: 'sending',
      // Imagenes: URL local (blob:) para pintar la miniatura ya, sin esperar el
      // upload (con solo el nombre, getFileUrl apuntaba a un path inexistente y
      // la burbuja caia al icono de documento). Se revoca al terminar el envio.
      attachments: selectedFiles.length > 0 ? optimisticAttachments : undefined,
      attachmentNames: selectedFiles.length > 0 ? selectedFiles.map(f => f.name) : undefined,
      attachmentSizes: selectedFiles.length > 0 ? selectedFiles.map(f => f.size) : undefined,
      attachmentDims: selectedFiles.length > 0 ? selectedFiles.map(f => selectedFileDimsRef.current.get(f) ?? null) : undefined,
      replyToId: replyingToMessage?.id ?? null,
      replyTo: replyingToMessage ? toReplyPreview(replyingToMessage) : null,
    };
    
    
    // Add to cache immediately - this should render instantly
    queryClient.setQueryData(
      messagesQueryKey,
      (old: Message[] | undefined) => {
        const newMessages = [...(old || []), optimisticMessage];
        return newMessages;
      }
    );
    
    // Clear input immediately for better UX
    const messageTosend = trimmedMessage;
    const filesToSend = selectedFiles.length > 0 ? [...selectedFiles] : undefined;
    const replyToIdToSend = replyingToMessage?.id;
    setMessage('');
    setSelectedFiles([]);
    setShowFilePreview(false);
    setReplyingToMessage(null);
    
    // Instant scroll for sent messages
    userScrolledUpRef.current = false;
    scrollToBottom(true);
    
    // Send to server in background
    sendMessageMutation.mutate({
      message: messageTosend,
      files: filesToSend,
      tempId,
      replyToId: replyToIdToSend,
    });
  };

  const addFiles = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      setShowFilePreview(true);
    }
  };

  const { pick: pickFile } = useFilePicker(addFiles);
  const handlePickSource = (source: PickSource) =>
    pickFile(source, source === "files" ? { accept: CHAT_FILE_ACCEPT } : undefined);

  const handleChatDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setIsDraggingFile(true);
  };

  const handleChatDragLeave = (event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleChatDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDraggingFile(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFiles.length === 1) {
      setShowFilePreview(false);
    }
  };


  // Payment mutation
  const paymentMutation = useMutation({
    // Optimistic UI: el comprobante aparece ya en el chat (fila temp- "enviando") y el modal se
    // cierra; el POST sube el archivo y crea el pago (~3 s). Si falla se quita la fila y se reabre el modal.
    onMutate: (paymentData: { paymentMethod: string; receiptFile: File; tempId: string }) => {
      const blobUrl = URL.createObjectURL(paymentData.receiptFile);
      optimisticBlobUrlsRef.current.set(paymentData.tempId, [blobUrl]);
      const now = new Date().toISOString();
      const optimisticMessage: Message = {
        id: paymentData.tempId,
        taskId,
        senderId: (currentUser as any)?.id || '',
        receiverId: userId,
        message: `Pago enviado: ${currentPrice} ${taskInfo?.currency || 'PEN'}.\n\nAdjunto el comprobante para la verificación de la transferencia.`,
        timestamp: now,
        createdAt: now,
        senderName: (currentUser as any)?.name || 'Yo',
        status: 'sending',
        attachments: [blobUrl],
        attachmentNames: [paymentData.receiptFile.name],
        attachmentSizes: [paymentData.receiptFile.size],
      };
      queryClient.setQueryData(messagesQueryKey, (old: Message[] | undefined) => [...(old || []), optimisticMessage]);
      setShowPaymentModal(false);
    },
    mutationFn: async (paymentData: { paymentMethod: string; receiptFile: File; tempId: string }) => {
      const formData = new FormData();
      formData.append('taskId', taskId);
      formData.append('tutorId', userId);
      formData.append('paymentMethod', paymentData.paymentMethod);
      formData.append('amount', currentPrice || '0');
      formData.append('receipt', paymentData.receiptFile);

      const response = await fetch("/api/payments/create", {
        method: "POST",
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || `Error ${response.status} al procesar el pago`);
      }

      return data;
    },
    onSuccess: async (_data, variables) => {
      toast({
        title: "Pago enviado",
        description: "Tu pago ha sido enviado para verificación. Te notificaremos cuando sea aprobado.",
      });

      setPaymentMethod('');
      setReceiptFile(null);
      setPaymentSent(true);
      // El POST devuelve el pago, no el mensaje del chat: se relee la lista y el servidor trae el
      // mensaje real, que reemplaza a la fila temp- (la lista del servidor no la incluye). En modo
      // hilo la clave es ["/api/chat/threads", id, "messages"], no "/api/chat/messages".
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey }).finally(() => revokeOptimisticBlobs(variables.tempId));
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-verifications/check"] });
      // Lista de administracion (admin-dashboard.tsx, seccion Pagos) usa esta
      // misma key sin el "/check" — antes nunca se invalidaba desde aqui,
      // admin no veia el pago nuevo sin recargar manualmente.
      queryClient.invalidateQueries({ queryKey: ["/api/payment-verifications"] });
    },
    onError: (error: any, variables) => {
      queryClient.setQueryData(messagesQueryKey, (old: Message[] | undefined) => (old || []).filter(m => m.id !== variables.tempId));
      revokeOptimisticBlobs(variables.tempId);
      setShowPaymentModal(true); // el comprobante y el metodo siguen elegidos: reintenta sin volver a cargarlos
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar el pago",
        variant: "destructive",
      });
    }
  });

  // Mark task as completed mutation ("Entregar pedido")
  const markCompletedMutation = useMutation({
    mutationFn: async (targetTaskId: string) => {
      const response = await apiRequest('POST', `/api/tasks/${targetTaskId}/mark-completed`, {
        deliveryMessage: 'Pedido completado y entregado.'
      });
      return response;
    },
    onSuccess: () => {
      setShowMarkCompletedModal(false);
      setDeliveryActionTaskId(null);
      toast({
        title: "Pedido marcado como completado",
        description: "El pedido ha sido marcado como completado y el alumno tiene 7 días para revisar.",
      });
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/last-messages"] });
    },
    onError: (error: any) => {
      console.error('Error marking task as completed:', error);
      toast({
        title: "Error",
        description: "No se pudo marcar el pedido como completado. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Review system - query existing review for this task
  const isStudentUser = (currentUser as any)?.userType === 'student';
  const taskIsCompleted = taskInfo?.status === 'completed';
  const isChattingWithAssignedTutor = taskInfo?.assignedTutorId === userId;

  // Puede contratar con la cotizacion del pedido ancla actual (antes vivia
  // en la barra fija de arriba; ahora se ofrece dentro de la tarjeta de esa
  // cotizacion especifica en el chat).
  const taskAssignedToOther = !!taskInfo?.assignedTutorId && taskInfo.assignedTutorId !== userId;
  // Espejo exacto de `taskClosedStatuses` en POST /api/payments/create — sin
  // esto, un pedido 'completed' con el mismo tutor asignado (isReadonly no
  // se activa en ese caso, ver chatState arriba) deja el boton "Contratar"
  // visible y el submit siempre vuelve 400 "Este pedido ya esta cerrado."
  const taskIsClosed = !!taskInfo && ['completed', 'cancelled', 'expired'].includes(taskInfo.status);
  const canHireAnchorTask = !!taskInfo && isStudentUser && !paymentSent && !existingPayment && !chatState.isReadonly && !taskAssignedToOther && !taskIsClosed;

  const { data: existingReview, isLoading: reviewLoading } = useQuery({
    queryKey: ["/api/tasks", taskId, "review"],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${taskId}/review`, { credentials: 'include' });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Error loading review');
      return response.json();
    },
    enabled: !!taskId && isStudentUser && taskIsCompleted && isChattingWithAssignedTutor,
    retry: false,
  });

  // Señal UNIFICADA de "el alto disponible/de contenido cambio por
  // CUALQUIER motivo" (imagen adjunta terminando de cargar, banner de
  // reseña resolviendo, texto de cotizacion actualizado por una
  // revalidacion de taskInfo, o el proximo disparador que aparezca), en
  // vez de enganchar cada causa por separado. Se probo primero con
  // `[rowVirtualizer.getTotalSize()]` como dependencia de un useEffect —
  // NO disparaba de forma confiable (confirmado con Playwright: el
  // scrollHeight del contenedor crecia 130px+ entre snapshots sin que el
  // efecto corriera ni una vez). ResizeObserver nativo sobre los elementos
  // reales del DOM es la via confiable: no depende de que React decida
  // re-renderizar por ese cambio puntual, el browser lo notifica directo.
  // Se observan 2 elementos por separado porque cubren causas distintas:
  // `virtualContentRef` (el contenedor interno del virtualizer, alto =
  // getTotalSize()) detecta que el CONTENIDO crecio; `messagesContainerRef`
  // detecta que el CONTENEDOR se achico porque algo de afuera crecio
  // (cabecera, banner del composer). Dentro de la ventana de gracia (3s
  // post-apertura) corrige siempre, sin isNearBottom — el propio cambio
  // de alto puede ya haber empujado el gap mas alla del umbral, dando un
  // falso "no esta cerca del fondo" justo cuando mas hace falta corregir.
  // Pasada la ventana, isNearBottom vuelve a mandar (no pisar a quien
  // scrolleo arriba a proposito durante el uso normal del chat).
  useEffect(() => {
    const containerEl = messagesContainerRef.current;
    const contentEl = virtualContentRef.current;
    if (!containerEl) return;

    const maybeSnap = () => {
      if (!initialScrollDone.current) return;
      if (userScrolledUpRef.current) return; // el usuario esta leyendo historial: no se toca
      const inGraceWindow = Date.now() < scrollGraceUntilRef.current;
      if (!inGraceWindow && !isNearBottom(SNAP_NEAR_BOTTOM_PX)) return;
      snapToRealBottom();
    };

    const observer = new ResizeObserver(maybeSnap);
    observer.observe(containerEl);
    if (contentEl) observer.observe(contentEl);
    return () => observer.disconnect();
    // Depende de "hay mensajes" (no de `messages`): recrear el observer en cada
    // mensaje nuevo/refetch era trabajo inutil. virtualContentRef.current es null mientras messages.length === 0 (se
    // renderiza el estado "Inicia la conversación" en su lugar, sin el div
    // del virtualizer) — re-crear el observer cuando messages cambia
    // garantiza engancharse al elemento real apenas existe, no solo en el
    // primer mount del componente.
  }, [messages.length === 0]);


  const createReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      return apiRequest('POST', `/api/tasks/${taskId}/review`, data);
    },
    onSuccess: () => {
      setShowReviewModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "review"] });
      toast({
        title: "Reseña enviada",
        description: "Tu reseña será publicada cuando termine el período de garantía (7 días).",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo enviar la reseña.", variant: "destructive" });
    },
  });

  const updateReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      return apiRequest('PUT', `/api/tasks/${taskId}/review`, data);
    },
    onSuccess: () => {
      setShowReviewModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "review"] });
      toast({
        title: "Reseña actualizada",
        description: "Tu reseña ha sido actualizada correctamente.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la reseña.", variant: "destructive" });
    },
  });

  const handleSubmitReview = () => {
    if (reviewRating < 1) {
      toast({ title: "Error", description: "Selecciona una calificación.", variant: "destructive" });
      return;
    }
    if (existingReview) {
      updateReviewMutation.mutate({ rating: reviewRating, comment: reviewComment });
    } else {
      createReviewMutation.mutate({ rating: reviewRating, comment: reviewComment });
    }
  };

  const openEditReview = () => {
    if (existingReview) {
      setReviewRating(existingReview.rating);
      setReviewComment(existingReview.comment || '');
    }
    setShowReviewModal(true);
  };

  const handleFileDownload = useCallback(async (msg: Message, filename: string) => {
    // Nombre con el que se subio el archivo; sin el, downloadFile lo deduce del tipo.
    downloadFile(filename, msg.attachmentNames?.[msg.attachments?.indexOf(filename) ?? -1]);

    if (!msg.fileDownloadedAt && msg.senderId !== (currentUser as any)?.id) {
      try {
        const resp = await fetch(`/api/chat/messages/${msg.id}/downloaded`, { method: 'POST' });
        if (resp.ok) {
          queryClient.setQueryData(
            messagesQueryKey,
            (old: Message[] | undefined) => (old || []).map(m =>
              m.id === msg.id ? { ...m, fileDownloadedAt: new Date().toISOString(), fileDownloadedBy: (currentUser as any)?.id } : m
            )
          );
        }
      } catch (err) {
        console.error('Failed to track download:', err);
      }
    }
  }, [currentUser, messagesQueryKey]);

  const handlePayment = () => {
    
    if (!paymentMethod || paymentMethod === "") {
      toast({
        title: "Error",
        description: "Por favor selecciona un método de pago",
        variant: "destructive",
      });
      return;
    }
    
    if (!receiptFile) {
      toast({
        title: "Error", 
        description: "Por favor sube tu comprobante de pago",
        variant: "destructive",
      });
      return;
    }

    // Get the account type from the selected account
    const selectedAccount = bankAccounts?.find((acc: any) => acc.id === paymentMethod);
    const actualPaymentMethod = selectedAccount?.accountType || paymentMethod;
    
    paymentMutation.mutate({ paymentMethod: actualPaymentMethod, receiptFile, tempId: `temp-${Date.now()}` });
  };

  const isTutorViewer = (currentUser as any)?.userType === 'tutor';

  const handleSendQuote = () => {
    if (!newQuoteAmount.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un monto",
        variant: "destructive",
      });
      return;
    }
    
    const currencyCode = taskInfo?.currency || 'PEN';
    const quoteMessage = `💰 Nueva cotización: ${newQuoteAmount} ${currencyCode}`;
    const targetTaskId = quoteActionTaskId || taskId;

    // Optimistic: mismo patron que handleSendMessage — sin esto, la
    // tarjeta de cotizacion tardaba en aparecer hasta que volvia la
    // respuesta del servidor (bug reportado).
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      taskId: targetTaskId,
      senderId: (currentUser as any)?.id || '',
      receiverId: userId,
      message: quoteMessage,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      senderName: (currentUser as any)?.name || 'Yo',
      status: 'sending',
    };
    queryClient.setQueryData(
      messagesQueryKey,
      (old: Message[] | undefined) => [...(old || []), optimisticMessage]
    );
    userScrolledUpRef.current = false;
    scrollToBottom(true);

    sendMessageMutation.mutate({
      message: quoteMessage,
      files: undefined,
      targetTaskId,
      tempId
    });

    // Mantiene candidates.proposedPrice al dia — antes solo quedaba en el
    // texto del chat y la lista de candidatos del alumno seguia mostrando
    // el precio original de la postulacion.
    const tutorIdForPrice = (currentUser as any)?.id;
    if (tutorIdForPrice) {
      fetch(`/api/candidates/${targetTaskId}/${tutorIdForPrice}/price`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: newQuoteAmount }),
      }).catch((err) => console.error('[QUOTE_PRICE_SYNC] Error:', err));
    }

    setShowQuoteModal(false);
    setNewQuoteAmount('');
    setQuoteActionTaskId(null);
  };

  // Reportar / bloquear a la otra persona (menu del header). El reporte lleva el id real, no el alias del tutor.
  const headerName = (currentUser as any)?.userType === 'tutor' ? generateStudentAlias(userId) : (otherUserInfo?.name || userName);
  const safety = useChatSafety({ otherUserId: userId, otherUserName: headerName, taskId: taskId || undefined });

  if (showSpinner) {
    return (
      <div className={embedded ? "h-full bg-white flex items-center justify-center" : "h-dvh bg-white flex items-center justify-center"}>
        <Spinner size="lg" className="text-green-600" />
      </div>
    );
  }

  if (embedded && showProfileInline && tutorProfileData) {
    return (
      <div className="h-full w-full overflow-y-auto bg-white scrollbar-none" data-testid="chat-inline-profile">
        <ListScreen>
          <BackButton onClick={() => setShowProfileInline(false)} className="-ml-2.5" />
          <TutorProfileContent
            key={tutorProfileData.id}
            tutorKey={tutorProfileData.slug ?? tutorProfileData.id}
            showChatAction={false}
            flush
          />
        </ListScreen>
      </div>
    );
  }

  return (
    <div
      className={embedded ? "h-full w-full bg-white flex flex-col" : "h-dvh w-full bg-white flex justify-center"}
      style={!embedded && keyboardViewportHeight ? { height: keyboardViewportHeight } : undefined}
    >
    <div
      className={`relative ${embedded ? "flex-1 flex flex-col w-full min-h-0" : "page-slide-in h-dvh bg-white flex flex-col w-full max-w-content"}`}
      style={!embedded && keyboardViewportHeight ? { height: keyboardViewportHeight } : undefined}
      onDragOver={handleChatDragOver}
      onDragLeave={handleChatDragLeave}
      onDrop={handleChatDrop}
    >
      {isDraggingFile && (
        <div className="absolute inset-0 z-overlay bg-green-50 border-4 border-dashed border-green-600 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-6 py-4 flex items-center gap-3">
            <Upload className="size-icon-lg text-green-600" />
            <span className="text-body font-medium text-gray-900">Suelta el archivo para adjuntarlo</span>
          </div>
        </div>
      )}
      <ChatHeader
        displayName={headerName}
        avatar={otherUserInfo?.avatar}
        userId={userId}
        lastSeen={otherUserInfo?.lastSeen}
        isOnline={isOtherUserOnline}
        typing={otherTyping}
        embedded={embedded}
        onBack={() => {
          if (fromSection === TAB.messages) {
            setLocation(ROUTES.messages);
            return;
          }
          const baseUrl = fromSection === TAB.orders ? ROUTES.orders : ROUTES.root;
          const returnUrl = returnTaskId ? `${fromSection === TAB.orders ? ROUTES.orders : ROUTES.home}/${returnTaskId}` : baseUrl;
          setLocation(returnUrl);
        }}
        onOpenProfile={canOpenProfile ? handleOpenProfile : undefined}
        onViewProfile={canOpenProfile ? handleOpenProfile : undefined}
        onReport={userId && userId !== (currentUser as any)?.id ? safety.openReport : undefined}
        onBlockToggle={userId && userId !== (currentUser as any)?.id ? safety.openBlock : undefined}
        isBlocked={safety.isBlocked}
      />

      {/* Barra de cotizacion activa: fija debajo del header (fuera del
          contenedor con scroll de mensajes) para que no se pierda al
          desplazarse por el historial. Pedido especifico + monto actual +
          accion de contratar.
          taskInfo (linea ~573) usa staleTime:0/gcTime:0 a proposito (precisa
          expiracion siempre fresca) — se refetchea en CADA mount, asi que
          `taskInfo` es `undefined` un instante en cada apertura del chat.
          Antes esta barra directamente no existia en el DOM durante ese
          instante y aparecia de golpe una vez resuelto el fetch, empujando
          los mensajes hacia abajo (layout shift / parpadeo reportado). El
          esqueleto de abajo reserva el mismo alto mientras `taskId` existe
          pero `taskInfo` todavia no resuelve, para que solo cambie el
          CONTENIDO de la barra, nunca si ocupa espacio o no. Unica excepcion
          real: si el pedido resulta CANCELLED/expirado (`chatState.isReadonly`
          pasa a true recien con `taskInfo` ya cargado), la barra colapsa —
          caso minoritario, aceptado. */}
      {taskId && isStudentUser && !chatState.isReadonly && !(paymentSent || existingPayment) && (
        taskInfo ? (
          // Con la propuesta en el chat, la barra flota y no ocupa alto: si reservara su espacio quedaria una franja
          // vacia mientras la tarjeta se ve, y colapsarla moveria los mensajes (y el observer entraria en bucle).
          // Sin esa tarjeta va en el flujo para no tapar los primeros mensajes.
          <div className={canHireAnchorTask && latestQuoteMessageId ? "pointer-events-none relative z-sticky h-0 px-4 pt-2" : "bg-gray-100 px-4 pt-2 pb-1"}>
            {/* Banner "inteligente": si la tarjeta inline de cotizacion
                vigente ya esta visible en el scroll (ver quoteCardRef +
                IntersectionObserver arriba), este banner se desvanece en
                vez de duplicar el mismo CTA "Contratar". Solo opacity (no
                colapsa alto) para no introducir layout-shift mientras se
                scrollea -- el mismo problema que el comentario de arriba
                ya documenta haber corregido para el caso del skeleton. */}
            <div
              className={`bg-white rounded-card px-4 py-2.5 flex items-center justify-between gap-3 transition-opacity duration-200 ${
                canHireAnchorTask && latestQuoteMessageId ? 'shadow-float' : ''
              } ${
                canHireAnchorTask && inlineQuoteCardVisible ? 'opacity-0' : 'pointer-events-auto opacity-100'
              }`}
            >
              <div className="min-w-0">
                <p className="text-caption text-gray-700 truncate">{taskInfo.title}</p>
                <p className="text-subheading font-bold text-gray-900">{formatPrice(currentPrice, taskInfo?.currency)}</p>
              </div>
              {canHireAnchorTask && (
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  className="shrink-0"
                  data-testid="button-contratar-bar"
                >
                  Contratar
                </Button>
              )}
            </div>
          </div>
        ) : null
      )}

      {/* Messages Container */}
      <ChatCanvas ref={setMessagesContainer} className={embedded ? "pl-0 pr-6" : undefined} {...scrollIntentHandlers}>
        {/* Load older messages button */}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button variant="outline" size="sm" onClick={loadOlderMessages} disabled={loadingOlder}>
              {loadingOlder ? 'Cargando…' : '↑ Cargar mensajes anteriores'}
            </Button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-700">
            <MessageCircle className="size-icon-box text-gray-300 mb-3" />
            <div>Inicia la conversación</div>
          </div>
        ) : (
          <MessageList
            ref={messageListRef}
            messages={messages as Message[]}
            scrollElement={messagesScrollEl}
            contentRef={virtualContentRef}
            bubbleProps={{
              currentUserId: (currentUser as any)?.id || '',
              anchorTaskId: taskId,
              taskInfoTitle: taskInfo?.title,
              taskInfoDescription: taskInfo?.description,
              taskInfoCurrency: taskInfo?.currency,
              taskInfoDeadline: taskInfo?.deadline,
              canHireAnchorTask: canHireAnchorTask,
              latestQuoteMessageId: latestQuoteMessageId,
              isTutorViewer: isTutorViewer,
              onViewTask: setViewingQuoteTaskId,
              onOpenTaskDetail: setShowTaskDetailSheet,
              onNewQuoteTask: setQuoteActionTaskId,
              onOpenQuoteModal: setShowQuoteModal,
              onDeliveryTask: setDeliveryActionTaskId,
              onOpenMarkCompleted: setShowMarkCompletedModal,
              onHire: setShowPaymentModal,
              onFileDownload: handleFileDownload,
              onReply: setReplyingToMessage,
              quoteCardRef: quoteCardRef,
            }}
          />
        )}
        {/* Burbuja "escribiendo": complementa el texto de la cabecera, al final del historial. */}
        {otherTyping && messages.length > 0 && (
          <div className="pt-1">
            <TypingIndicator variant="bubble" />
          </div>
        )}
      </ChatCanvas>

      <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />

      {/* File Preview */}
      {showFilePreview && selectedFiles.length > 0 && (
        <div className="bg-white px-4 pb-3 pt-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-caption font-semibold text-gray-700">
              Archivos seleccionados ({selectedFiles.length})
            </span>
            <ChatIconButton
              aria-label="Quitar todos los archivos"
              onClick={() => {
                setSelectedFiles([]);
                setShowFilePreview(false);
              }}
              className="-mr-2"
            >
              <X className="size-icon-md" />
            </ChatIconButton>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => {
              const previewUrl = selectedFilePreviewUrls[index];
              return previewUrl ? (
                <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="relative rounded-md overflow-hidden bg-white shadow-sm group">
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="block h-24 w-auto max-w-name-lg object-contain cursor-pointer"
                    onClick={() => setPreviewImage(previewUrl)}
                  />
                  {/* Area tactil de 40px, circulo visible de 24px: no tapa la miniatura */}
                  <ChatIconButton
                    aria-label="Quitar archivo"
                    onClick={() => removeFile(index)}
                    className="absolute right-0 top-0 hover:bg-transparent"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-scrim/60 text-white transition-colors group-hover:bg-scrim/80">
                      <X className="size-icon-star" />
                    </span>
                  </ChatIconButton>
                </div>
              ) : (
                <SelectedFileChip key={`${file.name}-${file.size}-${file.lastModified}-${index}`} file={file} onRemove={() => removeFile(index)} />
              );
            })}
          </div>
        </div>
      )}

      {/* Input Area — modelo user-centric: el hilo es del par, no de un
          pedido puntual, asi que ningun estado de pedido (expirado, pago
          pendiente, asignado a otro, completado) bloquea el composer. Esas
          etiquetas de estado se muestran en la tarjeta de cotizacion, no
          aca. chatState/isTaskExpired se siguen calculando para el boton
          "Contratar" y para esa futura tarjeta, solo dejan de usarse para
          tapar el area de escritura. */}
      {(
        /* Normal Input Area - MilTareas Design System */
        <div className="bg-white shadow-sm">
          {replyingToMessage && (
            <div className="px-3 pt-3">
              <ReplyQuote
                replyTo={toReplyPreview(replyingToMessage)}
                meId={(currentUser as any)?.id || ''}
                onCancel={() => setReplyingToMessage(null)}
              />
            </div>
          )}
          {/* Bento inline de "Califica al tutor" — reemplaza el Dialog
              bloqueante de antes (backdrop tapando el chat). El estudiante
              lo abre/cierra cuando quiere via los links de abajo; nunca se
              auto-abre. */}
          {isStudentUser && taskIsCompleted && isChattingWithAssignedTutor && !reviewLoading && showReviewModal && (
            <div className="bg-card rounded-lg border border-border p-card-pad m-3 space-y-4">
              <div>
                <p className="text-body font-semibold text-gray-900">
                  {existingReview ? 'Editar reseña' : 'Califica al tutor'}
                </p>
                <p className="text-body font-medium text-gray-900 line-clamp-2 mt-2">
                  {(taskInfo as any)?.title || taskTitle}
                </p>
                <p className="text-body text-gray-700 mt-1">
                  {existingReview
                    ? 'Puedes modificar tu reseña mientras dure el período de garantía.'
                    : 'Tu opinión ayuda a otros estudiantes. La reseña se publicará después del período de garantía (7 días).'}
                </p>
              </div>

              <StarRating value={reviewRating} onChange={setReviewRating} className="py-2" />
              <p className="text-center text-body text-gray-700">
                {reviewRating === 1 && 'Muy malo'}
                {reviewRating === 2 && 'Malo'}
                {reviewRating === 3 && 'Regular'}
                {reviewRating === 4 && 'Bueno'}
                {reviewRating === 5 && 'Excelente'}
              </p>

              <Textarea
                placeholder="Cuéntanos tu experiencia (opcional)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                className="resize-none"
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1"
                >
                  Ahora no
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={reviewRating < 1 || createReviewMutation.isPending || updateReviewMutation.isPending}
                  className="flex-1"
                >
                  {(createReviewMutation.isPending || updateReviewMutation.isPending) ? 'Enviando…' : (existingReview ? 'Actualizar' : 'Enviar reseña')}
                </Button>
              </div>
            </div>
          )}
          {!showReviewModal && (
            <>
              {/* Edit review banner for students during grace period */}
              {isStudentUser && taskIsCompleted && isChattingWithAssignedTutor && existingReview && !existingReview.published && (
                (() => {
                  const graceEnd = (existingReview as any).gracePeriodEnd;
                  const stillInGrace = graceEnd ? new Date() < new Date(graceEnd) : true;
                  return stillInGrace ? (
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-100">
                      <span className="text-caption text-gray-700">
                        Tu reseña ({existingReview.rating} {pluralizeEs(existingReview.rating, "estrella")}) se publicará al terminar la garantía
                      </span>
                      <button
                        onClick={openEditReview}
                        className="min-h-10 text-caption text-green-600 font-medium hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-2"
                      >
                        Editar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center px-4 py-2 bg-gray-100">
                      <span className="text-caption text-gray-700">
                        Tu reseña ({existingReview.rating} {pluralizeEs(existingReview.rating, "estrella")}) será publicada pronto
                      </span>
                    </div>
                  );
                })()
              )}
              {/* Review prompt for students who haven't reviewed yet */}
              {isStudentUser && taskIsCompleted && isChattingWithAssignedTutor && !existingReview && !reviewLoading && (
                <div className="flex items-center justify-center px-4 py-2 bg-gray-100">
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="min-h-10 text-caption text-green-600 font-medium hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-2"
                  >
                    Calificar al tutor
                  </button>
                </div>
              )}
            </>
          )}
          <div className={`py-3 ${embedded ? "pr-6" : "px-4 pb-safe-min"}`}>
          {otherUserInactive ? (
            <div className="rounded-xl bg-gray-100 px-4 py-3 text-center text-body text-gray-700" data-testid="chat-user-inactive">
              {isStudentUser ? "Tutor inactivo" : "Usuario inactivo"}. Tu chat se conserva, pero no puedes escribirle por ahora.
            </div>
          ) : (
          <MessageComposer
            inputRef={messageInputRef}
            value={message}
            onChange={(v) => {
              setMessage(v);
              if (v) notifyTyping(); else stopMyTyping();
            }}
            onSend={handleSendMessage}
            onAttach={trigger => { setFileMenuAnchor(trigger); setShowFileMenu(true); }}
            hasFiles={selectedFiles.length > 0}
            sending={sendMessageMutation.isPending}
          />
          )}

          </div>
        </div>
      )}

      {/* Origen de los archivos (camara / galeria / archivos): mismo dialogo que Publicar */}
      {safety.dialogs}

      <FileSourceDialog open={showFileMenu} onOpenChange={setShowFileMenu} anchor={fileMenuAnchor} onPick={handlePickSource} />

      {/* Payment Modal (Contratar Tutor) */}
      <HireModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        tutorName={tutorInfo?.name || userName}
        tutorAvatar={tutorInfo?.avatar}
        taskTitle={taskInfo?.title || taskTitle}
        price={formatPrice(currentPrice || '0', taskInfo?.currency)}
        bankAccounts={bankAccounts || []}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        receiptFile={receiptFile}
        onReceiptChange={setReceiptFile}
        onSubmit={handlePayment}
        isSubmitting={paymentMutation.isPending}
      />

      {/* Quote Modal */}
      <Dialog open={showQuoteModal} onOpenChange={(open) => { setShowQuoteModal(open); if (!open) setNewQuoteAmount(''); }}>
        <DialogContent className="">
          <DialogHeader>
            <DialogTitle>Nueva Cotización</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <OutlinedControl htmlFor="quote-amount" label={<>Nuevo precio ({taskInfo?.currency || 'PEN'})</>}>
                <Input
                  id="quote-amount"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="Ej: 150.00"
                  value={newQuoteAmount}
                  onChange={(e) => setNewQuoteAmount(e.target.value)}
                />
              </OutlinedControl>
              <p className="text-caption text-gray-700 mt-1">
                Ingresa tu nueva cotización para este pedido
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowQuoteModal(false);
                  setNewQuoteAmount('');
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendQuote}
                disabled={!newQuoteAmount.trim() || sendMessageMutation.isPending}
                className="flex-1"
              >
                {sendMessageMutation.isPending ? 'Enviando…' : 'Enviar Cotización'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TaskQuickViewDialog
        task={showTaskDetailSheet ? detailSheetTask : null}
        onClose={() => setShowTaskDetailSheet(false)}
        currentUserCountry={(currentUser as any)?.country}
        showUsdEquivalent={isTutorViewer}
      />

      {/* Entregar pedido Modal */}
      <Dialog open={showMarkCompletedModal} onOpenChange={(open) => { setShowMarkCompletedModal(open); if (!open) setDeliveryActionTaskId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entregar pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-body text-gray-700">
              ¿Estás seguro de que quieres entregar este pedido como finalizado?
              El estudiante tendrá 7 días para revisar el trabajo.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMarkCompletedModal(false);
                  setDeliveryActionTaskId(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => markCompletedMutation.mutate(deliveryActionTaskId || taskId)}
                disabled={markCompletedMutation.isPending}
                className="flex-1"
              >
                {markCompletedMutation.isPending ? 'Procesando…' : 'Entregar pedido'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </div>
  );
}
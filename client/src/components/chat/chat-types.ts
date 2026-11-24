import type { ReplyPreview } from "@shared/chat-preview";

/**
 * Mensaje del chat tal como lo consume la UI (lista virtualizada y burbujas).
 * Combina la fila de `chat_messages` con campos que solo existen en el cliente
 * (`status` del envio optimista) o que el servidor embebe (`replyTo`).
 */
export interface Message {
  id: string;
  taskId: string | null;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: string;
  createdAt: string;
  senderName: string;
  attachments?: string[];
  attachmentNames?: string[] | null;
  attachmentSizes?: number[] | null;
  /** Dimensiones en px de cada adjunto (null si no es imagen o se desconoce). */
  attachmentDims?: Array<{ w: number; h: number } | null> | null;
  replyToId?: string | null;
  /** Cita del mensaje al que responde (viene embebida desde el servidor). */
  replyTo?: ReplyPreview | null;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  readAt?: string;
  deliveredAt?: string;
  fileDownloadedAt?: string;
  fileDownloadedBy?: string;
  /** Moderacion de contacto privado: 'masked' (telefono/enlace censurado al enviar) o 'hidden' (oculto por el admin). */
  moderationStatus?: 'masked' | 'hidden' | null;
}

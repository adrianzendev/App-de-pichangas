import webpush from 'web-push';
import { GoogleAuth } from 'google-auth-library';
import { storage } from './storage';
import { MAIN_ADMIN_EMAIL } from '@shared/admin';
import { sideEffectsEnabled } from './side-effects';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = `mailto:${MAIN_ADMIN_EMAIL}`;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[Push] VAPID keys configured successfully');
} else {
  console.warn('[Push] VAPID keys not configured - push notifications disabled');
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    taskId?: string;
    senderId?: string;
    type?: 'message' | 'task' | 'payment' | 'system';
  };
  actions?: { action: string; title: string }[];
  requireInteraction?: boolean;
}

export type PushResult = { success: number; failed: number };

// --- Push nativo (FCM HTTP v1; en iOS FCM entrega por APNs) ---------------------------------------------------
// Inerte mientras FIREBASE_SERVICE_ACCOUNT_JSON no este configurada: asi la web sigue igual sin la app nativa.
interface FcmClient { auth: GoogleAuth; endpoint: string }
let fcmClient: FcmClient | null | undefined; // undefined = aun sin evaluar

function getFcmClient(): FcmClient | null {
  if (fcmClient !== undefined) return fcmClient;
  fcmClient = null;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn('[Push] FIREBASE_SERVICE_ACCOUNT_JSON not configured - native push disabled');
    return null;
  }
  try {
    const credentials = JSON.parse(raw);
    if (!credentials.project_id) throw new Error('missing project_id');
    fcmClient = {
      auth: new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] }),
      endpoint: `https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`,
    };
    console.log('[Push] FCM configured successfully');
  } catch (error: any) {
    console.error('[Push] FIREBASE_SERVICE_ACCOUNT_JSON is invalid - native push disabled:', error.message);
  }
  return fcmClient;
}

// Se evalua al importar el modulo (igual que VAPID): el estado de FCM queda en el log de arranque y un JSON invalido
// se detecta al iniciar el servidor, no al enviar la primera notificacion.
getFcmClient();

// FCM exige que todos los valores de `data` sean cadenas.
function toFcmData(payload: PushNotificationPayload): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    if (value !== undefined && value !== null) data[key] = String(value);
  }
  if (payload.tag) data.tag = payload.tag;
  return data;
}

// Token que FCM ya no reconoce (app desinstalada, token rotado): se borra para no reintentar para siempre.
function isDeadFcmToken(status: number, body: any): boolean {
  const error = body?.error;
  if (status === 404 || error?.status === 'NOT_FOUND') return true;
  const codes: string[] = (error?.details ?? []).map((d: any) => d?.errorCode);
  if (codes.includes('UNREGISTERED')) return true;
  return error?.status === 'INVALID_ARGUMENT' && /registration token|message.token/i.test(error?.message ?? '');
}

export async function sendNativePush(userId: string, payload: PushNotificationPayload): Promise<PushResult> {
  if (!sideEffectsEnabled) return { success: 0, failed: 0 };
  const client = getFcmClient();
  if (!client) return { success: 0, failed: 0 };

  const tokens = await storage.getNativePushTokens(userId);
  if (tokens.length === 0) return { success: 0, failed: 0 };

  let accessToken: string | null | undefined;
  try {
    accessToken = await client.auth.getAccessToken();
  } catch (error: any) {
    console.error('[Push] Could not get FCM access token:', error.message);
    return { success: 0, failed: tokens.length };
  }
  let success = 0;
  let failed = 0;

  for (const { token } of tokens) {
    try {
      const response = await fetch(client.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          message: {
            token,
            notification: { title: payload.title, body: payload.body },
            data: toFcmData(payload),
            android: { priority: 'HIGH', notification: payload.tag ? { tag: payload.tag } : {} },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      });
      if (response.ok) {
        success++;
        continue;
      }
      failed++;
      const body = await response.json().catch(() => null);
      console.error(`[Push] FCM rejected notification (${response.status}):`, body?.error?.message);
      if (isDeadFcmToken(response.status, body)) {
        console.log(`[Push] Removing invalid native token for user ${userId}`);
        await storage.deleteNativePushTokenByValue(token);
      }
    } catch (error: any) {
      failed++;
      console.error('[Push] Failed to send native notification:', error.message);
    }
  }

  return { success, failed };
}

// Despacha a todos los canales del usuario (navegador y app nativa). Un canal que falla no tumba al otro.
export async function sendPushNotification(userId: string, payload: PushNotificationPayload): Promise<PushResult> {
  const results = await Promise.allSettled([sendWebPush(userId, payload), sendNativePush(userId, payload)]);
  const total: PushResult = { success: 0, failed: 0 };
  for (const result of results) {
    if (result.status === 'fulfilled') {
      total.success += result.value.success;
      total.failed += result.value.failed;
    } else {
      console.error('[Push] Channel failed:', result.reason?.message ?? result.reason);
    }
  }
  return total;
}

export async function sendWebPush(
  userId: string,
  payload: PushNotificationPayload
): Promise<PushResult> {
  if (!sideEffectsEnabled) return { success: 0, failed: 0 };
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] Cannot send notification - VAPID keys not configured');
    return { success: 0, failed: 0 };
  }

  const subscriptions = await storage.getPushSubscriptions(userId);
  
  if (subscriptions.length === 0) {
    console.log(`[Push] No subscriptions found for user ${userId}`);
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/badge-72.png',
    tag: payload.tag || `notification-${Date.now()}`,
    data: payload.data || {},
    actions: payload.actions || [],
    requireInteraction: payload.requireInteraction || false,
  });

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        notificationPayload
      );
      success++;
      console.log(`[Push] Notification sent to ${subscription.endpoint.substring(0, 50)}...`);
    } catch (error: any) {
      failed++;
      console.error(`[Push] Failed to send notification:`, error.message);
      
      // If subscription is no longer valid, delete it
      if (error.statusCode === 404 || error.statusCode === 410) {
        console.log(`[Push] Removing invalid subscription for user ${userId}`);
        await storage.deletePushSubscription(userId, subscription.endpoint);
      }
    }
  }

  return { success, failed };
}

export async function sendNewMessageNotification(
  recipientId: string,
  senderName: string,
  messagePreview: string,
  taskId: string,
  senderId: string
): Promise<void> {
  const payload: PushNotificationPayload = {
    title: `Nuevo mensaje de ${senderName}`,
    body: messagePreview.length > 100 ? messagePreview.substring(0, 97) + '...' : messagePreview,
    tag: `message-${taskId}-${senderId}`,
    data: {
      url: '/messages',
      taskId,
      senderId,
      type: 'message',
    },
    actions: [
      { action: 'reply', title: 'Responder' },
      { action: 'view', title: 'Ver' },
    ],
  };

  await sendPushNotification(recipientId, payload);
}

export async function sendTaskApplicationNotification(
  studentId: string,
  tutorName: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  const payload: PushNotificationPayload = {
    title: 'Nueva aplicación a tu pedido',
    body: `${tutorName} quiere ayudarte con "${taskTitle}"`,
    tag: `application-${taskId}`,
    data: {
      url: `/orders/${taskId}`,
      taskId,
      type: 'task',
    },
    actions: [
      { action: 'view', title: 'Ver candidatos' },
    ],
  };

  await sendPushNotification(studentId, payload);
}

export async function sendPaymentConfirmationNotification(
  tutorId: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  const payload: PushNotificationPayload = {
    title: 'Pago confirmado',
    body: `Tu pago por "${taskTitle}" ha sido verificado`,
    tag: `payment-${taskId}`,
    data: {
      url: `/orders/${taskId}`,
      taskId,
      type: 'payment',
    },
  };

  await sendPushNotification(tutorId, payload);
}

export async function sendNewUserNotification(
  userName: string,
  userEmail: string,
  userType: string,
  country?: string | null
): Promise<void> {
  const ADMIN_USER_ID = 'admin-001';
  const roleLabel = userType === 'tutor' ? 'tutor' : 'alumno';
  const countryText = country ? ` · ${country}` : '';
  const payload: PushNotificationPayload = {
    title: `🎉 Nuevo ${roleLabel} registrado`,
    body: `${userName} (${userEmail})${countryText} se unió a MilTareas`,
    tag: `new-user-${Date.now()}`,
    requireInteraction: false,
    data: {
      url: '/dashboard',
      type: 'system',
    },
    actions: [
      { action: 'view', title: 'Ver en panel' },
    ],
  };

  await sendPushNotification(ADMIN_USER_ID, payload);
}

export async function sendNewPedidoNotification(
  studentName: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  const ADMIN_USER_ID = 'admin-001';
  const payload: PushNotificationPayload = {
    title: '📋 Nuevo pedido publicado',
    body: `${studentName} publicó: "${taskTitle}"`,
    tag: `new-pedido-${taskId}`,
    requireInteraction: true,
    data: {
      url: '/dashboard',
      taskId,
      type: 'task',
    },
    actions: [
      { action: 'view', title: 'Ver pedido' },
    ],
  };

  await sendPushNotification(ADMIN_USER_ID, payload);
}

export function getVapidPublicKey(): string | undefined {
  return VAPID_PUBLIC_KEY;
}

// Aviso de vencimiento (worker en routes.ts). El pedido ya fue marcado por
// storage.claimDueDeadlineReminders(), asi que aqui solo se notifica.
// active -> el alumno (aun sin tutor); in_progress -> tutor asignado y alumno.
export async function sendDeadlineReminders(): Promise<number> {
  const due = await storage.claimDueDeadlineReminders();
  for (const t of due) {
    const hours = Math.max(1, Math.round((t.deadline.getTime() - Date.now()) / 3_600_000));
    const when = hours >= 24 ? 'en menos de 24 horas' : `en unas ${hours} h`;
    const payload = (body: string): PushNotificationPayload => ({
      title: 'Tu pedido está por vencer',
      body,
      tag: `deadline-${t.id}`,
      data: { url: '/orders', taskId: t.id, type: 'task' },
    });
    const sends = [sendPushNotification(t.userId, payload(`"${t.title}" vence ${when}`))];
    if (t.status === 'in_progress' && t.assignedTutorId) {
      sends.push(sendPushNotification(t.assignedTutorId, payload(`Debes entregar "${t.title}" ${when}`)));
    }
    await Promise.allSettled(sends);
  }
  return due.length;
}

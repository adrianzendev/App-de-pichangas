import { Resend } from 'resend';
import { sideEffectsEnabled } from './side-effects';

const BASE_URL = 'https://app.miltareas.com';
const FROM = 'MilTareas <noreply@miltareas.com>';

// Tokens resueltos del sistema de diseño (client/src/index.css) — email no
// lee var(--...), hay que hardcodear el valor final.
const PRIMARY_600 = '#397F5B';   // --primary-600 (green-600): fondo del boton, texto blanco >=4.5:1
const TEXT = '#1C1C1C';         // --gray-900 / --card-foreground
const TEXT_MUTED = '#666666';   // --gray-700 / --muted-foreground
const BORDER = '#EDEDED';       // --gray-200 / --border
const CANVAS = '#F5F5F5';       // --gray-100 / --color-background
const GREEN_100 = '#E2F3E7';    // --green-100: fin del degradado del banner
const FONT_BODY = `'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
const FONT_DISPLAY = FONT_BODY;
// En dev, apuntar al propio dev server — BASE_URL (prod) todavia no tiene
// los archivos hasta el proximo deploy, rompe el logo en /dev/email-preview.
const ASSET_BASE = process.env.NODE_ENV === 'production'
  ? BASE_URL
  : `http://localhost:${process.env.PORT || '5000'}`;
const LOGO_URL = `${ASSET_BASE}/logo-email.png`;
const BANNER_URL = `${ASSET_BASE}/email-banner.png`;

// Mismo look que el login (banner + hoja blanca que sube sobre el): ver CLAUDE.md "Banner + hoja".
function BaseEmailLayout(title: string, body: string, buttonLabel: string, buttonUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${CANVAS};font-family:${FONT_BODY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${GREEN_100};border-radius:24px;overflow:hidden;">
        <!-- Banner: degradado white -> green-100, logo arriba -->
        <tr>
          <td style="background-color:${GREEN_100};background-image:linear-gradient(180deg,#ffffff 0%,${GREEN_100} 100%);padding:16px 24px 0;">
            <a href="${BASE_URL}"><img src="${LOGO_URL}" alt="MilTareas" width="115" style="display:block;border:0;height:auto;margin:0;"></a>
            <img src="${BANNER_URL}" alt="Tutores de MilTareas" width="300" style="display:block;border:0;width:100%;max-width:300px;height:auto;margin:-37px auto 0;">
          </td>
        </tr>
        <!-- Hoja blanca que sube sobre el banner -->
        <tr>
          <td style="background:${GREEN_100};padding:0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px 24px 0 0;">
              <tr>
                <td style="padding:28px 24px 8px;">
                  <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;font-weight:700;font-family:${FONT_DISPLAY};color:${TEXT};">${title}</h1>
                  <p style="margin:0;font-size:16px;line-height:1.6;color:${TEXT_MUTED};">${body}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <a href="${buttonUrl}"
                     style="display:block;text-align:center;background:${PRIMARY_600};color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 24px;border-radius:24px;">
                    ${buttonLabel}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;border-top:1px solid ${BORDER};">
                  <p style="margin:0;font-size:12px;line-height:1.5;color:${TEXT_MUTED};">
                    Este correo fue enviado automáticamente por MilTareas. Por favor no respondas a este mensaje.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!sideEffectsEnabled) {
    console.log('[EMAIL] side effects off (not production) — skipping email to', to);
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EMAIL] RESEND_API_KEY not set — skipping email to', to);
    return;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ── 1. Nueva tarea disponible → array de emails de tutores relevantes ─────────
export async function sendNewTaskEmail(
  tutorEmails: string[],
  taskTitle: string,
  studyArea: string | null | undefined,
  taskId: string
): Promise<void> {
  if (tutorEmails.length === 0) return;
  const subject = `¡Hay una nueva tarea${studyArea ? ` de ${studyArea}` : ''} disponible!`;
  const html = BaseEmailLayout(
    '¡Nueva tarea disponible!',
    `Se publicó una nueva tarea: <strong>${taskTitle}</strong>${studyArea ? ` (${studyArea})` : ''}. Entra a MilTareas para ver los detalles y postularte.`,
    'Ver tarea',
    `${BASE_URL}/home/${taskId}`
  );
  await Promise.all(tutorEmails.map(to => sendEmail(to, subject, html)));
}

// ── 2. Nuevo postulante → alumno ──────────────────────────────────────────────
export async function sendNewApplicantEmail(
  to: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  const subject = '¡Tienes un nuevo postulante en tu tarea!';
  const html = BaseEmailLayout(
    '¡Tienes un nuevo postulante!',
    `Un tutor envió una propuesta para tu tarea <strong>${taskTitle}</strong>. Entra a MilTareas para ver su perfil y precio.`,
    'Ver postulante',
    `${BASE_URL}/orders/${taskId}`
  );
  await sendEmail(to, subject, html);
}

// ── 3. Nuevo mensaje → destinatario (sirve para ambas direcciones) ────────────
export async function sendNewMessageEmail(
  to: string,
  recipientName: string,
  senderName: string,
  taskTitle: string,
  taskId: string,
  receiverType: 'student' | 'tutor'
): Promise<void> {
  const chatUrl = receiverType === 'tutor'
    ? `${BASE_URL}/home/${taskId}`
    : `${BASE_URL}/orders/${taskId}`;
  const subject = 'Tienes un nuevo mensaje en Mil Tareas';
  const html = BaseEmailLayout(
    `Hola ${recipientName}, tienes un mensaje nuevo`,
    `<strong>${senderName}</strong> te escribió en la tarea <strong>${taskTitle}</strong>. Entra para leer y responder.`,
    'Ver mensaje',
    chatUrl
  );
  await sendEmail(to, subject, html);
}

// ── 4. Pago confirmado → tutor seleccionado ───────────────────────────────────
export async function sendPaymentApprovedTutor(
  to: string,
  tutorName: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  const subject = '¡Felicidades! Fuiste seleccionado y el pago fue confirmado, ya puedes empezar';
  const html = BaseEmailLayout(
    `¡Felicidades, ${tutorName}!`,
    `El pago para la tarea <strong>${taskTitle}</strong> fue verificado. Ya puedes iniciar el trabajo con el alumno.`,
    'Ver tarea',
    `${BASE_URL}/home/${taskId}`
  );
  await sendEmail(to, subject, html);
}

// ── 5. Pago confirmado → alumno ───────────────────────────────────────────────
export async function sendPaymentApprovedStudent(
  to: string,
  studentName: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  const subject = 'Tu pago fue confirmado, el tutor ya puede comenzar';
  const html = BaseEmailLayout(
    `¡Listo, ${studentName}!`,
    `Tu pago para la tarea <strong>${taskTitle}</strong> fue verificado. El tutor ya fue notificado y puede comenzar.`,
    'Ver tarea',
    `${BASE_URL}/orders/${taskId}`
  );
  await sendEmail(to, subject, html);
}

// ── 6. Nueva reseña → tutor ───────────────────────────────────────────────────
export async function sendNewReviewEmail(
  to: string,
  tutorName: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  const subject = 'El alumno te dejó una reseña';
  const html = BaseEmailLayout(
    `Nueva reseña para ti, ${tutorName}`,
    `El alumno calificó tu trabajo en la tarea <strong>${taskTitle}</strong>. Entra a MilTareas para ver la puntuación y comentario.`,
    'Ver reseña',
    `${BASE_URL}/home/${taskId}`
  );
  await sendEmail(to, subject, html);
}

// ── 0. Bienvenida → nuevo alumno ─────────────────────────────────────────────
export async function sendWelcomeStudentEmail(
  to: string,
  name: string
): Promise<void> {
  const subject = `¡Bienvenido a MilTareas, ${name}!`;
  const html = BaseEmailLayout(
    `¡Hola ${name}, ya eres parte de MilTareas!`,
    `Publica tu primera tarea y recibe propuestas de tutores en minutos.`,
    'Publicar mi primera tarea',
    BASE_URL
  );
  await sendEmail(to, subject, html);
}

// ── Definir o restablecer contrasena (enlace de activacion de un solo uso) ───────────────────────────────────
// `kind`: "new" = cuenta creada por el administrador; "reset" = la persona pidio definir/restablecer su contrasena.
// El token va en la URL (nunca se guarda en claro: la base solo tiene su SHA-256) y vence a las 24 h.
export async function sendActivationEmail(to: string, name: string, token: string, kind: 'new' | 'reset'): Promise<void> {
  const link = `${ASSET_BASE}/activate-account?token=${token}`;
  const isNew = kind === 'new';
  const subject = isNew ? 'Activa tu cuenta de MilTareas' : 'Restablece tu contraseña de MilTareas';
  const html = BaseEmailLayout(
    isNew ? `Hola ${name}, activa tu cuenta` : `Hola ${name}, restablece tu contraseña`,
    (isNew
      ? 'Se creó una cuenta para ti en MilTareas. Elige tu propia contraseña para entrar.'
      : 'Recibimos una solicitud para restablecer la contraseña de tu cuenta.') +
      ' El enlace sirve una sola vez y vence en 24 horas. Si no lo pediste, ignora este correo: tu cuenta sigue igual.',
    isNew ? 'Activar mi cuenta' : 'Restablecer mi contraseña',
    link
  );
  await sendEmail(to, subject, html);
}

// ── 7. Pedir reseña → alumno (cuando tutor marca completada) ─────────────────
export async function sendRequestReviewEmail(
  to: string,
  studentName: string,
  taskTitle: string,
  taskId: string
): Promise<void> {
  const subject = '¿Cómo te fue? Califica a tu tutor';
  const html = BaseEmailLayout(
    `¿Cómo fue tu experiencia, ${studentName}?`,
    `El tutor marcó como completada la tarea <strong>${taskTitle}</strong>. Tu opinión ayuda a otros alumnos a elegir bien. ¡Toma solo un momento!`,
    'Dejar reseña',
    `${BASE_URL}/orders/${taskId}`
  );
  await sendEmail(to, subject, html);
}

// ── Preview dev-only (server/routes.ts monta /dev/email-preview) ─────────────
// Mismo copy que cada sendXEmail de arriba, con datos de ejemplo — no envia
// nada, solo devuelve el HTML para revisar el diseño en el navegador.
const DEMO_TASK = 'Ensayo de Historia Universal';
const DEMO_TASK_ID = 'demo-task-id';

export const EMAIL_PREVIEWS: Record<string, { label: string; html: () => string }> = {
  welcome: {
    label: 'Bienvenida (alumno nuevo)',
    html: () => BaseEmailLayout(
      '¡Hola Juan, ya eres parte de MilTareas!',
      'Publica tu primera tarea y recibe propuestas de tutores en minutos.',
      'Publicar mi primera tarea',
      BASE_URL
    ),
  },
  'new-task': {
    label: 'Nueva tarea disponible (a tutores)',
    html: () => BaseEmailLayout(
      '¡Nueva tarea disponible!',
      `Se publicó una nueva tarea: <strong>${DEMO_TASK}</strong> (Historia). Entra a MilTareas para ver los detalles y postularte.`,
      'Ver tarea',
      `${BASE_URL}/home/${DEMO_TASK_ID}`
    ),
  },
  'new-applicant': {
    label: 'Nuevo postulante (a alumno)',
    html: () => BaseEmailLayout(
      '¡Tienes un nuevo postulante!',
      `Un tutor envió una propuesta para tu tarea <strong>${DEMO_TASK}</strong>. Entra a MilTareas para ver su perfil y precio.`,
      'Ver postulante',
      `${BASE_URL}/orders/${DEMO_TASK_ID}`
    ),
  },
  'new-message': {
    label: 'Nuevo mensaje de chat',
    html: () => BaseEmailLayout(
      'Hola María, tienes un mensaje nuevo',
      `<strong>Carlos</strong> te escribió en la tarea <strong>${DEMO_TASK}</strong>. Entra para leer y responder.`,
      'Ver mensaje',
      `${BASE_URL}/home/${DEMO_TASK_ID}`
    ),
  },
  'payment-tutor': {
    label: 'Pago confirmado (a tutor)',
    html: () => BaseEmailLayout(
      '¡Felicidades, Carlos!',
      `El pago para la tarea <strong>${DEMO_TASK}</strong> fue verificado. Ya puedes iniciar el trabajo con el alumno.`,
      'Ver tarea',
      `${BASE_URL}/home/${DEMO_TASK_ID}`
    ),
  },
  'payment-student': {
    label: 'Pago confirmado (a alumno)',
    html: () => BaseEmailLayout(
      '¡Listo, María!',
      `Tu pago para la tarea <strong>${DEMO_TASK}</strong> fue verificado. El tutor ya fue notificado y puede comenzar.`,
      'Ver tarea',
      `${BASE_URL}/orders/${DEMO_TASK_ID}`
    ),
  },
  'request-review': {
    label: 'Pedir reseña (a alumno)',
    html: () => BaseEmailLayout(
      '¿Cómo fue tu experiencia, María?',
      `El tutor marcó como completada la tarea <strong>${DEMO_TASK}</strong>. Tu opinión ayuda a otros alumnos a elegir bien. ¡Toma solo un momento!`,
      'Dejar reseña',
      `${BASE_URL}/orders/${DEMO_TASK_ID}`
    ),
  },
  'new-review': {
    label: 'Nueva reseña (a tutor)',
    html: () => BaseEmailLayout(
      'Nueva reseña para ti, Carlos',
      `El alumno calificó tu trabajo en la tarea <strong>${DEMO_TASK}</strong>. Entra a MilTareas para ver la puntuación y comentario.`,
      'Ver reseña',
      `${BASE_URL}/home/${DEMO_TASK_ID}`
    ),
  },
};

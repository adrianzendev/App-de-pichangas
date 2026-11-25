/**
 * Clases de la burbuja del chat: unica fuente para `MessageBubble` y para las vistas de solo
 * lectura que reproducen una conversacion (p. ej. "Ver mensajes" del admin).
 */

/** Superficie de la burbuja ajena: blanca con borde gris claro (outline), sobre el fondo blanco del chat. */
export const BUBBLE_OTHER_SURFACE = "bg-bubble-other border border-border";

/** Fondo + radio + colita (esquina superior, 2px) de la burbuja: propia gris a la derecha, ajena outline a la izquierda. */
export const bubbleToneClass = (isOwn: boolean): string =>
  isOwn ? "bg-bubble-own rounded-lg rounded-tr-xs" : `${BUBBLE_OTHER_SURFACE} rounded-lg rounded-tl-xs`;

/** Burbuja de texto completa (color y padding; sin sombra: el color de fondo ya la separa del canvas). */
export const bubbleTextClass = (isOwn: boolean): string =>
  `min-w-0 max-w-full text-gray-900 px-4 py-3 text-body break-words ${bubbleToneClass(isOwn)}`;

/** Mensaje de sistema / administracion centrado. */
export const SYSTEM_MESSAGE_CLASS = "bg-gray-200 text-gray-700 text-body px-4 py-2 rounded-xl max-w-bubble-system";

/** Hora (y checks) bajo o dentro de la burbuja. */
export const BUBBLE_TIME_CLASS = "text-caption text-gray-700";

/** Hora sobre una imagen (insignia oscura `overlay`): texto blanco. */
export const BUBBLE_TIME_OVERLAY_CLASS = "text-caption text-white font-medium";

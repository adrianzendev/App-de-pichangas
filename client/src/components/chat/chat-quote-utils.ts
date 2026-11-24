import { parseISO } from "date-fns";
import { fmtTime12 } from "@/lib/date-format";

export const formatChatTimestamp = (time: string | number | Date | null | undefined): string => {
  if (!time) return '';
  
  try {
    const date = typeof time === 'string' ? parseISO(time) : new Date(time);
    if (isNaN(date.getTime())) return '';
    
    return fmtTime12(date);
  } catch (error) {
    return '';
  }
};

// Detecta si un mensaje es una cotizacion (aplicacion o nueva cotizacion del
// tutor) y devuelve el precio. Se usa tanto para el memo de currentPrice
// como para renderizar la tarjeta de cotizacion dentro del mensaje.
export const QUOTE_PATTERNS = [
  /💰.*?(\d+(?:\.\d{2})?)\s*(?:PEN|MXN|COP|ARS|CLP|USD|EUR)/i,
  /💰\s*Nueva cotización:\s*S\/\.?(\d+(?:\.\d{2})?)/i,
  /💰\s*Mi cotización:\s*S\/\.?(\d+(?:\.\d{2})?)/i,
  /💰.*S\/\.?(\d+(?:\.\d{2})?)/i,
];

export const parseQuoteFromMessage = (message: string): string | null => {
  for (const pattern of QUOTE_PATTERNS) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Titulo de la propuesta: el nombre del pedido citado entre comillas en el
// mensaje de postulacion ("Hola! Me interesa ayudarte con "X"..."). El
// mensaje de "nueva cotizacion" no lo incluye — se resuelve con fallback
// (titulo del pedido ancla) en el punto de uso.
export const extractQuoteTitle = (message: string): string | null => {
  const match = message.match(/"([^"]+)"/);
  return match ? match[1] : null;
};

// Descripcion de la tarjeta: el mensaje del tutor sin la linea de precio ni
// el titulo entre comillas (ya se muestran aparte en la tarjeta).
export const stripQuoteFromMessage = (message: string, title: string | null): string => {
  let cleaned = message;
  for (const pattern of QUOTE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  if (title) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Se saca junto con el punto que le sigue (si hay), que quedaba huerfano
    // pegado al titulo citado ("...con "Titulo". Tengo..." -> "...con  Tengo...").
    cleaned = cleaned.replace(new RegExp(`"${escapedTitle}"\\.?`), '');
  }
  return cleaned.replace(/\s{2,}/g, ' ').trim();
};

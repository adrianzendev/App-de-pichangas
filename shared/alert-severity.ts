export type AlertSeverity = "high" | "medium";

// Enlaces que elevan una alerta de contacto privado a severidad alta. Las palabras sueltas ("instagram",
// "whatsapp") son ambiguas: severidad media, a revisar por el admin (ver shared/contact-filter.ts).
const LINK_TERMS = ["wa.me", "t.me", "instagram.com", "http", "www.", "enlace:"];

/**
 * Severidad de una alerta de contacto segun lo detectado. Solo se usa como respaldo para alertas antiguas: las
 * nuevas guardan `severity` al crearse (admin_alerts.severity). Alta si hay enlace, telefono (9+ digitos) o email.
 */
export function severityFor(detectedContent: string): AlertSeverity {
  const lower = detectedContent.toLowerCase();
  const hasLink = LINK_TERMS.some((t) => lower.includes(t));
  const hasPhone =
    /número:|número_detectado|email_detectado|email:/.test(lower) ||
    /\b9\d{8}\b/.test(lower) ||
    /(?<!\d)\+?\d(?:[\s.\-_]?\d){8,14}(?!\d)/.test(lower);
  return hasLink || hasPhone ? "high" : "medium";
}

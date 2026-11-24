// Motor de deteccion de contacto privado (telefonos, enlaces, emails y palabras de la lista negra).
// Funciones puras, sin acceso a la base: las usa el servidor (envio de chat, pedidos, escaneos) y las pruebas.
// Gravedad: ALTA = dato de contacto completo (telefono, enlace, email) -> se censura antes de entregar;
//           MEDIA = palabra ambigua de la lista negra ("whatsapp", "escribeme") -> se entrega y se revisa a mano.

export type ContactSeverity = "high" | "medium";

export type FilterRule = { value: string; match: (normalizedText: string) => string | null };
export type FilterRules = { blacklist: FilterRule[]; whitelist: FilterRule[] };

// Valor con {N} (ej: "+{11}", "{3}-{3}-{4}") se interpreta como patron: N digitos seguidos.
// Sin {N}, funciona como substring exacto (case/acento-insensible).
const PATTERN_TOKEN_RE = /\{(\d+)\}/;

export function isPatternRule(value: string): boolean {
  return PATTERN_TOKEN_RE.test(value);
}

function buildPatternRegex(value: string): RegExp {
  const escapeLiteral = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRe = /\{(\d+)\}/g;
  let source = "";
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(value)) !== null) {
    source += escapeLiteral(value.slice(lastIndex, m.index)) + `\\d{${m[1]}}`;
    lastIndex = tokenRe.lastIndex;
  }
  return new RegExp(source + escapeLiteral(value.slice(lastIndex)));
}

export function compileFilterRule(value: string): FilterRule {
  if (isPatternRule(value)) {
    const regex = buildPatternRegex(value);
    return { value, match: (text) => regex.exec(text)?.[0] ?? null };
  }
  const needle = normalizeForScan(value);
  return { value, match: (text) => (text.includes(needle) ? value : null) };
}

/** Minusculas, sin tildes y con espacios colapsados: el texto contra el que se comparan las reglas. */
export function normalizeForScan(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 9 a 15 digitos, con espacios, puntos o guiones entre ellos y "+" opcional (ej. +58414 123 4567, 987-654-321).
// Los lookarounds evitan tomar un tramo de un numero mas largo (cuentas, ids de 16+ digitos).
const PHONE_RE = /(?<!\d)\+?\d(?:[\s.\-_]?\d){8,14}(?!\d)/g;
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+|\b(?:wa\.me|t\.me|instagram\.com|facebook\.com|tiktok\.com|bit\.ly)\/?[^\s]*/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

export type ContactScan = {
  /** null = nada que marcar (o todo lo detectado esta en la lista blanca). */
  severity: ContactSeverity | null;
  /** Terminos de la lista negra que coinciden (gravedad media). */
  matchedTerms: string[];
  /** Fragmentos de ALTA gravedad tal como aparecen en el texto original. */
  phones: string[];
  links: string[];
  emails: string[];
};

function allowedByWhitelist(fragment: string, rules: FilterRules): boolean {
  const normalized = normalizeForScan(fragment);
  return rules.whitelist.some((w) => w.match(normalized) !== null);
}

function findHighMatches(rawText: string, rules: FilterRules) {
  const keep = (list: string[]) => list.filter((m) => !allowedByWhitelist(m, rules));
  const links = keep(rawText.match(URL_RE) ?? []);
  const emails = keep(rawText.match(EMAIL_RE) ?? []);
  // El telefono no puede ser un tramo de un enlace ya detectado (ej. wa.me/51999999999).
  const withoutLinks = links.reduce((t, l) => t.split(l).join(" "), rawText);
  const phones = keep(withoutLinks.match(PHONE_RE) ?? []).filter((m) => {
    const digits = m.replace(/\D/g, "").length;
    return digits >= 9 && digits <= 15;
  });
  return { phones, links, emails };
}

export function scanContact(rawText: string, rules: FilterRules): ContactScan {
  const { phones, links, emails } = findHighMatches(rawText, rules);
  const normalized = normalizeForScan(rawText);
  const wholeTextWhitelisted = rules.whitelist.some((w) => w.match(normalized) !== null);
  const matchedTerms = wholeTextWhitelisted
    ? []
    : rules.blacklist.map((r) => r.match(normalized)).filter((m): m is string => m !== null);
  const high = phones.length + links.length + emails.length > 0;
  return {
    severity: high ? "high" : matchedTerms.length > 0 ? "medium" : null,
    matchedTerms,
    phones,
    links,
    emails,
  };
}

/**
 * Censura los datos de contacto de ALTA gravedad: los digitos de un telefono pasan a `*` (se conservan los
 * separadores: "+58 414 123 4567" -> "+** *** *** ****") y enlaces/emails se reemplazan por `****`.
 */
export function maskContact(rawText: string, rules: FilterRules): string {
  const { phones, links, emails } = findHighMatches(rawText, rules);
  let out = rawText;
  for (const l of links) out = out.split(l).join("****");
  for (const e of emails) out = out.split(e).join("****");
  for (const p of phones) out = out.split(p).join(p.replace(/\d/g, "*"));
  return out;
}

/** Texto que se guarda en `admin_alerts.detected_content`: terminos y datos detectados. */
export function describeScan(scan: ContactScan): string {
  return [
    ...scan.matchedTerms,
    ...scan.phones.map((p) => `número: ${p}`),
    ...scan.links.map((l) => `enlace: ${l}`),
    ...scan.emails.map((e) => `email: ${e}`),
  ].join(", ");
}

export const CONTACT_CENSORSHIP_NOTICE =
  "Por tu seguridad y para mantener la garantía de tus trabajos, no está permitido compartir datos de contacto externos.";

export const HIDDEN_MESSAGE_TEXT = "Mensaje ocultado por moderación";

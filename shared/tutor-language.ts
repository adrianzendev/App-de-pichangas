// Idioma principal del tutor (tutors.language). Lo ven los alumnos en el perfil y lo edita el tutor o el admin.
// Es el idioma NATIVO: se muestra como "Español (nativo)".

export const TUTOR_LANGUAGES = ["Español", "Inglés", "Portugués", "Francés", "Italiano", "Alemán", "Otro"] as const;
export type TutorLanguage = (typeof TUTOR_LANGUAGES)[number];

export const isTutorLanguage = (v: unknown): v is TutorLanguage =>
  typeof v === "string" && (TUTOR_LANGUAGES as readonly string[]).includes(v);

// Paises de LATAM de habla hispana, en ISO-2 e ISO-3 (users.country mezcla ambos: "PE", "VEN"). Brasil queda fuera (portugues).
const LATAM_SPANISH = new Set([
  "AR", "ARG", "BO", "BOL", "CL", "CHL", "CO", "COL", "CR", "CRI", "CU", "CUB", "DO", "DOM", "EC", "ECU",
  "SV", "SLV", "GT", "GTM", "HN", "HND", "MX", "MEX", "NI", "NIC", "PA", "PAN", "PY", "PRY", "PE", "PER",
  "PR", "PRI", "UY", "URY", "VE", "VEN",
]);

/** Idioma por defecto segun el pais del usuario: Español para LATAM hispana; null si no se puede asumir. */
export function defaultLanguageForCountry(country?: string | null): TutorLanguage | null {
  return country && LATAM_SPANISH.has(country.trim().toUpperCase()) ? "Español" : null;
}

/** Texto para mostrar: "Español (nativo)". */
export const formatTutorLanguage = (language: string): string => `${language} (nativo)`;

/** Lista SQL con los codigos de LATAM (para la migracion y sus pruebas). */
export const LATAM_SPANISH_CODES: readonly string[] = Array.from(LATAM_SPANISH);

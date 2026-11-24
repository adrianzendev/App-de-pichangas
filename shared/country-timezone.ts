// Zona horaria por pais. Una sola fuente para la hora local de colaboradores en otros paises (admin > Tutores, etc.).
// users.country mezcla ISO-2 ("PE") e ISO-3 ("VEN"): se aceptan los dos. Pruebas: npx tsx --test tests/country-timezone.test.ts

const TIMEZONES: Record<string, string> = {
  PE: "America/Lima", CO: "America/Bogota", EC: "America/Guayaquil", MX: "America/Mexico_City",
  AR: "America/Argentina/Buenos_Aires", CL: "America/Santiago", VE: "America/Caracas", BO: "America/La_Paz",
  PA: "America/Panama", PY: "America/Asuncion", UY: "America/Montevideo", CR: "America/Costa_Rica",
  DO: "America/Santo_Domingo", GT: "America/Guatemala", HN: "America/Tegucigalpa", NI: "America/Managua",
  SV: "America/El_Salvador", CU: "America/Havana", PR: "America/Puerto_Rico", BR: "America/Sao_Paulo",
  ES: "Europe/Madrid", US: "America/New_York",
};

const ISO3_TO_ISO2: Record<string, string> = {
  PER: "PE", COL: "CO", ECU: "EC", MEX: "MX", ARG: "AR", CHL: "CL", VEN: "VE", BOL: "BO", PAN: "PA", PRY: "PY",
  URY: "UY", CRI: "CR", DOM: "DO", GTM: "GT", HND: "HN", NIC: "NI", SLV: "SV", CUB: "CU", PRI: "PR", BRA: "BR",
  ESP: "ES", USA: "US",
};

/** Zona IANA del pais (codigo ISO-2 o ISO-3, sin importar mayusculas); null si no se conoce. */
export function timezoneForCountry(country?: string | null): string | null {
  if (!country) return null;
  const code = country.trim().toUpperCase();
  return TIMEZONES[ISO3_TO_ISO2[code] ?? code] ?? null;
}

import { z } from "zod";

// Validacion de los campos de texto libre del perfil. Una sola fuente: la usan el formulario (cliente) y
// PUT /api/user/current (servidor, que es quien de verdad manda: el cliente se puede saltar).

export const UNIVERSITY_MAX = 100;

/** Quita caracteres de control, recorta y colapsa espacios repetidos ("  UNMSM   Lima " -> "UNMSM Lima"). */
export function normalizeText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Universidad (opcional): texto coherente, no basura. Vacio es valido (el campo es opcional).
 * Reglas: 3-100 caracteres, solo letras, numeros y signos comunes de un nombre (. , ' & ( ) - /), al menos dos
 * letras seguidas, sin cuatro caracteres iguales seguidos ("aaaa", "!!!!") y ninguna palabra de mas de 30 letras
 * (teclazos sin espacios). No detecta texto plausible pero inventado ("asdf ghjk"): para eso haria falta una lista.
 */
export const universitySchema = z
  .string()
  .transform(normalizeText)
  .superRefine((v, ctx) => {
    if (v === "") return;
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (v.length < 3) return fail("Escribe al menos 3 caracteres");
    if (v.length > UNIVERSITY_MAX) return fail(`Máximo ${UNIVERSITY_MAX} caracteres`);
    if (!/^[\p{L}\p{N} .,'’&()\-/]+$/u.test(v)) return fail("Usa solo letras, números y signos comunes (. , - ' & ( ) /)");
    if (!/\p{L}{2}/u.test(v)) return fail("Escribe el nombre de tu universidad");
    if (/(.)\1{3,}/u.test(v)) return fail("Revisa el texto: hay caracteres repetidos");
    if (v.split(" ").some((word) => word.length > 30)) return fail("Revisa el texto: hay una palabra demasiado larga");
  });

/** Para formularios: `value` ya normalizado (es lo que se guarda) y `error` ("" si es valido). */
export function validateUniversity(raw: string): { value: string; error: string } {
  const result = universitySchema.safeParse(raw);
  if (result.success) return { value: result.data, error: "" };
  return { value: normalizeText(raw), error: result.error.issues[0]?.message ?? "Texto no válido" };
}

// Autocomprobacion: npx tsx shared/profile-validation.ts
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("profile-validation.ts")) {
  const ok = (raw: string, want: string) => {
    const r = validateUniversity(raw);
    if (r.error || r.value !== want) throw new Error(`"${raw}": esperado valido "${want}", salio "${r.value}" / "${r.error}"`);
  };
  const bad = (raw: string) => {
    if (!validateUniversity(raw).error) throw new Error(`"${raw}" deberia ser invalido`);
  };
  ok("", "");
  ok("   ", "");
  ok("  UNMSM   Lima ", "UNMSM Lima");
  ok("Universidad Nacional Mayor de San Marcos", "Universidad Nacional Mayor de San Marcos");
  ok("Pontificia Universidad Católica del Perú (PUCP)", "Pontificia Universidad Católica del Perú (PUCP)");
  ok("Université de Montréal", "Université de Montréal");
  ok("UCV", "UCV");
  bad("ab");
  bad("1234");
  bad("aaaaa");
  bad("@@@###");
  bad("Universidad <script>");
  bad("x".repeat(101));
  bad("asdkjhasdkjhaskjdhaskjdhaskjdhasdkjh");
  bad("http://spam.com/ganar");
  console.log("profile-validation OK");
}

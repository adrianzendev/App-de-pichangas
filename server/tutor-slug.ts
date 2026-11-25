// Slug del perfil del tutor (/tutor/olga-perez). Una sola fuente: storage.createTutor y scripts/backfill-tutor-slugs.ts.

// Mismo criterio que getDisplayName (client/src/components/account/use-account-actions.ts): convencion peruana
// "Nombre(s) Apellido1 Apellido2" -> 3+ palabras = primera + anteultima (salta el segundo apellido).
function nameForSlug(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 2]}`;
}

/** "Olga Nohelí Pérez Ramírez" -> "olga-perez". Sin acentos, minusculas, solo a-z 0-9 y guiones. "tutor" si no queda nada. */
export function slugBase(name: string | null | undefined): string {
  const slug = nameForSlug(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "tutor";
}

/** Primer slug libre: "olga-perez", luego "olga-perez-2", "-3"... `taken` = slugs ya usados (en minusculas). */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// Autocomprobacion: npx tsx server/tutor-slug.ts
if (process.argv[1]?.endsWith("tutor-slug.ts")) {
  const eq = (got: string, want: string) => { if (got !== want) throw new Error(`esperado ${want}, salio ${got}`); };
  eq(slugBase("Olga Nohelí"), "olga-noheli");
  eq(slugBase("Olga Nohelí Pérez Ramírez"), "olga-perez");
  eq(slugBase("  José  Ñandú  "), "jose-nandu");
  eq(slugBase("Dr. O'Brien-Smith"), "dr-o-brien-smith");
  eq(slugBase("???"), "tutor");
  eq(slugBase(null), "tutor");
  eq(uniqueSlug("ana-diaz", new Set()), "ana-diaz");
  eq(uniqueSlug("ana-diaz", new Set(["ana-diaz", "ana-diaz-2"])), "ana-diaz-3");
  console.log("tutor-slug OK");
}

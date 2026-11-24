// Asigna slug (/tutor/olga-perez) a los tutores que aun no lo tienen. Los que ya tienen slug no se tocan (los enlaces
// compartidos no cambian aunque el tutor edite su nombre). Por defecto es DRY-RUN: no escribe nada.
// Requiere migrations/022_tutor_slug.sql aplicada.
// Uso: npx tsx --env-file=.env scripts/backfill-tutor-slugs.ts [--apply]
import { and, eq, isNull } from "drizzle-orm";
import { db, pool } from "../server/db";
import { tutors, users } from "../shared/schema";
import { slugBase, uniqueSlug } from "../server/tutor-slug";

const APPLY = process.argv.includes("--apply");

async function main() {
  const all = await db.select({ id: tutors.id, slug: tutors.slug, name: users.name }).from(tutors).leftJoin(users, eq(tutors.user_id, users.id)).orderBy(tutors.id);
  const taken = new Set(all.map((t) => t.slug).filter((s): s is string => !!s));
  const pending = all.filter((t) => !t.slug);
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"}: ${all.length} tutores, ${taken.size} con slug, ${pending.length} por asignar`);

  let done = 0, collisions = 0;
  for (const t of pending) {
    const base = slugBase(t.name);
    const slug = uniqueSlug(base, taken);
    taken.add(slug);
    if (slug !== base) collisions++;
    if (!APPLY) { if (done < 12) console.log(`  ${t.id.slice(0, 8)}  ${slug}`); done++; continue; }
    // isNull: no pisa un slug asignado mientras tanto.
    const updated = await db.update(tutors).set({ slug }).where(and(eq(tutors.id, t.id), isNull(tutors.slug))).returning({ id: tutors.id });
    if (updated.length) done++;
  }
  console.log(`Resumen: ${done} ${APPLY ? "asignados" : "a asignar"}, ${collisions} con sufijo por nombre repetido.${APPLY ? "" : " Usa --apply para escribir."}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());

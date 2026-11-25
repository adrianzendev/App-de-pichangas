// Reprocesa avatares antiguos a 400x400 JPEG (igual que las subidas nuevas) y mueve los de /uploads/ a /objects/.
// Candidatos: avatar en /uploads/ o con algun lado > 400px. Por defecto es DRY-RUN (no escribe nada).
// El UPDATE solo aplica si el avatar no cambio mientras tanto. No borra los archivos viejos (el rollback es
// volver a poner la ruta anterior).
// Uso: npx tsx --env-file=.env scripts/migrate-avatars.mjs [--apply]
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { neon } from "@neondatabase/serverless";
import { ObjectStorageService } from "../server/object_storage/objectStorage";

const APPLY = process.argv.includes("--apply");
const MAX_SIDE = 400;
const sql = neon(process.env.DATABASE_URL);
const storage = new ObjectStorageService();

// Devuelve el buffer original, o null si el archivo ya no existe.
async function readOriginal(avatar) {
  try {
    if (avatar.startsWith("/uploads/")) return await readFile(path.join("uploads", path.basename(avatar)));
    const objectPath = avatar.includes("://") ? new URL(avatar).pathname : avatar;
    return (await storage.readObjectBuffer(await storage.getObjectEntityFile(objectPath))).buffer;
  } catch {
    return null;
  }
}

const rows = await sql`select id, avatar from users where avatar like '/uploads/%' or avatar like '%/objects/%'`;
console.log(`${APPLY ? "APPLY" : "DRY-RUN"}: ${rows.length} avatares propios revisados`);

let candidates = 0, migrated = 0, skipped = 0;
for (const row of rows) {
  const tag = row.id.slice(0, 8);
  const original = await readOriginal(row.avatar);
  if (!original) { console.log(`  ${tag} sin archivo (omitido): ${row.avatar.slice(0, 40)}`); skipped++; continue; }
  const meta = await sharp(original, { failOn: "none" }).metadata();
  const legacy = row.avatar.startsWith("/uploads/");
  if (!legacy && Math.max(meta.width ?? 0, meta.height ?? 0) <= MAX_SIDE) continue;
  candidates++;
  const jpeg = await sharp(original, { failOn: "none" }).rotate().resize(MAX_SIDE, MAX_SIDE, { fit: "cover", position: "center" }).jpeg({ quality: 85 }).toBuffer();
  const kb = (n) => `${Math.round(n / 1024)}KB`;
  console.log(`  ${tag} ${legacy ? "/uploads/" : "/objects/"} ${meta.width}x${meta.height} ${kb(original.length)} -> 400x400 ${kb(jpeg.length)}`);
  if (!APPLY) continue;
  const newPath = await storage.uploadObjectEntity(jpeg, "image/jpeg");
  const updated = await sql`update users set avatar = ${newPath} where id = ${row.id} and avatar = ${row.avatar} returning id`;
  if (updated.length) { migrated++; console.log(`    OK ${row.avatar.slice(0, 40)} -> ${newPath}`); }
  else console.log("    el avatar cambio mientras tanto: no se actualizo");
}
console.log(`Resumen: ${candidates} a migrar, ${migrated} migrados, ${skipped} omitidos.${APPLY ? "" : " Usa --apply para escribir."}`);

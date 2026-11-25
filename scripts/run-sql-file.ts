// Ejecuta un archivo .sql contra DATABASE_URL, dividiendo por ';' a nivel
// superior. Uso local: no hay psql disponible en este entorno de desarrollo.
// Uso: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/009_add_chat_threads.sql
import { readFileSync } from "fs";
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: run-sql-file.ts <ruta-al-archivo.sql>");
    process.exit(1);
  }
  const raw = readFileSync(filePath, "utf8");
  const statements = raw
    .split(/;\s*(?:\n|$)/)
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 0);

  console.log(`Ejecutando ${statements.length} sentencia(s) de ${filePath}`);
  for (const stmt of statements) {
    const firstLine = stmt.split("\n").find((l) => !l.trim().startsWith("--"))?.trim() ?? stmt.slice(0, 60);
    console.log(`> ${firstLine.slice(0, 100)}`);
    await db.execute(sql.raw(stmt));
  }
  console.log("Listo.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

// Falla si un `catch` de un endpoint responde 5xx sin imprimir el error (console.error/log/warn).
// El registro de errores (server/middleware/error-logger.ts) recupera el Error real de lo que el endpoint imprime con
// console.error: sin esa linea el panel de admin solo muestra "Failed to ..." y ninguna pista para depurarlo.
// Correcto:   catch (error) { console.error("[GET /api/x] error:", error); res.status(500).json({ message: "..." }); }
// Excepcion puntual: comentario `catch-log-ok: motivo` dentro del catch.
import { readFileSync } from "node:fs";

const FILES = ["server/routes.ts", "server/object_storage/routes.ts"];
const CATCH_RE = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)\s*(?::\s*\w+)?\s*\)\s*\{/g;

let bad = 0;
for (const file of FILES) {
  const src = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  let m;
  while ((m = CATCH_RE.exec(src))) {
    const start = m.index + m[0].length;
    let depth = 1, i = start, inStr = null, esc = false;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i], n = src[i + 1];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === inStr) inStr = null; continue; }
      if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "/" && n === "*") { i = src.indexOf("*/", i + 2) + 1; continue; }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === "{") depth++; else if (c === "}") depth--;
    }
    const body = src.slice(start, i - 1);
    if (!/status\(\s*5\d\d\s*\)/.test(body)) continue;
    if (/console\.(error|log|warn)\(/.test(body) || body.includes("catch-log-ok")) continue;
    console.error(`${file}:${src.slice(0, m.index).split("\n").length}: catch (${m[1]}) responde 5xx sin imprimir el error (console.error("[METODO /ruta] error:", ${m[1]}))`);
    bad++;
  }
}
if (bad) { console.error(`\n${bad} catch sin registro del error`); process.exit(1); }
console.log("check:catch-logging OK");

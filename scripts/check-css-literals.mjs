// Compila Tailwind y falla si alguna utilidad generada lleva un valor de diseno LITERAL
// (de un default de Tailwind o escrito en una clase) en vez de var(--token) de index.css.
// Sin excepciones: hasta grids, fracciones, viewport, sr-only y outline-none salen de var(--token).
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "tw-"));
const out = join(dir, "out.css");
try {
  execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "client/src/index.css", "-o", out], { stdio: "pipe" });
  const css = readFileSync(out, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  const ALLOW = []; // sin excepciones: grids, fracciones, viewport, sr-only y outline-none tambien salen de index.css

  const bad = new Map();
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const s = sel.trim();
    if (!s.startsWith(".") && !/^[^{]*\s\./.test(s)) continue; // solo utilidades (no :root/base/elementos)
    for (const d of body.split(";")) {
      const i = d.indexOf(":");
      if (i < 0) continue;
      const prop = d.slice(0, i).trim(), val = d.slice(i + 1).trim();
      if (!prop || !val || prop.startsWith("--")) continue;
      // Quita var(--x) y ceros; si queda una unidad literal o un color literal, es una fuga.
      const rest = val
        .replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "")
        .replace(/calc\([^()]*\*\s*100%\)/g, "") // alpha de color-mix (bg-x/10), no es un valor de diseno
        .replace(/(?<![\d.])0(px|rem|em|%)?(?![\d.])/g, "");
      if (!/(?:\d*\.)?\d+(?:px|rem|em|ms|s|deg|dvh|vh|vw|%)(?![\w-])|#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\(/i.test(rest)) continue;
      const decl = `${prop}: ${val}`;
      if (ALLOW.some((r) => r.test(decl))) continue;
      (bad.get(decl) ?? bad.set(decl, new Set()).get(decl)).add(s.split(/[ ,>:]/)[0].replaceAll("\\", ""));
    }
  }
  if (bad.size) {
    for (const [d, sels] of bad) console.error(`${d}   <- ${[...sels].slice(0, 4).join(", ")}`);
    console.error(`\n${bad.size} valor(es) literal(es) en el CSS generado: definirlos en index.css + tailwind.config.ts`);
    process.exit(1);
  }

  // Clases usadas en el codigo que NO generan CSS (token inexistente: ej. w-dropdown-sm cuando solo existia min-w-dropdown-sm).
  const have = new Set();
  for (const m of css.matchAll(/\.((?:\\.|[^\s.,:>+~[\]()#{}])+)/g)) have.add(m[1].replace(/\\(.)/g, "$1"));
  const PREFIXES = "w|h|size|min-w|min-h|max-w|max-h|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|text|bg|border|rounded|shadow|opacity|z|ring|fill|stroke|font|leading|tracking|translate-x|translate-y|scale|rotate|origin|grid-cols|col-span|duration|ease|animate|line-clamp|basis|divide|from|to|via|outline|backdrop-blur|blur";
  const TOKEN = new RegExp(`^(?:[a-z0-9]+(?:-[a-z0-9]+)*:)*!?-?(?:${PREFIXES})-[A-Za-z0-9./%-]+$`);
  const dead = new Map();
  const walk = function* (d) {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) yield* walk(p);
      else if (f.endsWith(".tsx")) yield p;
    }
  };
  for (const p of walk("client/src")) {
    readFileSync(p, "utf8").split("\n").forEach((line, n) => {
      if (/testid|TestId/i.test(line)) return; // data-testid="text-x" no es una clase
      for (const lit of line.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*?)\1/g)) {
        for (const t of lit[2].split(/\s+/)) {
          if (!TOKEN.test(t) || /[$()]/.test(t) || have.has(t) || have.has(t.replace(/^!/, ""))) continue;
          (dead.get(t) ?? dead.set(t, []).get(t)).push(`${p}:${n + 1}`);
        }
      }
    });
  }
  if (dead.size) {
    for (const [t, where] of dead) console.error(`clase sin CSS: ${t}   <- ${where[0]}`);
    console.error(`\n${dead.size} clase(s) no generan CSS: el token no existe en tailwind.config.ts`);
    process.exit(1);
  }
  console.log("check:css-literals OK");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

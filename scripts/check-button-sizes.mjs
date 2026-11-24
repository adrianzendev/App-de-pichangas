// <Button className> no puede fijar tamano propio (h-N, px-N, py-N, text-xs...): usar size= del Button
// (xs, sm, default, lg, xl, icon, icon-sm en components/ui/button.tsx). Filas de menu con h-auto quedan fuera.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function* walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (f.endsWith(".tsx")) yield p;
  }
}
// Fin de la apertura del tag: primer `>` fuera de {} y de strings (ignora `=>`).
function tagEnd(s, i) {
  let depth = 0, q = null;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === "\\") i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { q = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0 && s[i - 1] !== "=") return i;
  }
  return -1;
}
const SIZE = /(?<![\w-])(?:h|min-h|w|min-w|px|py|p|gap)-\d[\d.]*(?![\w-])|(?<![\w-])text-(?:xs|sm|base|body|caption)(?![\w-])|(?<![\w-])rounded-(?:md|lg|xl)(?![\w-])/;

let bad = 0;
for (const p of walk("client/src")) {
  if (p.endsWith("components\\ui\\button.tsx") || p.endsWith("components/ui/button.tsx")) continue;
  const s = readFileSync(p, "utf8");
  for (const m of s.matchAll(/<Button\b/g)) {
    const end = tagEnd(s, m.index + 7);
    const cm = end > 0 && s.slice(m.index, end).match(/className="([^"]*)"/);
    if (!cm || /(?<![\w-])h-auto(?![\w-])/.test(cm[1])) continue;
    const hit = cm[1].match(SIZE);
    if (hit) {
      console.error(`${p}:${s.slice(0, m.index).split("\n").length}: <Button className="... ${hit[0]} ..."> fija tamano; usar size=`);
      bad++;
    }
  }
}
if (bad) { console.error(`\n${bad} Button(s) con tamano propio`); process.exit(1); }
console.log("check:button-sizes OK");

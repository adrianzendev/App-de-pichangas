// Empaqueta server/index.ts en dist/index.js con la API de esbuild.
// `node node_modules/esbuild/bin/esbuild` falla en Linux (Railway): ahi ese archivo es el binario nativo, no JS.
import { build } from "esbuild";

await build({
  entryPoints: ["server/index.ts"],
  platform: "node",
  packages: "external",
  bundle: true,
  format: "esm",
  outdir: "dist",
});

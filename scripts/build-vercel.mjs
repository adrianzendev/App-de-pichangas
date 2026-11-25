// Arma .vercel/output (Build Output API v3) para Vercel:
//  - static/                    el cliente (vite build -> dist/public)
//  - functions/api.func/        el servidor de Express empaquetado en UN archivo con esbuild (alias @shared resueltos)
//  - config.json                rutas: /api, /uploads y /objects a la funcion; el resto, a index.html (SPA); cron diario
// Se ejecuta como buildCommand (vercel.json). Se hace aqui y no con el compilador automatico de Vercel porque ese deja los
// imports `@shared/...` sin resolver, no agrega extensiones (el proyecto es ESM) y arrastra uploads/ (archivos de usuarios).
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const OUT = ".vercel/output";
const FUNC = `${OUT}/functions/api.func`;

rmSync(OUT, { recursive: true, force: true });

// 1. Cliente
execSync("npx vite build", { stdio: "inherit" });
mkdirSync(`${OUT}/static`, { recursive: true });
cpSync("dist/public", `${OUT}/static`, { recursive: true });

// 2. Servidor en un solo archivo. sharp trae binarios nativos y no se empaqueta: se copia aparte (paso 3).
mkdirSync(FUNC, { recursive: true });
await build({
  entryPoints: ["server/vercel-handler.ts"],
  outfile: `${FUNC}/index.mjs`,
  bundle: true, platform: "node", format: "esm", target: "node22",
  external: ["sharp", "bufferutil", "utf-8-validate", "pg-native", "fsevents"],
  tsconfig: "tsconfig.json",
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: "warning",
});

// 3. sharp y sus dependencias (en el servidor de Vercel, npm instala los binarios de Linux que corresponden)
for (const dir of ["sharp", "@img", "detect-libc", "semver"]) {
  if (existsSync(`node_modules/${dir}`)) cpSync(`node_modules/${dir}`, `${FUNC}/node_modules/${dir}`, { recursive: true });
}

writeFileSync(`${FUNC}/package.json`, JSON.stringify({ type: "module" }));
writeFileSync(`${FUNC}/.vc-config.json`, JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", maxDuration: 30, memory: 1024 }, null, 2));

// 4. Rutas. La funcion recibe `/api?__orig=<ruta original>` y restaura la URL (server/vercel-handler.ts).
const noCache = (src) => ({ src, headers: { "Cache-Control": "no-cache" }, continue: true });
writeFileSync(`${OUT}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    noCache("^/service-worker\\.js$"),
    noCache("^/manifest\\.json$"),
    { src: "^/assets/(.*)$", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
    { handle: "filesystem" },
    { src: "^(/(?:api|uploads|objects)(?:/.*)?)$", dest: "/api?__orig=$1" },
    { src: "^/(?!assets/)[^.]*$", dest: "/index.html" },
  ],
  // Tareas programadas (recordatorios, pedidos vencidos, reservas): una vez al dia. En el plan Pro puede ser cada hora (0 * * * *).
  crons: [{ path: "/api/cron/jobs", schedule: "0 12 * * *" }],
}, null, 2));

console.log("Vercel: .vercel/output listo");

import type { IncomingMessage, ServerResponse } from "node:http";
import { app, ready } from "./index";

// Funcion de Vercel: toda la API (/api, /uploads, /objects) pasa por la app de Express.
// scripts/build-vercel.mjs la empaqueta con esbuild en .vercel/output/functions/api.func/index.mjs.
//
// Las rutas de .vercel/output/config.json reenvian a esta funcion con `/api?__orig=<ruta original>`: aqui se restaura la URL
// original (y su query) para que Express enrute igual que fuera de Vercel, venga o no la URL original ya intacta.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready;
  const u = new URL(req.url ?? "/", "http://localhost");
  const orig = u.searchParams.get("__orig");
  // Solo se acepta una ruta de las que vercel.json reenvia: un cliente no puede forzar otra ruta interna con ?__orig=.
  if (orig && /^\/(?:api|uploads|objects)(?:\/|$|\?)/.test(orig)) {
    u.searchParams.delete("__orig");
    const rest = u.searchParams.toString();
    req.url = orig + (rest ? (orig.includes("?") ? "&" : "?") + rest : "");
  }
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}

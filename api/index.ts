import type { IncomingMessage, ServerResponse } from "node:http";
import { app, ready } from "../server/index";

// Funcion de Vercel: toda la API (/api, /uploads, /objects) pasa por la app de Express. vercel.json reenvia esas rutas aqui
// conservando la URL original. Espera a que el servidor termine de registrar sus rutas antes de atender.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready;
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}

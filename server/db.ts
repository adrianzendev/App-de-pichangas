import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { AsyncLocalStorage } from "node:async_hooks";
import * as schema from "@shared/schema";
import { sideEffectsEnabled } from "./side-effects";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// idleTimeoutMillis: default de @neondatabase/serverless es 10000 — en un
// chat real los mensajes van espaciados mas de 10s casi siempre, asi que
// cada envio pagaba una reconexion completa (handshake) en vez de reusar
// la conexion. Subirlo evita ese costo en el patron de uso real.
// connectionTimeoutMillis: sin el, un connect() a un socket Neon muerto espera
// para siempre (default 0); con el, el pool destruye el stream y falla.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
});
// Neon cierra conexiones ociosas ("Connection terminated unexpectedly",
// ECONNRESET). Sin listener, el 'error' de un cliente idle tumba el proceso. El
// pool ya expulsa ese cliente (makeIdleListener -> _remove) antes de emitir el
// evento: aqui solo se registra, no hay que destruir nada.
pool.on('error', (err: any) => console.error('[DB_POOL] idle client error:', err.code ?? '', err.message));

// Timeouts por query. El chat en tiempo real necesita detectar una conexion
// muerta rapido (2.5 s); la sesion corre en cada request (3 s); el resto
// (admin, reportes) tolera mas.
export const DB_TIMEOUTS = {
  CHAT_QUERY_TIMEOUT_MS: 2500,
  SESSION_QUERY_TIMEOUT_MS: 3000,
  DEFAULT_QUERY_TIMEOUT_MS: 6000,
} as const;
// Timeout de la RUTA en curso: el middleware de /api/chat (server/index.ts) lo fija
// y `pool.query` lo lee sin que cada handler tenga que pasarlo.
export const queryTimeoutContext = new AsyncLocalStorage<number>();

// Neon corta conexiones del pool y el pool entrega un cliente ya muerto. Puede
// fallar rapido ("Connection terminated unexpectedly", ECONNRESET) o, peor,
// COLGARSE sin error hasta que algo mata el socket: el request queda en vuelo y
// el mensaje nunca sale (visto en soak: POST /api/chat/send sin respuesta y 500
// en cascada de la sesion). Cada query corre con timeout propio; si falla por
// conexion muerta o timeout, el cliente se DESTRUYE (release(true)) para que no
// vuelva al pool, y se reintenta una vez con una conexion nueva. Se aplica a
// `pool` (drizzle) y al pool de sesion (connect-pg-simple, server/index.ts)
// porque ambos usan `pool.query`. Las transacciones usan connect() y no pasan por aqui.
// El reintento usa max(timeout, DEFAULT): si la causa fue un cold-start de Neon,
// la conexion nueva tambien arranca fria y no debe cortarse por el limite corto.
// ponytail: reintenta tambien escrituras; es seguro si la conexion murio antes
// de ejecutar (caso habitual). Subir los timeouts si hay queries legitimas mas lentas.
const DEAD_CONNECTION = /Connection terminated|terminating connection|DB query timeout|ECONNRESET|EPIPE|socket hang up|connection error|timeout exceeded when trying to connect/i;
export function retryOnDeadConnection<T extends { connect: () => Promise<any>; query: (...args: any[]) => Promise<any> }>(
  p: T,
  defaultMs: number,
  useRouteTimeout = false,
): T {
  const attempt = async (args: any[], timeoutMs: number) => {
    const client = await p.connect();
    // Mientras esta prestado, el pool NO escucha 'error' del cliente (solo en idle): si la
    // conexion muere en uso, el evento sin listener seria una excepcion no capturada que
    // tumba el proceso. La query ya recibe el error por su promesa; esto solo lo absorbe.
    const swallow = () => {};
    client.on('error', swallow);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = client.query(...args);
    run.catch(() => {}); // si pierde la carrera y falla despues, no es un rechazo sin manejar
    try {
      const result = await Promise.race([
        run,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DB query timeout')), timeoutMs); }),
      ]);
      client.release();
      return result;
    } catch (err: any) {
      client.release(DEAD_CONNECTION.test(`${err?.code ?? ''} ${err?.message ?? ''}`) ? true : undefined);
      throw err;
    } finally {
      clearTimeout(timer);
      client.removeListener('error', swallow);
    }
  };
  p.query = (async (...args: any[]) => {
    const firstMs = (useRouteTimeout && queryTimeoutContext.getStore()) || defaultMs;
    try {
      return await attempt(args, firstMs);
    } catch (err: any) {
      if (!DEAD_CONNECTION.test(`${err?.code ?? ''} ${err?.message ?? ''}`)) throw err;
      console.warn(`[DB_POOL] conexion muerta o query colgada (${err.code ?? ''} ${err.message}), reintentando una vez`);
      return attempt(args, Math.max(firstMs, DB_TIMEOUTS.DEFAULT_QUERY_TIMEOUT_MS));
    }
  }) as T['query'];
  return p;
}
retryOnDeadConnection(pool, DB_TIMEOUTS.DEFAULT_QUERY_TIMEOUT_MS, true);
export const db =drizzle({ client: pool, schema });

// Conexion nueva a Neon = ~600 ms (handshake WS+TLS); reusada = ~140 ms (un viaje).
// Al entrar al dashboard salen ~6 requests en paralelo y, con el pool frio, cada una
// pagaba el handshake. Se abren `n` conexiones al arrancar y un ping cada 30 s evita
// que idleTimeoutMillis (60 s) las cierre entre requests. El ping SOLO corre si hubo una
// request en los ultimos 5 min: sin trafico el compute de Neon se auto-suspende.
const ACTIVE_WINDOW_MS = 5 * 60_000;
let lastActivity = Date.now();
export const markActivity = () => { lastActivity = Date.now(); };
export function keepWarm(p: { query: (...a: any[]) => Promise<any> }, n: number) {
  if (!sideEffectsEnabled) return; // local: que Neon se suspenda y no abrir conexiones de mas
  const ping = () => Promise.all(Array.from({ length: n }, () => p.query('SELECT 1'))).catch(() => {});
  void ping(); // una vez al arrancar
  setInterval(() => { if (Date.now() - lastActivity < ACTIVE_WINDOW_MS) void ping(); }, 30_000).unref();
}
keepWarm(pool, 4);

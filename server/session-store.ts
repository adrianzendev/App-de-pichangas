import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const PgStore = connectPgSimple(session);

const GET_TTL_MS = 15_000; // una sesion validada hace menos de esto no vuelve a la BD
const TOUCH_EVERY_MS = 5 * 60_000; // extender expiracion (maxAge 30 dias) no necesita ser por request
const MAX_ENTRIES = 1000;

// Cada request autenticada pagaba en Postgres (~130 ms c/u en Neon): un SELECT al leer la
// sesion y un UPDATE (touch) antes de cerrar la respuesta. Este store cachea la lectura
// 15 s y espacia el touch. set/destroy actualizan o invalidan el cache de este proceso,
// asi login/logout/cambios de perfil se ven al instante.
// ponytail: cache por proceso; con varias instancias una sesion destruida en otra
// puede seguir valida hasta GET_TTL_MS. Aceptable a 15 s.
export class CachedPgStore extends PgStore {
  private cache = new Map<string, { at: number; json: string }>();
  private touched = new Map<string, number>();

  private remember(sid: string, sess: unknown) {
    if (this.cache.size >= MAX_ENTRIES) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(sid, { at: Date.now(), json: JSON.stringify(sess) });
  }

  get(sid: string, cb: (err: any, sess?: any) => void) {
    const hit = this.cache.get(sid);
    if (hit && Date.now() - hit.at < GET_TTL_MS) return cb(null, JSON.parse(hit.json));
    super.get(sid, (err: any, sess: any) => {
      if (!err && sess) this.remember(sid, sess);
      else this.cache.delete(sid);
      cb(err, sess);
    });
  }

  set(sid: string, sess: any, cb?: (err?: any) => void) {
    this.cache.delete(sid);
    super.set(sid, sess, (err?: any) => {
      if (!err) { this.remember(sid, sess); this.touched.set(sid, Date.now()); }
      cb?.(err);
    });
  }

  destroy(sid: string, cb?: (err?: any) => void) {
    this.cache.delete(sid);
    this.touched.delete(sid);
    super.destroy(sid, cb);
  }

  touch(sid: string, sess: any, cb?: (err?: any) => void) {
    if (Date.now() - (this.touched.get(sid) ?? 0) < TOUCH_EVERY_MS) return cb?.();
    this.touched.set(sid, Date.now());
    super.touch(sid, sess, cb);
  }
}

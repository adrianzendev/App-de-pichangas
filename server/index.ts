import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import session from "express-session";
import { Pool } from "@neondatabase/serverless";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed-data";
import { retryOnDeadConnection, queryTimeoutContext, DB_TIMEOUTS, keepWarm, markActivity } from "./db";
import { CachedPgStore } from "./session-store";
import { errorCapture, errorHandler, installProcessErrorLogging } from "./middleware/error-logger";
import { logSideEffectsStatus } from "./side-effects";
import { IS_VERCEL, RUN_MIGRATIONS } from "./runtime";
import { universityAcronymBackfillSql, universityExtraSql, universitySeedSql } from "./university-seed";

// Extend session data type
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      name: string;
      email: string;
      userType: string;
      [key: string]: any;
    };
  }
}

// Diagnostico: un rechazo async suelto no debe pasar en silencio ni matar el proceso. Ademas se guarda en error_logs (critical).
installProcessErrorLogging();

logSideEffectsStatus();
// En Vercel el servidor corre como funcion sin estado (api/index.ts): no abre un puerto, no hay WebSockets
// (la presencia en linea queda apagada) y los archivos del cliente los sirve la CDN, no Express.
const app = express();

// Trust proxy for production (Replit uses reverse proxy)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  app.set('trust proxy', 1);
}

// Marca actividad: keepWarm solo mantiene la BD tibia mientras hay trafico reciente.
app.use((_req, _res, next) => { markActivity(); next(); });
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration with PostgreSQL store for persistence
// Mismo motivo que server/db.ts: default idleTimeoutMillis de la libreria
// es 10000, muy corto para el ritmo real de un usuario navegando/chateando.
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // En Vercel cada instancia serverless crea su pool: pocos clientes y cierre rapido para no multiplicar conexiones.
  max: IS_VERCEL ? 3 : 10,
  idleTimeoutMillis: IS_VERCEL ? 10_000 : 60000,
  connectionTimeoutMillis: 3000,
});
// Sin listener, el error de un cliente idle muerto es un 'error' no manejado (tumba el proceso).
// El pool ya expulsa ese cliente antes de emitir el evento (ver comentario en server/db.ts).
sessionPool.on('error', (err: any) => console.error('[SESSION_POOL] idle client error:', err.code ?? '', err.message));
retryOnDeadConnection(sessionPool, DB_TIMEOUTS.SESSION_QUERY_TIMEOUT_MS);
// En Vercel no: el temporizador no corre con la funcion congelada y abriria conexiones de mas.
if (!IS_VERCEL) keepWarm(sessionPool, 4);

// Todo handler de /api/chat/* corre con timeout corto de BD (db.ts lo lee de este
// contexto): conexion muerta detectada y reintentada en 2.5 s, no en 6 s.
app.use('/api/chat', (_req, _res, next) => queryTimeoutContext.run(DB_TIMEOUTS.CHAT_QUERY_TIMEOUT_MS, next));

// Se comparte con el upgrade de /ws (presence-system.ts) para autenticar el
// WebSocket con la misma cookie de sesion.
// Sin valor por defecto en produccion: un secreto escrito en el codigo permitiria falsificar sesiones.
const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : 'dev-only-session-secret');
if (!sessionSecret) throw new Error('SESSION_SECRET no esta configurado');
const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false, // Don't resave unchanged sessions
  saveUninitialized: false, // Don't save empty sessions
  store: new CachedPgStore({
    pool: sessionPool as any,
    tableName: 'user_sessions',
    createTableIfMissing: true, // Auto-create sessions table
    pruneSessionInterval: 60 * 60 * 6, // Prune expired sessions every 6 hours
  }),
  cookie: {
    // 'auto': secure segun si la conexion REAL es HTTPS (via trust proxy),
    // no segun NODE_ENV a ciegas. Con secure:true fijo, correr en modo
    // produccion sobre HTTP plano (sin proxy TLS delante, ej. local o
    // pruebas de build) hacia que el navegador descartara la cookie de
    // sesion en silencio — login devolvia 200 pero nunca quedaba logueado.
    secure: 'auto',
    httpOnly: true, // More secure - prevent XSS access
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: isProduction ? 'none' : 'lax' // Allow cross-site cookies in production
  },
  name: 'miltareas.session' // Custom session name
});
app.use(sessionMiddleware);

// SameSite=None exige Secure: sobre HTTP plano (build local) el navegador descarta la cookie.
// Con trust proxy, req.secure refleja el HTTPS real; solo ahi se deja 'none'.
app.use((req, _res, next) => {
  if (isProduction && !req.secure && req.session) req.session.cookie.sameSite = 'lax';
  next();
});

// Registra en error_logs toda respuesta 5xx (necesita la sesion para saber el usuario).
app.use(errorCapture);

console.log('[SESSION] PostgreSQL session store configured - sessions will persist across restarts');

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// `ready` se resuelve cuando todas las rutas estan registradas: la funcion de Vercel espera a que esto termine.
export const ready = (async () => {
  // Safe idempotent migrations — add missing columns that may not exist in older prod DBs.
  // Un solo viaje a la base (pg ejecuta varias sentencias sin parametros en un query()).
  // En Vercel solo con RUN_MIGRATIONS=1 (ver server/runtime.ts).
  if (RUN_MIGRATIONS) try {
    await sessionPool.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS invited_tutor_ids text[] DEFAULT '{}'::text[];
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachment_names text[] DEFAULT '{}'::text[];
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachment_sizes integer[] DEFAULT '{}'::integer[];
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline_reminder_sent_at timestamp;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_names text[];
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_sizes integer[];
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_dims jsonb;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_id varchar REFERENCES chat_messages(id) ON DELETE SET NULL;
      ALTER TABLE tutors ADD COLUMN IF NOT EXISTS language text;
      CREATE TABLE IF NOT EXISTS tutor_profile_views (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tutor_id varchar NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
        viewer_id varchar REFERENCES users(id) ON DELETE SET NULL,
        viewed_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tutor_profile_views_tutor_idx ON tutor_profile_views (tutor_id, viewed_at DESC);
      CREATE TABLE IF NOT EXISTS universities (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        country text,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS universities_name_unique ON universities (lower(name));
      ALTER TABLE universities ADD COLUMN IF NOT EXISTS acronym text;
      ALTER TABLE universities ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
      ALTER TABLE universities ADD COLUMN IF NOT EXISTS suggested_by varchar;
    `);
    console.log('[MIGRATION] tasks/chat_messages/tutors columns ensured');
    // Catalogo de universidades: lista inicial solo si la tabla esta vacia (despues la mantiene el admin).
    const seeded = await sessionPool.query(universitySeedSql());
    if (seeded.rowCount) console.log(`[SEED] ${seeded.rowCount} universidades cargadas`);
    await sessionPool.query(universityAcronymBackfillSql());
    const extra = await sessionPool.query(universityExtraSql());
    if (extra.rowCount) console.log(`[SEED] ${extra.rowCount} universidades adicionales cargadas`);
  } catch (err: any) {
    console.warn('[MIGRATION] Could not apply migration:', err.message);
  }

  const server = await registerRoutes(app);
  
  // Initialize NEW presence system
  if (!IS_VERCEL) {
    const { setupPresenceSystem } = await import("./presence-system.js");
    setupPresenceSystem(server, sessionMiddleware);
  }

  // Manejador global de Express (next(err)): responde igual que antes y deja el Error para error_logs.
  app.use(errorHandler);

  // Seed data enabled - create test users for presence testing
  if (app.get("env") === "development") {
    try {
      await seedDatabase();
      console.log("✅ Test users created for presence testing");
    } catch (error) {
      console.log("Database already seeded or error occurred");
    }
    // Pichangas: usuarios, canchas y partidos de prueba (solo desarrollo, idempotente).
    try {
      const { seedMockPichangas } = await import("./mock-pichangas");
      await seedMockPichangas();
      console.log("✅ Mock de pichangas listo (usuarios @pichangas.test, canchas y partidos)");
    } catch (error) {
      console.error("[MOCK] No se pudo crear el mock de pichangas:", error);
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);

  // 404 JSON para endpoints /api no registrados: sin esto caen al catch-all SPA
  // (vite en dev, serveStatic en prod) y devuelven index.html con 200.
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ message: 'Endpoint no encontrado' });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (IS_VERCEL) {
    // El cliente (dist/public) y el respaldo a index.html los resuelve vercel.json; aqui solo queda la API.
  } else if (app.get("env") === "development") {
    await setupVite(app, server, port);
  } else {
    serveStatic(app);
  }

  if (!IS_VERCEL) {
    server.listen({
      port,
      host: "0.0.0.0",
      }, () => {
      log(`serving on port ${port}`);
    });
  }
})();

export { app };

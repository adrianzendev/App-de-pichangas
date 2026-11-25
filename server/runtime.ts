// Deteccion del entorno de ejecucion.
export const IS_VERCEL = Boolean(process.env.VERCEL);
// En Vercel cada arranque en frio ejecutaria las migraciones; solo se corren si RUN_MIGRATIONS=1
// (la base ya esta migrada). Fuera de Vercel siempre corren, como antes.
export const RUN_MIGRATIONS = !IS_VERCEL || process.env.RUN_MIGRATIONS === "1";

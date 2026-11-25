-- Registro de errores del servidor (panel de administracion > Errores). Tabla nueva, aditiva y reversible
-- (DROP TABLE error_logs). La llena server/middleware/error-logger.ts; nada de la app depende de ella.
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/023_error_logs.sql

CREATE TABLE IF NOT EXISTS error_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  level text NOT NULL DEFAULT 'error',      -- 'error' | 'warning' | 'critical'
  message text NOT NULL,
  stack text,
  route varchar,                             -- ruta SIN query string (puede llevar tokens)
  method varchar,
  status text NOT NULL DEFAULT 'pending',    -- 'pending' | 'resolved'
  resolved_at timestamp,
  resolved_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now()
);

-- La lista del panel filtra por estado y nivel y ordena por fecha descendente.
CREATE INDEX IF NOT EXISTS error_logs_status_created_idx ON error_logs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_level_idx ON error_logs (level);

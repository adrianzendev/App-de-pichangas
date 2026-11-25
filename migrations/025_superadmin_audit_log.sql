-- Auditoria de las acciones del super admin y de la impersonacion. Tabla nueva, aditiva y reversible
-- (DROP TABLE superadmin_audit_log). La llena server/superadmin.ts; nada de la app depende de ella.
-- created_at es timestamptz: fecha, hora, minutos y segundos exactos.
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/025_superadmin_audit_log.sql

CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id varchar REFERENCES users(id) ON DELETE SET NULL,          -- el super admin real, aun al impersonar
  action text NOT NULL,                                               -- 'impersonate_start' | 'impersonate_end' | 'request'
  target_user_id varchar REFERENCES users(id) ON DELETE SET NULL,     -- usuario impersonado, si aplica
  detail jsonb,                                                       -- metodo, ruta SIN query string, status
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS superadmin_audit_log_created_idx ON superadmin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS superadmin_audit_log_actor_idx ON superadmin_audit_log (actor_id);

-- Vistas del perfil de un tutor: una fila cada vez que un usuario con sesion abre /tutor/:key (maximo una cada 6 h por tutor y persona;
-- no cuentan el propio tutor, el admin, los agentes ni la impersonacion). Aditiva y reversible (DROP TABLE tutor_profile_views).
-- El servidor tambien la crea al arrancar si falta (server/index.ts).
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/027_tutor_profile_views.sql

CREATE TABLE IF NOT EXISTS tutor_profile_views (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id varchar NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  viewer_id varchar REFERENCES users(id) ON DELETE SET NULL,
  viewed_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutor_profile_views_tutor_idx ON tutor_profile_views (tutor_id, viewed_at DESC)

-- Catalogo de universidades: el usuario elige la suya de esta lista (ya no la escribe a mano) y el admin la mantiene en
-- /dashboard/universities. users.university sigue guardando el NOMBRE. Aditiva y reversible (DROP TABLE universities).
-- El servidor tambien la crea al arrancar si falta (server/index.ts).
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/028_universities.sql

CREATE TABLE IF NOT EXISTS universities (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS universities_name_unique ON universities (lower(name))

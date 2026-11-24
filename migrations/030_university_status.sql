-- Revision de universidades sugeridas por usuarios: 'approved' (catalogo oficial) o 'pending' (esperan aprobacion del admin).
-- Aditiva (las existentes quedan 'approved'). El servidor tambien la agrega al arrancar si falta (server/index.ts).
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/030_university_status.sql

ALTER TABLE universities ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE universities ADD COLUMN IF NOT EXISTS suggested_by varchar

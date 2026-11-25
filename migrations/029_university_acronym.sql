-- Siglas de cada universidad (PUCP, UNMSM…): opcional, se muestran en el panel y en el selector del perfil. Aditiva y reversible
-- (ALTER TABLE universities DROP COLUMN acronym). El servidor tambien la agrega al arrancar si falta (server/index.ts).
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/029_university_acronym.sql

ALTER TABLE universities ADD COLUMN IF NOT EXISTS acronym text

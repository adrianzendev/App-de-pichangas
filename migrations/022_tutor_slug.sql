-- URL amigable para el perfil del tutor: /tutor/olga-perez en vez de /tutor/<uuid>.
-- Aditiva y reversible (DROP INDEX tutors_slug_unique; ALTER TABLE tutors DROP COLUMN slug). Las filas existentes
-- quedan con slug NULL hasta correr scripts/backfill-tutor-slugs.ts; mientras tanto el perfil abre por id.
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/022_tutor_slug.sql

ALTER TABLE tutors ADD COLUMN IF NOT EXISTS slug varchar;

-- Unico; varios NULL conviven (Postgres no los considera iguales).
CREATE UNIQUE INDEX IF NOT EXISTS tutors_slug_unique ON tutors (slug);

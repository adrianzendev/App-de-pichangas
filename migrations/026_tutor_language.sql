-- Idioma principal (nativo) del tutor. Aditiva y reversible (ALTER TABLE tutors DROP COLUMN language).
-- Los tutores de LATAM hispana quedan en 'Español'; el resto en NULL hasta que lo llenen ellos o el admin.
-- Mismos codigos que shared/tutor-language.ts (users.country mezcla ISO-2 e ISO-3).
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/026_tutor_language.sql

ALTER TABLE tutors ADD COLUMN IF NOT EXISTS language text;

UPDATE tutors SET language = 'Español'
WHERE language IS NULL
  AND user_id IN (
    SELECT id FROM users WHERE upper(trim(country)) IN (
      'AR','ARG','BO','BOL','CL','CHL','CO','COL','CR','CRI','CU','CUB','DO','DOM','EC','ECU',
      'SV','SLV','GT','GTM','HN','HND','MX','MEX','NI','NIC','PA','PAN','PY','PRY','PE','PER',
      'PR','PRI','UY','URY','VE','VEN'
    )
  )

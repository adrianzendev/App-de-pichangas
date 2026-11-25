-- Evita cuentas duplicadas por email con distinto case/espacios.
-- Si esto falla con "could not create unique index", correr primero:
--   SELECT lower(trim(email)), array_agg(id), array_agg(email)
--   FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1;
-- y fusionar/eliminar los duplicados antes de reintentar.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_idx ON users (LOWER(TRIM(email)));

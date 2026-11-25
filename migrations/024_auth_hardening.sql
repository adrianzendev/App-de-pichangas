-- Endurecimiento de la autenticacion. Aditiva y reversible; no toca contrasenas existentes.
--  1. users.password ya no tiene valor por defecto ('123456'): una cuenta nueva sin clave queda SIN contrasena local y la
--     define con un enlace de activacion enviado por correo (Resend). Antes toda cuenta creada por el admin la heredaba.
--  2. Token de activacion de un solo uso: se guarda solo el SHA-256 (nunca el token) y vence a las 24 h.
-- Reversion: ALTER TABLE users ALTER COLUMN password SET DEFAULT '123456' (no recomendado);
--            ALTER TABLE users DROP COLUMN activation_token_hash, DROP COLUMN activation_token_expires;
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/024_auth_hardening.sql

ALTER TABLE users ALTER COLUMN password DROP DEFAULT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_token_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_token_expires timestamp;
CREATE INDEX IF NOT EXISTS users_activation_token_idx ON users (activation_token_hash) WHERE activation_token_hash IS NOT NULL;

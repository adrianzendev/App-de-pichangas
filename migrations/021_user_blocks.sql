-- Bloqueo entre usuarios (requisito de App Store 1.2 / Google Play para contenido generado por usuarios).
-- Una fila = blocker_id bloqueo a blocked_id. Mientras exista, no se pueden enviar mensajes en ninguna direccion.
CREATE TABLE IF NOT EXISTS user_blocks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  CHECK (blocker_id <> blocked_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS user_blocks_pair_unique ON user_blocks (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx ON user_blocks (blocked_id);

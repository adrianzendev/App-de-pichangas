-- Pichangas: chat de grupo de cada partido ("Camerino & Coordinacion"). Aditiva.
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/032_match_messages.sql

CREATE TABLE IF NOT EXISTS match_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id varchar NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_messages_match_created_idx ON match_messages (match_id, created_at);

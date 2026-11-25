-- Pichangas Peru: canchas, partidos y jugadores anotados. Aditiva.
-- Uso local: npx tsx --env-file=.env scripts/run-sql-file.ts migrations/031_pichangas.sql

CREATE TABLE IF NOT EXISTS venues (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  district text NOT NULL,
  city text NOT NULL DEFAULT 'Lima',
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  surface text NOT NULL DEFAULT 'grass_sintetico',
  price_per_hour numeric(10,2),
  phone text,
  photos text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venues_district_idx ON venues (city, district);

CREATE TABLE IF NOT EXISTS matches (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id varchar NOT NULL REFERENCES venues(id),
  title text NOT NULL,
  description text,
  starts_at timestamp NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  format text NOT NULL DEFAULT 'futbol_7',
  level text NOT NULL DEFAULT 'recreativo',
  gender text NOT NULL DEFAULT 'mixto',
  max_players integer NOT NULL,
  price_per_player numeric(10,2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'PEN',
  status text NOT NULL DEFAULT 'open',
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS matches_starts_at_idx ON matches (status, starts_at);
CREATE INDEX IF NOT EXISTS matches_venue_idx ON matches (venue_id);
CREATE INDEX IF NOT EXISTS matches_organizer_idx ON matches (organizer_id);

CREATE TABLE IF NOT EXISTS match_players (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id varchar NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmed',
  paid boolean DEFAULT false,
  joined_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS match_players_match_user_unique ON match_players (match_id, user_id);
CREATE INDEX IF NOT EXISTS match_players_user_idx ON match_players (user_id);

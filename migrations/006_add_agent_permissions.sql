ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_permissions text[] DEFAULT '{}';

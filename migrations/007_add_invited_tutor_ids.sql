ALTER TABLE tasks ADD COLUMN IF NOT EXISTS invited_tutor_ids text[] DEFAULT '{}';

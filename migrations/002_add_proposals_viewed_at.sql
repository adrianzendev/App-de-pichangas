-- Task #15: Add proposals_viewed_at column to tasks table
-- Tracks the first time a student viewed the proposals/candidates for their task
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS proposals_viewed_at TIMESTAMP;

-- Migration 004: Add task_audit_logs table for admin content edit tracking
-- Records every admin edit to a task's title, description, or comment for accountability.

CREATE TABLE IF NOT EXISTS task_audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  admin_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_audit_logs_task_id ON task_audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_audit_logs_created_at ON task_audit_logs(created_at);

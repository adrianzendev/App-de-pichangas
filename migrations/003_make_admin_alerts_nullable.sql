-- Migration 003: Make message_id and tutor_id nullable in admin_alerts
-- Required for task-description contact alerts that have no associated chat message or tutor.

ALTER TABLE admin_alerts ALTER COLUMN message_id DROP NOT NULL;
ALTER TABLE admin_alerts ALTER COLUMN tutor_id DROP NOT NULL;

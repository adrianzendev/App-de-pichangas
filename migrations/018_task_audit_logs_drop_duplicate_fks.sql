-- task_audit_logs tenia dos FK por columna (task_id, admin_id): la CASCADE
-- (task_audit_logs_*_users_id_fk / *_tasks_id_fk, la que declara schema.ts) y
-- una NO ACTION (*_fkey) heredada. La NO ACTION bloqueaba el cascade, por eso
-- deleteTask/deleteUser tenian que borrar los logs a mano.
ALTER TABLE task_audit_logs DROP CONSTRAINT IF EXISTS task_audit_logs_task_id_fkey;
ALTER TABLE task_audit_logs DROP CONSTRAINT IF EXISTS task_audit_logs_admin_id_fkey;

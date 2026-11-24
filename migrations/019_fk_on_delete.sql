-- Politicas ON DELETE (auditoria de esquema 2026-10-20). Todas las FK eran NO ACTION.
-- CASCADE: filas derivadas sin valor propio. SET NULL: referencia opcional (quien
-- verifico/resolvio, tutor asignado) que la app ya ponia en NULL a mano.
-- Se mantienen NO ACTION a proposito: pagos, resenas y el resto de FK a users
-- (borrar un pedido o usuario con registros financieros debe fallar, no borrarlos).
DO $$
DECLARE
  r record;
  c text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('candidates','task_id','tasks','CASCADE'),
    ('tutor_viewed_tasks','task_id','tasks','CASCADE'),
    ('chat_rooms','task_id','tasks','CASCADE'),
    ('task_deliveries','task_id','tasks','CASCADE'),
    ('chat_messages','thread_id','chat_threads','CASCADE'),
    ('push_subscriptions','user_id','users','CASCADE'),
    ('tutor_careers','tutor_id','tutors','CASCADE'),
    ('tutor_certifications','tutor_id','tutors','CASCADE'),
    ('tutor_courses','tutor_id','tutors','CASCADE'),
    ('admin_alerts','message_id','chat_messages','SET NULL'),
    ('admin_alerts','reviewed_by','users','SET NULL'),
    ('payment_verifications','verified_by','users','SET NULL'),
    ('task_deliveries','resolved_by','users','SET NULL'),
    ('tutor_certifications','verified_by','users','SET NULL'),
    ('tasks','assigned_tutor_id','users','SET NULL'),
    ('tasks','invited_tutor_id','users','SET NULL')
  ) AS t(tbl, col, ref, act) LOOP
    FOR c IN
      SELECT con.conname FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      WHERE con.contype = 'f' AND con.conrelid = r.tbl::regclass AND a.attname = r.col
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, c);
    END LOOP;
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE %s',
      r.tbl, r.tbl || '_' || r.col || '_fkey', r.col, r.ref, r.act);
  END LOOP;
END $$;

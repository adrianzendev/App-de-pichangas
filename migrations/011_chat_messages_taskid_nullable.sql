-- Permite mensajes directos sin pedido en comun: task_id deja de ser
-- obligatorio en chat_messages.
--
-- IMPORTANTE: cambia una constraint (no es un cambio puramente aditivo) —
-- correr manual/supervisado (scripts/run-sql-file.ts en dev, psql en
-- produccion), NO se agrega al hook automatico post-merge.sh. Mismo
-- criterio de precaucion que 010_backfill_chat_threads.sql.
--
-- Idempotente: DROP NOT NULL es un no-op si la columna ya es nullable.
-- No requiere backfill: no existe ningun valor "vacio" usado como
-- sustituto de NULL en task_id hoy.

ALTER TABLE chat_messages ALTER COLUMN task_id DROP NOT NULL;

-- Mismo motivo: el escaneo de contacto (admin_alerts) tiene que poder
-- registrar alertas de mensajes directos, que ahora pueden no tener task_id.
ALTER TABLE admin_alerts ALTER COLUMN task_id DROP NOT NULL;

-- Limpieza de mantenimiento: borra chat_threads que nunca tuvieron un
-- mensaje real. Pueden existir por bugs ya corregidos (creacion previa a
-- la migracion "no crear thread vacio antes del primer mensaje") o
-- inconsistencias manuales.
--
-- NOT EXISTS en vez de NOT IN: NOT IN con una subconsulta que puede
-- contener NULL (chat_messages.thread_id es nullable) devuelve 0 filas
-- siempre — trampa clasica de SQL. NOT EXISTS no tiene ese problema y usa
-- el indice existente chat_messages_thread_id_created_at_idx (thread_id
-- como primera columna).
--
-- IMPORTANTE: DELETE — correr manual/supervisado (scripts/run-sql-file.ts
-- en dev, psql en produccion), NO va al hook automatico post-merge.sh.
-- Idempotente: re-correrlo no borra nada si ya no quedan hilos vacios.

DELETE FROM chat_threads ct
WHERE NOT EXISTS (
  SELECT 1 FROM chat_messages cm WHERE cm.thread_id = ct.id
);

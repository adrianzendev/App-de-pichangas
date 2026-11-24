-- getChatMessages (storage.ts, ruta legacy GET /api/chat/messages/:taskId/:otherUserId,
-- todavia llamada por routes.ts:3604) filtra por task_id y ordena
-- DESC + LIMIT por created_at. chat_messages_task_id_idx (009) es de una
-- sola columna: sirve el WHERE pero no el ORDER BY, Postgres igual
-- ordena en memoria. getMessagesByThread (modelo de hilo actual) ya
-- tiene su equivalente (thread_id, created_at) -- esto le da lo mismo
-- a la ruta legacy por taskId.
CREATE INDEX IF NOT EXISTS chat_messages_task_id_created_at_idx ON chat_messages (task_id, created_at);

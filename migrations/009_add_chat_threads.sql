-- Paso "expand" de la migracion order-centric -> user-centric de chat.
-- Puramente aditivo: no borra ni renombra ninguna columna existente.
-- chat_messages.task_id se mantiene NOT NULL y funcional para el codigo viejo.
-- El backfill de datos va en 010_backfill_chat_threads.sql (correr aparte,
-- manual/supervisado, no via el hook automatico post-merge.sh).

CREATE TABLE IF NOT EXISTS chat_threads (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id VARCHAR NOT NULL REFERENCES users(id),
  tutor_id VARCHAR NOT NULL REFERENCES users(id),
  pair_key VARCHAR NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_pair_key_unique ON chat_threads (pair_key);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS thread_id VARCHAR REFERENCES chat_threads(id);

CREATE INDEX IF NOT EXISTS chat_messages_thread_id_created_at_idx ON chat_messages (thread_id, created_at);

-- chat_messages nunca tuvo estos indices; se agregan de una vez por ser
-- aditivos y de bajo riesgo (la tabla se filtra por estas columnas en cada
-- consulta de chat hoy, sin ningun indice de soporte).
CREATE INDEX IF NOT EXISTS chat_messages_task_id_idx ON chat_messages (task_id);
CREATE INDEX IF NOT EXISTS chat_messages_sender_receiver_idx ON chat_messages (sender_id, receiver_id);

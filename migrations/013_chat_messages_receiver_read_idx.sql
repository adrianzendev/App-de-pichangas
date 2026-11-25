-- getLastMessagesForAllConversations (storage.ts) filtra por
-- receiver_id = X AND read_at IS NULL para contar no-leidos, y por
-- sender_id = X OR receiver_id = X para traer conversaciones. Los indices
-- existentes de 009_add_chat_threads.sql (sender_id, receiver_id) sirven
-- un lookup por sender_id, no aceleran receiver_id aislado ni el filtro
-- por read_at. Esta funcion corre en cada carga de la lista de
-- conversaciones, para cada usuario -- sin este indice, Postgres hace
-- seq scan a medida que crece chat_messages.
CREATE INDEX IF NOT EXISTS chat_messages_receiver_read_idx ON chat_messages (receiver_id, read_at);

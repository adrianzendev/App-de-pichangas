-- Prevencion activa de contacto privado: columnas aditivas y nullables (no tocan datos existentes).
-- chat_messages: estado de moderacion. El texto ya viene censurado en `message`; el original NO se guarda aqui
-- porque estas filas viajan a los usuarios (API y WebSocket).
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS moderation_status TEXT;
-- admin_alerts: gravedad guardada al crear, accion de moderacion tomada y texto original (solo admin).
ALTER TABLE admin_alerts ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE admin_alerts ADD COLUMN IF NOT EXISTS action_taken TEXT;
ALTER TABLE admin_alerts ADD COLUMN IF NOT EXISTS original_message TEXT;
-- Version previa de esta migracion (solo en bases donde ya se aplico): la columna con el original salia por la API.
ALTER TABLE chat_messages DROP COLUMN IF EXISTS original_message;

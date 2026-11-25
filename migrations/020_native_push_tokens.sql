-- Tokens de notificaciones push nativas (FCM; en iOS FCM entrega por APNs) de la app Capacitor.
-- Tabla aparte de push_subscriptions: Web Push exige endpoint+p256dh+auth, un token FCM no tiene nada de eso.
-- token UNIQUE: un dispositivo pertenece a un solo usuario; al iniciar sesion otra cuenta se reasigna (upsert).
CREATE TABLE IF NOT EXISTS native_push_tokens (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  app_version text,
  created_at timestamp DEFAULT now(),
  last_used timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS native_push_tokens_token_unique ON native_push_tokens (token);
CREATE INDEX IF NOT EXISTS native_push_tokens_user_id_idx ON native_push_tokens (user_id);

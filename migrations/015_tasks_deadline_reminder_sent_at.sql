-- Marca de aviso de vencimiento (24 h o 50% del plazo, lo que ocurra primero).
-- NULL = aun no se avisó; el worker la fija al reclamar el pedido (un aviso por pedido).
-- Se limpia al cambiar el plazo (updateTask / reopenTask). El mismo ALTER corre al
-- arrancar el servidor (server/index.ts), igual que las otras columnas idempotentes.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline_reminder_sent_at timestamp;

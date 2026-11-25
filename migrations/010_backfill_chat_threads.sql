-- Backfill de historial: agrupa chat_messages (hoy aisladas por task_id) en
-- chat_threads continuos por par estudiante-tutor. Requiere que
-- 009_add_chat_threads.sql ya haya corrido.
--
-- IMPORTANTE (ver plan de migracion): correr manual/supervisado con psql,
-- NUNCA directo contra produccion sin antes probar en una copia/staging.
-- Idempotente: seguro de re-correr — no duplica hilos ni reasigna filas
-- que ya tienen thread_id correcto.
--
-- Decisiones aplicadas:
--  - Opcion B: cualquier tutor que haya escrito al menos un mensaje con el
--    estudiante obtiene su propio hilo persistente, no solo el asignado.
--  - Mensajes admin-001 se incluyen dentro del hilo del par cuando se puede
--    derivar un tutor real del mensaje (admin<->tutor). El caso admin<->
--    estudiante sin tutor identificable en el mensaje mismo queda con
--    thread_id NULL (no hay par que formar) — revisar el conteo de estos
--    casos con scripts/chat-migration-report.ts antes de dar la migracion
--    por buena.
--
-- Derivacion del tutor por mensaje (student = tasks.user_id del task del mensaje):
--   sender = student (y receiver no es admin)     -> tutor = receiver
--   receiver = student (y sender no es admin)     -> tutor = sender
--   sender = admin-001 y receiver <> student       -> tutor = receiver
--   receiver = admin-001 y sender <> student       -> tutor = sender
--   admin-001 <-> student directo (sin tutor en el -> tutor = tasks.assigned_tutor_id
--   mensaje, ej. notificaciones de pago/completado)   (si existe; si no, no derivable)
--   cualquier otro caso                             -> no derivable (thread_id queda NULL)

-- 1) Un chat_thread por cada pair_key (student_id, tutor_id) distinto.
INSERT INTO chat_threads (student_id, tutor_id, pair_key)
SELECT DISTINCT
  t.user_id AS student_id,
  tutor.tutor_id,
  LEAST(t.user_id, tutor.tutor_id) || '_' || GREATEST(t.user_id, tutor.tutor_id) AS pair_key
FROM chat_messages cm
JOIN tasks t ON t.id = cm.task_id
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN cm.sender_id = t.user_id AND cm.receiver_id <> 'admin-001' THEN cm.receiver_id
    WHEN cm.receiver_id = t.user_id AND cm.sender_id <> 'admin-001' THEN cm.sender_id
    WHEN cm.sender_id = 'admin-001' AND cm.receiver_id <> t.user_id THEN cm.receiver_id
    WHEN cm.receiver_id = 'admin-001' AND cm.sender_id <> t.user_id THEN cm.sender_id
    WHEN cm.sender_id = 'admin-001' AND cm.receiver_id = t.user_id THEN t.assigned_tutor_id
    WHEN cm.receiver_id = 'admin-001' AND cm.sender_id = t.user_id THEN t.assigned_tutor_id
    ELSE NULL
  END AS tutor_id
) tutor
WHERE tutor.tutor_id IS NOT NULL
ON CONFLICT (pair_key) DO NOTHING;

-- 2) Apuntar cada mensaje a su hilo (solo filas sin thread_id todavia).
-- Nota: dentro de UPDATE ... FROM, la tabla objetivo (cm) no puede aparecer
-- como fuente de un JOIN LATERAL — se referencia directo en el CASE en vez
-- de a traves de una subconsulta lateral.
UPDATE chat_messages cm
SET thread_id = ct.id
FROM tasks t, chat_threads ct
WHERE t.id = cm.task_id
  AND cm.thread_id IS NULL
  AND ct.pair_key = (
    LEAST(
      t.user_id,
      CASE
        WHEN cm.sender_id = t.user_id AND cm.receiver_id <> 'admin-001' THEN cm.receiver_id
        WHEN cm.receiver_id = t.user_id AND cm.sender_id <> 'admin-001' THEN cm.sender_id
        WHEN cm.sender_id = 'admin-001' AND cm.receiver_id <> t.user_id THEN cm.receiver_id
        WHEN cm.receiver_id = 'admin-001' AND cm.sender_id <> t.user_id THEN cm.sender_id
        WHEN cm.sender_id = 'admin-001' AND cm.receiver_id = t.user_id THEN t.assigned_tutor_id
        WHEN cm.receiver_id = 'admin-001' AND cm.sender_id = t.user_id THEN t.assigned_tutor_id
        ELSE NULL
      END
    ) || '_' ||
    GREATEST(
      t.user_id,
      CASE
        WHEN cm.sender_id = t.user_id AND cm.receiver_id <> 'admin-001' THEN cm.receiver_id
        WHEN cm.receiver_id = t.user_id AND cm.sender_id <> 'admin-001' THEN cm.sender_id
        WHEN cm.sender_id = 'admin-001' AND cm.receiver_id <> t.user_id THEN cm.receiver_id
        WHEN cm.receiver_id = 'admin-001' AND cm.sender_id <> t.user_id THEN cm.sender_id
        WHEN cm.sender_id = 'admin-001' AND cm.receiver_id = t.user_id THEN t.assigned_tutor_id
        WHEN cm.receiver_id = 'admin-001' AND cm.sender_id = t.user_id THEN t.assigned_tutor_id
        ELSE NULL
      END
    )
  );

-- 3) Refrescar el cache de ultimo mensaje por hilo.
UPDATE chat_threads ct
SET last_message = sub.message,
    last_message_at = sub.created_at
FROM (
  SELECT DISTINCT ON (thread_id) thread_id, message, created_at
  FROM chat_messages
  WHERE thread_id IS NOT NULL
  ORDER BY thread_id, created_at DESC
) sub
WHERE ct.id = sub.thread_id;

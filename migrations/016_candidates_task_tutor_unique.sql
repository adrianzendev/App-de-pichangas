-- createCandidate (storage.ts) hace SELECT y luego INSERT: dos POST
-- simultaneos del mismo tutor podian crear postulaciones duplicadas.
-- Este indice lo impide a nivel de base. Fallara si ya hay duplicados:
-- revisar antes con
--   SELECT task_id, tutor_id, count(*) FROM candidates GROUP BY 1,2 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS candidates_task_tutor_unique ON candidates (task_id, tutor_id);

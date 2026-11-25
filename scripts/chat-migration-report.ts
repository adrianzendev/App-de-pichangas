// Dry-run, solo lectura. No escribe nada. Correr ANTES de 010_backfill_chat_threads.sql
// contra una copia/staging de los datos reales, nunca contra produccion en vivo.
//
// Uso: npx tsx --env-file=.env scripts/chat-migration-report.ts
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";

async function main() {
  const totalMessages = await db.execute(sql`SELECT COUNT(*)::int AS n FROM chat_messages`);
  console.log(`Total chat_messages hoy: ${(totalMessages.rows[0] as any).n}`);

  const adminMessages = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM chat_messages
    WHERE sender_id = 'admin-001' OR receiver_id = 'admin-001'
  `);
  console.log(`Mensajes con admin-001 (sender o receiver): ${(adminMessages.rows[0] as any).n}`);

  const orphanTask = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM chat_messages cm
    LEFT JOIN tasks t ON t.id = cm.task_id
    WHERE t.id IS NULL
  `);
  console.log(`Mensajes cuyo task_id no resuelve a un task (deberia ser 0): ${(orphanTask.rows[0] as any).n}`);

  // Misma derivacion de tutor que usa 010_backfill_chat_threads.sql
  const pairCounts = await db.execute(sql`
    WITH derived AS (
      SELECT
        cm.id AS message_id,
        t.user_id AS student_id,
        CASE
          WHEN cm.sender_id = t.user_id AND cm.receiver_id <> 'admin-001' THEN cm.receiver_id
          WHEN cm.receiver_id = t.user_id AND cm.sender_id <> 'admin-001' THEN cm.sender_id
          WHEN cm.sender_id = 'admin-001' AND cm.receiver_id <> t.user_id THEN cm.receiver_id
          WHEN cm.receiver_id = 'admin-001' AND cm.sender_id <> t.user_id THEN cm.sender_id
          WHEN cm.sender_id = 'admin-001' AND cm.receiver_id = t.user_id THEN t.assigned_tutor_id
          WHEN cm.receiver_id = 'admin-001' AND cm.sender_id = t.user_id THEN t.assigned_tutor_id
          ELSE NULL
        END AS tutor_id,
        cm.task_id
      FROM chat_messages cm
      JOIN tasks t ON t.id = cm.task_id
    )
    SELECT
      COUNT(*) FILTER (WHERE tutor_id IS NULL)::int AS undeliverable_pair_count,
      COUNT(DISTINCT LEAST(student_id, tutor_id) || '_' || GREATEST(student_id, tutor_id))
        FILTER (WHERE tutor_id IS NOT NULL)::int AS distinct_pairs,
      COUNT(DISTINCT (LEAST(student_id, tutor_id) || '_' || GREATEST(student_id, tutor_id), task_id))
        FILTER (WHERE tutor_id IS NOT NULL)::int AS distinct_pair_task_combos
    FROM derived
  `);
  const pc = pairCounts.rows[0] as any;
  console.log(`Mensajes sin par derivable (quedaran con thread_id NULL): ${pc.undeliverable_pair_count}`);
  console.log(`chat_threads que se crearian (pares distintos): ${pc.distinct_pairs}`);
  console.log(`Combinaciones par+task distintas: ${pc.distinct_pair_task_combos}`);
  console.log(
    `Pares con mensajes de mas de un pedido (fusion real de historial): ` +
    `${pc.distinct_pair_task_combos - pc.distinct_pairs} combinaciones extra sobre ${pc.distinct_pairs} pares`
  );

  // Mensajes cuyo tutor derivado no aparece ni como assignedTutorId ni como candidate del task
  const suspicious = await db.execute(sql`
    WITH derived AS (
      SELECT
        cm.id AS message_id,
        cm.task_id,
        t.user_id AS student_id,
        t.assigned_tutor_id,
        CASE
          WHEN cm.sender_id = t.user_id AND cm.receiver_id <> 'admin-001' THEN cm.receiver_id
          WHEN cm.receiver_id = t.user_id AND cm.sender_id <> 'admin-001' THEN cm.sender_id
          WHEN cm.sender_id = 'admin-001' AND cm.receiver_id <> t.user_id THEN cm.receiver_id
          WHEN cm.receiver_id = 'admin-001' AND cm.sender_id <> t.user_id THEN cm.sender_id
          WHEN cm.sender_id = 'admin-001' AND cm.receiver_id = t.user_id THEN t.assigned_tutor_id
          WHEN cm.receiver_id = 'admin-001' AND cm.sender_id = t.user_id THEN t.assigned_tutor_id
          ELSE NULL
        END AS tutor_id
      FROM chat_messages cm
      JOIN tasks t ON t.id = cm.task_id
    )
    SELECT COUNT(*)::int AS n
    FROM derived d
    WHERE d.tutor_id IS NOT NULL
      AND d.tutor_id IS DISTINCT FROM d.assigned_tutor_id
      AND NOT EXISTS (
        SELECT 1 FROM candidates c WHERE c.task_id = d.task_id AND c.tutor_id = d.tutor_id
      )
  `);
  console.log(
    `Mensajes cuyo tutor derivado no es el asignado NI aparece en candidates ` +
    `(posible dato a investigar antes del backfill): ${(suspicious.rows[0] as any).n}`
  );

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

// Solo lectura. Correr DESPUES de 010_backfill_chat_threads.sql (staging primero,
// luego produccion) para confirmar los invariantes del plan de migracion.
// Termina con exit code 1 si algun invariante falla.
//
// Uso: npx tsx --env-file=.env scripts/chat-migration-verify.ts [totalMessagesAntes]
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";

async function main() {
  let ok = true;
  const check = (label: string, pass: boolean, detail?: string) => {
    console.log(`[${pass ? "OK" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
    if (!pass) ok = false;
  };

  const totalNow = Number((await db.execute(sql`SELECT COUNT(*)::int AS n FROM chat_messages`)).rows[0].n);
  const baseline = process.argv[2] ? Number(process.argv[2]) : null;
  if (baseline !== null) {
    check("Conteo total de chat_messages sin cambios", totalNow === baseline, `antes=${baseline} ahora=${totalNow}`);
  } else {
    console.log(`(sin baseline pasado por argv; conteo actual: ${totalNow})`);
  }

  const missingThread = Number(
    (
      await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM chat_messages
        WHERE thread_id IS NULL AND sender_id <> 'admin-001' AND receiver_id <> 'admin-001'
      `)
    ).rows[0].n
  );
  check("Cero mensajes no-admin con thread_id NULL", missingThread === 0, `encontrados=${missingThread}`);

  // ct.tutor_id coincide con sender/receiver en el caso normal; en mensajes
  // admin<->estudiante (sin tutor en el mensaje mismo) el hilo usa el
  // fallback tasks.assigned_tutor_id (ver 010_backfill_chat_threads.sql) —
  // ambos casos son validos.
  const mismatchedPair = Number(
    (
      await db.execute(sql`
        SELECT COUNT(*)::int AS n
        FROM chat_messages cm
        JOIN chat_threads ct ON ct.id = cm.thread_id
        JOIN tasks t ON t.id = cm.task_id
        WHERE cm.thread_id IS NOT NULL
          AND ct.student_id = t.user_id
          AND ct.tutor_id <> cm.sender_id
          AND ct.tutor_id <> cm.receiver_id
          AND NOT (
            (cm.sender_id = 'admin-001' OR cm.receiver_id = 'admin-001')
            AND ct.tutor_id = t.assigned_tutor_id
          )
      `)
    ).rows[0].n
  );
  check(
    "Cada mensaje pertenece a un hilo cuyo (student_id, tutor_id) coincide con su par derivado",
    mismatchedPair === 0,
    `discrepancias=${mismatchedPair}`
  );

  const staleCache = Number(
    (
      await db.execute(sql`
        WITH latest AS (
          SELECT DISTINCT ON (thread_id) thread_id, message, created_at
          FROM chat_messages
          WHERE thread_id IS NOT NULL
          ORDER BY thread_id, created_at DESC
        )
        SELECT COUNT(*)::int AS n
        FROM chat_threads ct
        JOIN latest l ON l.thread_id = ct.id
        WHERE ct.last_message IS DISTINCT FROM l.message
           OR ct.last_message_at IS DISTINCT FROM l.created_at
      `)
    ).rows[0].n
  );
  check("chat_threads.last_message/last_message_at coincide con el mensaje mas reciente real", staleCache === 0, `desincronizados=${staleCache}`);

  const dupPairKey = Number(
    (
      await db.execute(sql`
        SELECT COUNT(*)::int AS n FROM (
          SELECT pair_key FROM chat_threads GROUP BY pair_key HAVING COUNT(*) > 1
        ) d
      `)
    ).rows[0].n
  );
  check("Sin pair_key duplicados en chat_threads", dupPairKey === 0, `duplicados=${dupPairKey}`);

  await pool.end();
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

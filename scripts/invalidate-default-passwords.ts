// Pone password = NULL a las cuentas cuya contrasena local es la de por defecto ("123456"). El login ya rechaza esa clave
// (server/auth-security.ts), asi que estas cuentas hoy no pueden entrar con ella; anularla ademas quita de la base una
// credencial conocida. La persona entra con Google o define su clave con el enlace de "Olvidaste tu contraseña?".
// Por defecto es DRY-RUN: solo cuenta, no escribe nada.
// Uso: npx tsx --env-file=.env scripts/invalidate-default-passwords.ts [--apply]
import { eq, isNotNull } from "drizzle-orm";
import { db, pool } from "../server/db";
import { users } from "../shared/schema";
import { DEFAULT_PASSWORD } from "../server/auth-security";
import { verifyPassword } from "../server/password";

const APPLY = process.argv.includes("--apply");

async function main() {
  const rows = await db.select({ id: users.id, password: users.password, role: users.role }).from(users).where(isNotNull(users.password));
  const withDefault = rows.filter((r) => verifyPassword(DEFAULT_PASSWORD, r.password!));
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"}: ${rows.length} cuentas con contraseña local, ${withDefault.length} con la clave por defecto`);
  if (!APPLY) { console.log("Usa --apply para dejarlas sin contraseña local (NULL)."); return; }
  let done = 0;
  for (const r of withDefault) {
    // Solo si la clave sigue siendo la de por defecto: no pisa una que la persona haya definido mientras tanto.
    const [row] = await db.select({ password: users.password }).from(users).where(eq(users.id, r.id));
    if (row?.password && verifyPassword(DEFAULT_PASSWORD, row.password)) {
      await db.update(users).set({ password: null }).where(eq(users.id, r.id));
      done++;
    }
  }
  console.log(`${done} cuentas dejadas sin contraseña local.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());

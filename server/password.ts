import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt (nativo de Node, sin dependencia). Formato: scrypt$<salt hex>$<hash hex>.
const PREFIX = "scrypt$";

export const isHashed = (stored: string) => stored.startsWith(PREFIX);

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  return `${PREFIX}${salt.toString("hex")}$${scryptSync(plain, salt, 64).toString("hex")}`;
}

// Acepta tambien contrasenas viejas en texto plano (sin prefijo): el login las
// re-guarda con hash al primer acceso exitoso.
export function verifyPassword(plain: string, stored: string): boolean {
  if (typeof plain !== "string") return false;
  if (!isHashed(stored)) return plain === stored;
  const [, salt, hash] = stored.split("$");
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(plain, Buffer.from(salt, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

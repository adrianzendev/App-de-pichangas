// Ejecutar: npx tsx --test tests/auth-security.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVATION_TTL_MS, DEFAULT_PASSWORD, DUMMY_PASSWORD_HASH, GENERIC_LOGIN_ERROR, hashActivationToken,
  isActivationTokenShape, newActivationToken, passwordProblem,
} from "../server/auth-security";
import { hashPassword, verifyPassword } from "../server/password";

test("la clave por defecto y las comunes no se aceptan", () => {
  for (const weak of [DEFAULT_PASSWORD, "12345678", "111111", "Password", "QWERTY", "aaaaaaaa", "miltareas"]) {
    assert.ok(passwordProblem(weak), weak);
  }
});

test("largo y tipo: minimo 6, maximo 200, solo texto", () => {
  assert.match(passwordProblem("abc12") ?? "", /al menos 6/);
  assert.ok(passwordProblem("x".repeat(201)));
  for (const bad of [undefined, null, 123456, {}, ["abcdef"]]) assert.ok(passwordProblem(bad));
});

test("claves razonables si se aceptan", () => {
  for (const ok of ["tutor-2026!", "mi clave larga con espacios", "Zorro#Azul9", "abcdef"]) assert.equal(passwordProblem(ok), null, ok);
});

test("token de activacion: 64 hex, solo se guarda el SHA-256 y vence en 24 h", () => {
  const now = Date.UTC(2026, 9, 21, 12, 0, 0);
  const { token, hash, expires } = newActivationToken(now);
  assert.ok(isActivationTokenShape(token));
  assert.equal(hash, hashActivationToken(token));
  assert.notEqual(hash, token);
  assert.equal(hash.length, 64);
  assert.equal(expires.getTime() - now, ACTIVATION_TTL_MS);
  assert.notEqual(newActivationToken().token, newActivationToken().token); // no se repite
});

test("isActivationTokenShape rechaza lo que no es un token", () => {
  for (const bad of ["", "abc", "g".repeat(64), "A".repeat(64), "a".repeat(63), "a".repeat(65), null, undefined, 123, {}]) {
    assert.equal(isActivationTokenShape(bad), false, String(bad));
  }
});

test("el hash de relleno es valido (el login gasta el mismo tiempo con cuentas inexistentes) y no acepta la clave por defecto", () => {
  assert.equal(verifyPassword("cualquiera", DUMMY_PASSWORD_HASH), false);
  assert.equal(verifyPassword(DEFAULT_PASSWORD, DUMMY_PASSWORD_HASH), false);
  assert.equal(verifyPassword("tutor-2026!", hashPassword("tutor-2026!")), true);
});

test("un unico mensaje de login fallido", () => {
  assert.equal(GENERIC_LOGIN_ERROR, "Correo o contraseña incorrectos");
});

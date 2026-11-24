// Ejecutar: npx tsx --test tests/error-logger.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { redact, routeOf, ROUTE_MAX } from "../server/middleware/redact";

test("redact: correos, telefonos y numeros largos", () => {
  assert.equal(redact("fallo al enviar a juan.perez@gmail.com"), "fallo al enviar a [email]");
  assert.equal(redact("whatsapp 51935436864 no valido"), "whatsapp [num] no valido");
  assert.equal(redact("pedido 12345678 ok"), "pedido 12345678 ok"); // 8 digitos: no es un telefono
});

test("redact: JWT, secretos y cadenas de conexion", () => {
  assert.equal(redact("auth eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc-DEF_123 expirado"), "auth [jwt] expirado");
  assert.equal(redact("password=hunter2 fallo"), "password=[redacted] fallo");
  assert.equal(redact('{"token": "abc123", "id": 5}'), '{"token": [redacted], "id": 5}');
  assert.equal(redact("connect postgresql://user:pw@host/db?sslmode=require failed"), "connect [db-url] failed");
  assert.match(redact("Authorization: Bearer abc.def.ghi"), /Authorization: \[redacted\]/);
});

test("redact: un stack normal no se altera (lineas y columnas no son telefonos)", () => {
  const stack = "Error: boom\n    at handler (/app/server/routes.ts:1234:56)\n    at Layer.handle (node_modules/express/lib/router/layer.js:95:5)";
  assert.equal(redact(stack), stack);
});

test("routeOf: sin query string ni hash, y con tope de largo", () => {
  assert.equal(routeOf("/api/auth/reset?token=abc123&x=1"), "/api/auth/reset");
  assert.equal(routeOf("/api/tutors/olga-perez#perfil"), "/api/tutors/olga-perez");
  assert.equal(routeOf("/" + "a".repeat(1000)).length, ROUTE_MAX);
});

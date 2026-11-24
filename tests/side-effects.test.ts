import { test } from "node:test";
import assert from "node:assert/strict";
import { sideEffectsEnabledFor } from "../server/side-effects";

// Produccion (Railway) no define ninguna variable nueva: NODE_ENV=production basta.
test("produccion: encendido sin configurar nada", () => {
  assert.equal(sideEffectsEnabledFor({ NODE_ENV: "production" }), true);
});

test("DISABLE_SIDE_EFFECTS=1 solo apaga", () => {
  assert.equal(sideEffectsEnabledFor({ NODE_ENV: "production", DISABLE_SIDE_EFFECTS: "1" }), false);
  assert.equal(sideEffectsEnabledFor({ NODE_ENV: "production", DISABLE_SIDE_EFFECTS: "0" }), true);
});

test("fuera de produccion: siempre apagado, aunque haya claves o variables", () => {
  for (const NODE_ENV of ["development", "test", "Production", "", undefined]) {
    assert.equal(sideEffectsEnabledFor({ NODE_ENV, RESEND_API_KEY: "x", DISABLE_SIDE_EFFECTS: "0" } as NodeJS.ProcessEnv), false, String(NODE_ENV));
  }
});

// Ejecutar: npx tsx --test tests/country-timezone.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { timezoneForCountry } from "../shared/country-timezone";

test("timezoneForCountry: ISO-2, ISO-3 y mayusculas", () => {
  assert.equal(timezoneForCountry("VE"), "America/Caracas");
  assert.equal(timezoneForCountry("VEN"), "America/Caracas");
  assert.equal(timezoneForCountry(" pe "), "America/Lima");
});

test("timezoneForCountry: desconocido o vacio = null", () => {
  assert.equal(timezoneForCountry("XX"), null);
  assert.equal(timezoneForCountry(""), null);
  assert.equal(timezoneForCountry(null), null);
});

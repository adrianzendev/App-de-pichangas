// Ejecutar: npx tsx --test tests/completed-count.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCompletedCount } from "../shared/completed-count";

test("formatCompletedCount: exacto bajo 10", () => {
  assert.equal(formatCompletedCount(0), "0");
  assert.equal(formatCompletedCount(9), "9");
});

test("formatCompletedCount: Más de N desde 10", () => {
  assert.equal(formatCompletedCount(10), "Más de 10");
  assert.equal(formatCompletedCount(24), "Más de 10");
  assert.equal(formatCompletedCount(25), "Más de 25");
  assert.equal(formatCompletedCount(99), "Más de 50");
  assert.equal(formatCompletedCount(1280), "Más de 1000");
});

test("formatCompletedCount: valores raros", () => {
  assert.equal(formatCompletedCount(-3), "0");
  assert.equal(formatCompletedCount(NaN), "0");
});

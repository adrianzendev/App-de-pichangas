// Ejecutar: npx tsx --test tests/delivery-stats.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeDeliveries } from "../server/delivery-stats";

const d = (iso: string) => new Date(iso);

test("summarizeDeliveries: a tiempo, tarde, promedio y mediana", () => {
  const [s] = summarizeDeliveries([
    { tutorId: "t1", assignedAt: d("2026-01-01T00:00:00Z"), deadline: d("2026-01-02T00:00:00Z"), deliveredAt: d("2026-01-01T10:00:00Z") },
    { tutorId: "t1", assignedAt: d("2026-01-01T00:00:00Z"), deadline: d("2026-01-02T00:00:00Z"), deliveredAt: d("2026-01-02T12:00:00Z") },
    { tutorId: "t1", assignedAt: d("2026-01-01T00:00:00Z"), deadline: d("2026-01-05T00:00:00Z"), deliveredAt: d("2026-01-02T00:00:00Z") },
  ]);
  assert.equal(s.delivered, 3);
  assert.equal(s.onTime, 2);
  assert.equal(s.late, 1);
  assert.equal(s.onTimePct, 66.7);
  assert.equal(s.avgHours, 23.3); // (10 + 36 + 24) / 3
  assert.equal(s.medianHours, 24);
});

test("summarizeDeliveries: separa tutores y no da horas negativas", () => {
  const out = summarizeDeliveries([
    { tutorId: "a", assignedAt: d("2026-01-02T00:00:00Z"), deadline: d("2026-01-03T00:00:00Z"), deliveredAt: d("2026-01-01T00:00:00Z") },
    { tutorId: "b", assignedAt: d("2026-01-01T00:00:00Z"), deadline: d("2026-01-03T00:00:00Z"), deliveredAt: d("2026-01-01T02:00:00Z") },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out.find((s) => s.tutorId === "a")!.avgHours, 0);
  assert.equal(out.find((s) => s.tutorId === "b")!.avgHours, 2);
});

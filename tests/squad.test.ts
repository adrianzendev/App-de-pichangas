import { test } from "node:test";
import assert from "node:assert/strict";
import { seatNumber, squadOf } from "../client/src/lib/squad.ts";

const player = (userId: string, guests = 0, status: "confirmed" | "waitlist" = "confirmed") =>
  ({ userId, name: userId, avatar: null, status, paid: true, guests });

const match = {
  organizerId: "org",
  players: [player("org", 2), player("ana"), player("beto", 2), player("carla", 0, "waitlist"), player("dani")],
};

test("el organizador no ocupa cupo ni aparece en la plantilla", () => {
  const { players } = squadOf(match);
  assert.deepEqual(players.map((p) => p.userId), ["ana", "beto", "dani"]);
});

test("los acompañantes ocupan cupos extra", () => {
  const { seatOf, nextSeat } = squadOf(match);
  assert.deepEqual(seatOf, [1, 2, 5]);
  assert.equal(nextSeat, 6);
});

test("seatNumber: 0 para organizador, suplente y desconocido", () => {
  assert.equal(seatNumber(match, "org"), 0);
  assert.equal(seatNumber(match, "carla"), 0);
  assert.equal(seatNumber(match, "nadie"), 0);
  assert.equal(seatNumber(match, "beto"), 2);
});

test("partido vacio", () => {
  assert.deepEqual(squadOf({ organizerId: "org", players: [player("org")] }), { players: [], seatOf: [], nextSeat: 1 });
});

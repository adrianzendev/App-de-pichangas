import type { MatchPlayer } from "@/lib/pichangas";

// Reglas de la plantilla (sin React ni red, para poder probarlas). El organizador NO ocupa cupo: tiene su propia ficha y
// el servidor no lo cuenta. Cada acompañante ocupa un cupo extra de quien lo inscribio.

export interface Squad {
  /** Jugadores confirmados, sin el organizador, en orden de inscripcion. */
  players: MatchPlayer[];
  /** Numero de cupo de cada jugador (1 = primero; los acompañantes ocupan los siguientes). */
  seatOf: number[];
  /** Primer numero de cupo libre. */
  nextSeat: number;
}

export function squadOf(match: { organizerId: string; players: MatchPlayer[] }): Squad {
  const players = match.players.filter((p) => p.status === "confirmed" && p.userId !== match.organizerId);
  let nextSeat = 1;
  const seatOf = players.map((p) => {
    const start = nextSeat;
    nextSeat += 1 + p.guests;
    return start;
  });
  return { players, seatOf, nextSeat };
}

/** Numero de cupo de un jugador en la plantilla; 0 si es suplente, organizador o no esta anotado. */
export function seatNumber(match: { organizerId: string; players: MatchPlayer[] }, userId: string): number {
  const { players, seatOf } = squadOf(match);
  const i = players.findIndex((p) => p.userId === userId);
  return i < 0 ? 0 : seatOf[i];
}

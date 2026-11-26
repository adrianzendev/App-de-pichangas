import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NightBadge } from "@/components/pichangas/night-ui";
import { HoldCountdown } from "@/components/pichangas/hold-countdown";
import { PlayerRow } from "@/components/pichangas/player-row";
import { cn } from "@/lib/utils";
import type { MatchPlayer } from "@/lib/pichangas";

/**
 * El boton de un cupo que se esta separando ("Separar ahora" / "✓ Separado"). UNO solo para los cupos libres y para los mios
 * ya reservados: asi los cupos que voy a pagar se ven identicos. `readOnly` = ya esta separado y no se cambia aqui.
 */
function SeatButton({ picked, readOnly, disabled, onClick }: { picked: boolean; readOnly?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <Button
      variant="pitch-outline"
      size="compact"
      aria-pressed={picked}
      className={cn("shrink-0", readOnly && "pointer-events-none")}
      tabIndex={readOnly ? -1 : undefined}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      {picked ? <><Check className="size-icon-md" aria-hidden /> Separado</> : "Separar ahora"}
    </Button>
  );
}

export interface SquadListProps {
  /** Jugadores confirmados, sin el organizador (tiene su propia ficha). */
  players: MatchPlayer[];
  /** Numero de cupo de cada jugador (los invitados ocupan cupos extra). */
  seatOf: number[];
  /** Primer numero de cupo libre. */
  nextSeat: number;
  maxPlayers: number;
  confirmedCount: number;
  /** Cupos libres. */
  left: number;
  currentUserId?: string;
  /** Partido cancelado o terminado: no se muestran cupos libres. */
  cancelled?: boolean;
  /** Puede tomar cupos (no anotado, o anotado sin pagar): cada cupo libre se puede marcar con "Separar ahora". */
  canJoin?: boolean;
  /** Indices (0 = primer cupo libre) de los cupos libres marcados; se pueden marcar varios. */
  selected?: number[];
  /** Mi cupo (y los de mis acompañantes) esta reservado sin pagar: se paga junto con los marcados, asi que se ve marcado igual. */
  mineHeld?: boolean;
  onToggle?: (freeIndex: number) => void;
  /** Se llego al maximo de cupos: los libres sin marcar quedan deshabilitados. */
  limitReached?: boolean;
  busy?: boolean;
  className?: string;
}

// Bloque "Plantilla": titulo + contador, filas de jugadores, cupos libres y "Faltan N jugadores".
export function SquadList({
  players, seatOf, nextSeat, maxPlayers, confirmedCount, left, currentUserId,
  cancelled, canJoin, selected = [], mineHeld, onToggle, limitReached, busy, className,
}: SquadListProps) {
  const freeCount = cancelled ? 0 : left;
  // Posicion de cada fila en la lista (para escalonar la animacion): los acompañantes tambien cuentan.
  const rowIndex = (i: number) => seatOf[i] - 1;
  return (
    <section className={cn("space-y-4", className)} aria-label="Plantilla">
      <div className="flex items-baseline justify-between">
        <h2 className="text-subheading font-bold uppercase text-night-text">Plantilla</h2>
        <p className="text-label font-bold text-night-text">{confirmedCount} de {maxPlayers}</p>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        {players.flatMap((p, i) => {
          // Mis cupos reservados (el mio y los de mis acompañantes) se pagan juntos con los marcados: mismo texto y mismo boton.
          const mine = !!mineHeld && p.userId === currentUserId;
          // Estado de pago de la fila (y de sus acompañantes: pagan juntos): Pagado, o Reservado con la cuenta regresiva del plazo.
          const payBadge = p.paid
            ? <NightBadge tone="pitch" size="sm">Pagado</NightBadge>
            : p.holdExpiresAt ? <NightBadge tone="muted" size="sm">Reservado · <HoldCountdown iso={p.holdExpiresAt} /></NightBadge> : undefined;
          return [
            <PlayerRow
              key={p.userId}
              name={p.name}
              avatar={p.avatar}
              isMe={p.userId === currentUserId}
              number={seatOf[i]}
              index={rowIndex(i)}
              highlight={mine}
              selected={mine}
              action={mine
                ? <SeatButton picked readOnly />
                : payBadge}
            />,
            // Cada acompañante ocupa un cupo propio: sin su fila la numeracion saltaria (3 -> 9) y parecerian jugadores perdidos.
            ...Array.from({ length: p.guests }, (_, g) => (
              <PlayerRow
                key={`${p.userId}-guest-${g}`}
                name={p.guestNames?.[g]?.trim() || `Acompañante de ${p.name.split(" ")[0]}`}
                placeholder
                muted
                highlight={mine}
                selected={mine}
                number={seatOf[i] + g + 1}
                index={rowIndex(i) + g + 1}
                action={mine ? <SeatButton picked readOnly /> : payBadge}
              />
            )),
          ];
        })}
        {/* Todos los cupos libres son iguales: si puedes tomar cupos, cada uno se marca con "Separar ahora" (varios a la vez). */}
        {Array.from({ length: freeCount }, (_, i) => {
          const showJoin = !!canJoin;
          const picked = selected.includes(i);
          const blocked = !!limitReached && !picked;
          return (
            <PlayerRow
              key={`free-${i}`}
              number={nextSeat + i}
              index={nextSeat - 1 + i}
              name="Lugar libre"
              placeholder
              highlight={showJoin}
              onSelect={showJoin && !busy && !blocked ? () => onToggle?.(i) : undefined}
              className={blocked ? "opacity-60" : undefined}
              title={blocked ? "Máximo de cupos por persona" : undefined}
              selected={picked}
              action={showJoin ? <SeatButton picked={picked} disabled={busy || blocked} onClick={() => onToggle?.(i)} /> : undefined}
            />
          );
        })}
      </ul>
    </section>
  );
}

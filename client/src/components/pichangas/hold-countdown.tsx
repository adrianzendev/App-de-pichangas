import { useEffect, useState } from "react";

// Cuenta regresiva de una reserva sin pagar ("08:32"). Sigue el limite que fija el servidor (holdExpiresAt) y llega a 00:00 sin pasarse.
function secondsLeft(iso: string) {
  return Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 1000));
}

export function useSecondsLeft(iso: string) {
  const [left, setLeft] = useState(() => secondsLeft(iso));
  useEffect(() => {
    const tick = () => setLeft(secondsLeft(iso));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  return left;
}

export const formatMinutes = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** "08:32" que se actualiza cada segundo. Cifras de ancho fijo para que el texto no baile. */
export function HoldCountdown({ iso, className }: { iso: string; className?: string }) {
  const left = useSecondsLeft(iso);
  return <span className={className} style={{ fontVariantNumeric: "tabular-nums" }} role="timer" aria-label={`Quedan ${formatMinutes(left)} para pagar`}>{formatMinutes(left)}</span>;
}

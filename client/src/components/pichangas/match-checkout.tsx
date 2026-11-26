import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Check, Clock, ExternalLink, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NightInput } from "@/components/pichangas/night-controls";
import { NightEmpty, PitchButton } from "@/components/pichangas/night-ui";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PLAY_ROUTES } from "@/lib/routes";
import { spotsLeft, useJoinLeave, useMatch } from "@/lib/pichangas";

// ───────────── DATOS DE PRUEBA ─────────────
// El cobro todavia no existe: no hay pasarela, comision real ni cupones. Estas cifras y el "pago" son simulados;
// al confirmar solo se marca el cupo como pagado (join con paid: true). Reemplazar por la pasarela cuando se integre.
// El plazo para pagar es real: al reservar, el servidor guarda holdExpiresAt (10 min) y libera el cupo si no se paga a tiempo.
const MOCK_YAPE_PHONE = "987 654 321";
const LOCK_SECONDS = 10 * 60; // plazo local mientras el servidor no responde con su limite

const money = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * Cuenta regresiva para pagar: "09:42". Sigue el limite que fija el servidor (holdExpiresAt de la reserva); mientras no llega
 * usa un plazo local de `fallbackSeconds`. Una vez visto el limite del servidor no se reemplaza (si vence y la reserva se
 * libera, el contador se queda en 0 en vez de reiniciarse). Al llegar a 0 queda en 0.
 */
function useDeadlineCountdown(deadlineIso: string | undefined, fallbackSeconds: number) {
  const [fallbackEnd] = useState(() => Date.now() + fallbackSeconds * 1000);
  const serverEnd = useRef<number | null>(null);
  if (deadlineIso) serverEnd.current = Date.parse(deadlineIso);
  const end = serverEnd.current ?? fallbackEnd;
  const [left, setLeft] = useState(() => Math.max(0, Math.round((end - Date.now()) / 1000)));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [end]);
  return left;
}

interface MatchCheckoutViewProps {
  matchId: string;
  me: { id: string; name: string };
}

// Confirmar y pagar (tema Pichanga Black), al minimo: celular y codigo de Yape, el total y el boton.
// Pago simulado: ver "DATOS DE PRUEBA" arriba.
export function MatchCheckoutView({ matchId, me }: MatchCheckoutViewProps) {
  const [, setLocation] = useLocation();
  const { data: match, isLoading, isError, refetch } = useMatch(matchId);
  const { join } = useJoinLeave(matchId);
  const mineHold = match?.players.find((p) => p.userId === me.id)?.holdExpiresAt ?? undefined;
  const lockLeft = useDeadlineCountdown(mineHold, LOCK_SECONDS);

  // Entrar directo al pago (sin pasar por el detalle): los cupos se reservan aqui, para que el plazo sea real.
  const holdAsked = useRef(false);
  useEffect(() => {
    if (!match || holdAsked.current) return;
    if (match.players.some((p) => p.userId === me.id)) return;
    if (spotsLeft(match) === 0 || match.status === "cancelled" || match.status === "finished") return;
    holdAsked.current = true;
    const wanted = Math.min(Math.max(Number(new URLSearchParams(window.location.search).get("cupos")) || 1, 1), Math.max(1, spotsLeft(match)), 6);
    join.mutate({ paid: false, guests: wanted - 1 });
  }, [match, me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al vencer el plazo el servidor ya libero la reserva: se refresca para mostrar el estado real.
  useEffect(() => { if (lockLeft === 0) void refetch(); }, [lockLeft === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const [phone, setPhone] = useState(MOCK_YAPE_PHONE);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4" aria-busy="true">
        <Skeleton className="h-10 w-full bg-night-container" />
        <Skeleton className="h-48 w-full bg-night-container" />
        <Skeleton className="h-64 w-full bg-night-container" />
      </div>
    );
  }
  if (isError || !match) {
    return (
      <div className="p-4">
        <NightEmpty
          icon={<Search className="size-icon-empty" />}
          title="No pudimos cargar este partido"
          description="Revisa tu conexión e inténtalo de nuevo."
          action={<PitchButton onClick={() => refetch()}>Reintentar</PitchButton>}
        />
      </div>
    );
  }

  const back = (label: string, to: string) => (
    <PitchButton onClick={() => setLocation(to, { replace: true })}>{label}</PitchButton>
  );
  const mine = match.players.find((p) => p.userId === me.id);
  if (mine && mine.status === "confirmed" && mine.paid) {
    return <div className="p-4"><NightEmpty icon={<Check className="size-icon-empty" />} title="Ya tienes tu cupo" description="Tu pago está registrado y tu pase listo." action={back("Ver mi pase", PLAY_ROUTES.pass(match))} /></div>;
  }
  if (mine && mine.status === "waitlist") {
    return <div className="p-4"><NightEmpty icon={<Info className="size-icon-empty" />} title="Estás en la lista de suplentes" description="Pagas cuando te toque un cupo." action={back("Volver al partido", PLAY_ROUTES.match(match))} /></div>;
  }
  if (match.status === "cancelled" || match.status === "finished") {
    return <div className="p-4"><NightEmpty icon={<Info className="size-icon-empty" />} title="Este partido ya no admite jugadores" action={back("Volver al partido", PLAY_ROUTES.match(match))} /></div>;
  }
  if (spotsLeft(match) === 0 && !mine) {
    return <div className="p-4"><NightEmpty icon={<Info className="size-icon-empty" />} title="Ya no quedan cupos" description="Puedes entrar de suplente desde el detalle del partido." action={back("Volver al partido", PLAY_ROUTES.match(match))} /></div>;
  }
  if (lockLeft === 0 && !processing) {
    return (
      <div className="p-4">
        <NightEmpty
          icon={<Clock className="size-icon-empty" />}
          title="Se acabó el tiempo"
          description="No se cobró nada y tus cupos se liberaron para los demás. Vuelve al partido e inténtalo de nuevo."
          action={back("Volver al partido", PLAY_ROUTES.match(match))}
        />
      </div>
    );
  }

  // Cupos de esta inscripcion (?cupos=N desde el detalle): el total es la cuota por persona por cada cupo.
  // Si ya estoy anotado, mi cupo (y los de mis acompañantes) ya no cuentan como libres: se suman al tope.
  const owned = mine?.status === "confirmed" ? 1 + mine.guests : 0;
  const seats = Math.min(Math.max(Number(new URLSearchParams(window.location.search).get("cupos")) || 1, 1), Math.max(1, spotsLeft(match) + owned), 6);
  const price = Number(match.pricePerPlayer) * seats;
  const total = price;
  const lock = `${String(Math.floor(lockLeft / 60)).padStart(2, "0")}:${String(lockLeft % 60).padStart(2, "0")}`;

  const pay = async () => {
    if (code.length !== 6) {
      setCodeError(true);
      codeRef.current?.focus();
      return;
    }
    // Nada se reserva al elegir: antes de cobrar se confirma con el servidor que los cupos siguen libres.
    setProcessing(true);
    const { data: fresh } = await refetch();
    if (fresh) {
      const freshMine = fresh.players.find((p) => p.userId === me.id);
      const freshOwned = freshMine?.status === "confirmed" ? 1 + freshMine.guests : 0;
      const available = spotsLeft(fresh) + freshOwned;
      if (seats > available) {
        setProcessing(false);
        toast({ variant: "destructive", title: available === 0 ? "Ya no quedan cupos" : `Solo quedan ${available} ${available === 1 ? "cupo" : "cupos"}`, description: "Otro jugador se inscribió antes. No se cobró nada." });
        setLocation(PLAY_ROUTES.match(fresh), { replace: true });
        return;
      }
    }
    // Pago simulado: un momento de "procesando" y se marca el cupo como pagado.
    window.setTimeout(() => {
      join.mutate({ paid: true, guests: seats - 1 }, {
        onSuccess: () => {
          toast({ title: "¡Cupo confirmado!", description: `Pago de ${money(total)} registrado.`, variant: "success" });
          setLocation(PLAY_ROUTES.pass(match), { replace: true });
        },
        onError: (e) => {
          setProcessing(false);
          toast({ variant: "destructive", title: "No pudimos confirmar tu pago", description: e instanceof Error ? e.message : undefined });
        },
      });
    }, 1200);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Igual que el detalle y el pase: columna de lectura en movil; desde lg ocupa todo el ancho de la columna (sin max-w ni relleno propio). */}
      <div className="mx-auto w-full max-w-content flex-1 space-y-3 p-4 lg:max-w-none lg:p-0 lg:pb-6">
        <div className="flex justify-end">
          <span className="flex items-center gap-2 rounded-full bg-night-high px-3 py-1 text-caption font-bold text-pitch" role="timer" aria-label={`Tiempo para pagar: ${lock}`}>
            <span className="size-2 rounded-full bg-pitch" aria-hidden />
            {lock}
          </span>
        </div>

        <section className="space-y-3" aria-label="Pago con Yape">
          <span className="flex size-10 items-center justify-center rounded-md bg-yape text-label font-extrabold text-white" aria-label="Yape">yape</span>
          <div className="relative flex items-center">
            <label htmlFor="yape-phone" className="sr-only">Celular vinculado a tu Yape</label>
            <span className="pointer-events-none absolute left-3 text-caption font-bold text-night-muted">+51</span>
            <NightInput id="yape-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-16 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <label htmlFor="yape-code" className="sr-only">Código de aprobación de 6 dígitos</label>
              <NightInput
                id="yape-code" ref={codeRef} type="text" inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos" value={code}
                invalid={codeError} aria-describedby={codeError ? "yape-code-error" : undefined}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setCodeError(false); }}
                className="min-w-0 flex-1 px-3 text-center font-bold tracking-widest placeholder:tracking-normal"
              />
              <Button
                type="button" variant="ghost" size="xs" className="shrink-0 bg-yape/30 font-bold text-orchid hover:bg-yape/40"
                onClick={() => toast({ title: "Abre Yape en tu celular", description: "Menú lateral > Código de aprobación. (Simulado: aún no hay conexión con Yape.)" })}
              >
                <ExternalLink aria-hidden />
                Abrir Yape
              </Button>
            </div>
            {codeError && <p id="yape-code-error" className="mt-1 text-caption font-bold text-crimson">Ingresa el código de 6 dígitos.</p>}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 border border-night-high bg-night-container p-4 lg:rounded-md lg:p-6">
        <div className="mx-auto flex w-full max-w-content items-center justify-between gap-4 lg:max-w-none">
          <div>
            <p className="text-caption font-bold uppercase text-night-muted">Total</p>
            <p className="text-subheading font-bold text-pitch">{money(total)}</p>
          </div>
          <Button
            type="button" variant="pitch" size="xl" className="flex-1 uppercase shadow-glow"
            isLoading={processing} disabled={processing || join.isPending} onClick={pay}
          >
            {processing ? "Procesando pago…" : "Pagar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

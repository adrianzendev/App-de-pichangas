import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Check, ChevronRight, Clock, ExternalLink, Info, Lock, MapPin, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NightEmpty, PitchButton } from "@/components/pichangas/night-ui";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PLAY_ROUTES } from "@/lib/routes";
import { mapsUrl, spotsLeft, useJoinLeave, useMatch } from "@/lib/pichangas";

// ───────────── DATOS DE PRUEBA ─────────────
// El cobro todavia no existe: no hay pasarela, comision real ni cupones. Estas cifras y el "pago" son simulados;
// al confirmar solo se marca el cupo como pagado (join con paid: true). Reemplazar por la pasarela cuando se integre.
const SERVICE_FEE = 1.5; // comision de servicio y seguro de cancha
const COUPON = { code: "PICHANGA10", amount: 1.5 }; // cupon de bienvenida
const MOCK_YAPE_PHONE = "987 654 321";
const LOCK_SECONDS = 10 * 60; // el cupo se bloquea 10 minutos mientras pagas

const money = (n: number) => `S/ ${n.toFixed(2)}`;

type Method = "yape";
const PAY_LABEL: Record<Method, string> = { yape: "Pagar con Yape" };

/** Cuenta regresiva del bloqueo del cupo: "09:42". Al llegar a 0 queda en 0. */
function useLockCountdown(seconds: number) {
  const [end] = useState(() => Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const id = window.setInterval(() => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(id);
  }, [end]);
  return left;
}

function Radio({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-pitch text-pitch-on" aria-hidden>
      <Check className="size-icon-md" />
    </span>
  ) : (
    <span className="size-5 shrink-0 rounded-full bg-night-highest" aria-hidden />
  );
}

function MethodRow({
  id, selected, onSelect, badge, title, subtitle, extra, children,
}: {
  id: Method;
  selected: boolean;
  onSelect: (m: Method) => void;
  badge: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={cn("rounded-md p-card-pad transition-colors duration-fast", selected ? "bg-night-high shadow-night-card" : "bg-night-low hover:bg-night-container")}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onSelect(id)}
        className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch"
      >
        <span className="flex min-w-0 items-center gap-3">
          {badge}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 text-label font-bold text-night-text">{title}</span>
            <span className="block text-caption text-night-muted">{subtitle}</span>
          </span>
        </span>
        {extra ?? <Radio checked={selected} />}
      </button>
      {selected && children}
    </div>
  );
}

interface MatchCheckoutViewProps {
  matchId: string;
  me: { id: string; name: string };
}

// Confirmar y pagar (tema Pichanga Black): resumen con el desglose, metodo de pago (Yape, billetera),
// garantia y la barra final. Pago simulado: ver "DATOS DE PRUEBA" arriba.
export function MatchCheckoutView({ matchId, me }: MatchCheckoutViewProps) {
  const [, setLocation] = useLocation();
  const { data: match, isLoading, isError, refetch } = useMatch(matchId);
  const { join } = useJoinLeave(matchId);
  const lockLeft = useLockCountdown(LOCK_SECONDS);
  const [method, setMethod] = useState<Method>("yape");
  const [phone, setPhone] = useState(MOCK_YAPE_PHONE);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
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
          description="Liberamos tu cupo para que otro jugador pueda tomarlo. Vuelve a intentarlo."
          action={back("Volver al partido", PLAY_ROUTES.match(match))}
        />
      </div>
    );
  }

  // Cupos de esta inscripcion (?cupos=N desde el detalle): la cuota y la comision se cobran por cada uno; el cupon, una vez.
  const seats = Math.min(Math.max(Number(new URLSearchParams(window.location.search).get("cupos")) || 1, 1), Math.max(1, spotsLeft(match)), 6);
  const price = Number(match.pricePerPlayer) * seats;
  const total = Math.max(0, price + SERVICE_FEE * seats - COUPON.amount);
  const lock = `${String(Math.floor(lockLeft / 60)).padStart(2, "0")}:${String(lockLeft % 60).padStart(2, "0")}`;

  const pay = () => {
    if (method === "yape" && code.length !== 6) {
      setCodeError(true);
      codeRef.current?.focus();
      return;
    }
    setProcessing(true);
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
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-section-gap p-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:p-6">
        <div className="flex items-center justify-between gap-3 lg:col-span-2 lg:row-start-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-caption font-bold uppercase text-night-muted">Paso final · Reserva inmediata</span>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-night-high px-2.5 py-1 text-caption font-bold text-pitch" role="timer" aria-label={`Cupo bloqueado por ${lock}`}>
            <span className="size-1.5 rounded-full bg-pitch" aria-hidden />
            Cupo bloqueado: {lock}
          </span>
        </div>

        <section className="space-y-2 lg:col-start-2 lg:row-start-2 lg:row-span-2" aria-label="Método de pago">
          <div className="flex items-center justify-between">
            <h2 className="text-subheading font-bold uppercase text-night-text">Método de pago</h2>
            <span className="flex items-center gap-1 text-caption font-bold uppercase text-aqua"><Lock className="size-icon-md" aria-hidden />100% protegido</span>
          </div>

          <div role="radiogroup" aria-label="Método de pago" className="space-y-2">
            <MethodRow
              id="yape" selected={method === "yape"} onSelect={setMethod}
              badge={<span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-yape text-label font-extrabold text-white">yape</span>}
              title={<>Yape <span className="rounded-full bg-pitch/20 px-2 py-0.5 text-caption font-bold uppercase text-pitch">Recomendado</span></>}
              subtitle="Confirmación instantánea automática"
            >
              <div className="mt-4 space-y-3 border-t border-night-highest pt-4">
                <div>
                  <label htmlFor="yape-phone" className="mb-1 block text-caption font-bold uppercase text-night-muted">Celular vinculado a tu Yape</label>
                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3 text-caption font-bold text-night-muted">+51</span>
                    <input
                      id="yape-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="h-11 w-full rounded-sm bg-night-lowest pl-16 pr-3 text-base font-bold text-night-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor="yape-code" className="text-caption font-bold uppercase text-night-muted">Código de aprobación (6 dígitos)</label>
                    <button type="button" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp} className="text-caption font-bold text-aqua hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch">¿Dónde lo encuentro?</button>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      id="yape-code" ref={codeRef} type="text" inputMode="numeric" maxLength={6} placeholder="Ej. 482910" value={code}
                      aria-invalid={codeError || undefined} aria-describedby={codeError ? "yape-code-error" : undefined}
                      onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setCodeError(false); }}
                      className={cn(
                        "h-11 min-w-0 flex-1 rounded-sm bg-night-lowest px-3 text-center text-base font-bold tracking-widest text-night-text placeholder:text-night-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch",
                        codeError && "ring-2 ring-crimson",
                      )}
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
                  {showHelp && (
                    <p className="mt-1.5 flex items-start gap-1 text-caption text-night-muted">
                      <Info className="mt-0.5 size-icon-md shrink-0 text-aqua" aria-hidden />
                      Abre Yape &gt; Menú lateral &gt; &quot;Código de aprobación&quot;.
                    </p>
                  )}
                </div>
              </div>
            </MethodRow>

          </div>
        </section>

        <section className="flex items-start gap-3 rounded-md bg-night-low p-card-pad lg:col-start-1 lg:row-start-2" aria-label="Garantía">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-pitch/10 text-pitch"><ShieldCheck className="size-icon-lg" aria-hidden /></span>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-caption font-bold uppercase text-night-text">Garantía Pichangas</h3>
              <span className="rounded-xs bg-pitch/20 px-1.5 text-caption font-bold uppercase text-pitch">100% Reembolso</span>
            </div>
            <p className="text-caption text-night-muted">
              Si el partido no alcanza el mínimo de jugadores 2 horas antes de la pichanga, el dinero se reembolsa de inmediato y sin comisiones a tu cuenta de Yape.
            </p>
          </div>
        </section>

        <a
          href={mapsUrl(match.venue)} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-md bg-night-high p-card-pad text-night-text transition-colors duration-fast hover:bg-night-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch lg:col-start-1 lg:row-start-3"
        >
          <span className="flex min-w-0 items-center gap-3">
            <MapPin className="size-icon-xl shrink-0 text-aqua" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-label font-bold">{match.venue.name}</span>
              <span className="block truncate text-caption text-night-muted">{match.venue.address ?? match.venue.district}</span>
            </span>
          </span>
          <ChevronRight className="size-icon-lg shrink-0 text-night-muted" aria-hidden />
        </a>
      </div>

      <div className="sticky bottom-0 bg-night-high p-4 lg:p-6">
        <div className="mx-auto w-full max-w-content space-y-2 lg:max-w-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-caption font-bold uppercase text-night-muted">Total a pagar</p>
              <p className="flex items-baseline gap-1 text-subheading font-bold text-pitch">{money(total)}<span className="text-caption font-bold text-night-muted">PEN</span></p>
            </div>
            <Button
              type="button" variant="pitch" size="xl" className="flex-1 uppercase shadow-glow"
              isLoading={processing} disabled={processing || join.isPending} onClick={pay}
            >
              {!processing && <Lock aria-hidden />}
              {processing ? "Procesando pago…" : PAY_LABEL[method]}
            </Button>
          </div>
          <p className="flex items-center justify-center gap-2 text-caption font-bold text-night-outline">
            <ShieldCheck className="size-icon-md shrink-0" aria-hidden />
            Transacción encriptada de 256 bits vía Pasarela Pichangas
          </p>
        </div>
      </div>
    </div>
  );
}

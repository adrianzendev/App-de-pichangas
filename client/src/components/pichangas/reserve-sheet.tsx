import { CalendarDays, MapPin, Ticket, Wallet } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  FORMAT_LABEL, LEVEL_LABEL, dayLabel, priceLabel, timeRange12, type MatchSummary,
} from "@/lib/pichangas";

interface ReserveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchSummary;
  busy?: boolean;
  /** Reserva el cupo y paga en la cancha (no marca pago). */
  onReserve: () => void;
  /** Anota y marca el pago como hecho (pago en línea). */
  onPayNow: () => void;
}

export function ReserveSheet({ open, onOpenChange, match, busy, onReserve, onPayNow }: ReserveSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-sheet w-full max-w-container flex-col gap-4 overflow-y-auto rounded-t-sheet border-night-highest bg-night p-6 text-night-text"
      >
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="text-subheading font-bold uppercase text-night-text">Reserva tu cupo</SheetTitle>
          <SheetDescription className="text-label text-night-muted">Elige cómo quieres asegurar tu lugar.</SheetDescription>
        </SheetHeader>

        <section className="space-y-3 rounded-md bg-night-container p-card-pad" aria-label="Resumen del partido">
          <div className="space-y-1">
            <p className="text-body font-bold text-night-text">{match.title}</p>
            <p className="text-label text-night-muted">
              {FORMAT_LABEL[match.format] ?? match.format} · {LEVEL_LABEL[match.level] ?? match.level}
            </p>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-label text-night-text">
              <MapPin className="size-icon-md shrink-0 text-aqua" aria-hidden />
              <span className="min-w-0">{match.venue.name} · {match.venue.district}</span>
            </p>
            <p className="flex items-center gap-2 text-label text-night-text">
              <CalendarDays className="size-icon-md shrink-0 text-aqua" aria-hidden />
              <span className="min-w-0">{dayLabel(match.startsAt)} · {timeRange12(match.startsAt, match.durationMinutes)}</span>
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md bg-night-low px-3 py-2">
            <span className="text-caption font-bold uppercase text-night-muted">Precio por jugador</span>
            <span className="text-subheading font-extrabold text-pitch">{priceLabel(match.pricePerPlayer)}</span>
          </div>
        </section>

        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={onReserve}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md bg-night-highest px-5 py-2.5 text-night-text transition-colors duration-fast hover:bg-night-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2 text-body font-bold uppercase">
              <Ticket className="size-icon-lg" aria-hidden />
              Reservar cupo
            </span>
            <span className="text-caption text-night-muted">Pagas en la cancha al organizador.</span>
          </button>

          <button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onPayNow}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md bg-pitch px-5 py-2.5 text-pitch-on shadow-glow transition-colors duration-fast hover:bg-pitch-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch focus-visible:ring-offset-2 focus-visible:ring-offset-night disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2 text-body font-bold uppercase">
              <Wallet className="size-icon-lg" aria-hidden />
              {busy ? "Procesando…" : `Pagar ahora · ${priceLabel(match.pricePerPlayer)}`}
            </span>
            <span className="text-caption">Confirma tu pago en línea.</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

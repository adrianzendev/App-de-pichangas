import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/pichangas/night-ui";
import { initialsOf, priceLabel, spotsLeft, whenLabel, type MatchSummary } from "@/lib/pichangas";

interface MatchCardProps {
  match: MatchSummary;
  /** true = ya pague mi cupo (solo entonces "Inscrito" y hay pase); cualquier otro valor = "Unirme". */
  paid?: boolean;
  selected?: boolean;
  onOpen: (id: string) => void;
}

/** Celda del bento: un dato con su rotulo. */
function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-between gap-1 rounded-sm bg-night-low p-2.5", className)}>
      <p className="text-caption text-night-muted">{label}</p>
      <p className="truncate text-label font-bold text-night-text">{children}</p>
    </div>
  );
}

// Tarjeta del feed, version Bento minimalista: foto de portada como celda, titulo y cancha, tres celdas de datos
// (cuando, cupos, cuota) y abajo quien organiza con la accion. Los datos que la app aun no guarda no se inventan.
export function MatchCard({ match, paid, selected, onOpen }: MatchCardProps) {
  const left = spotsLeft(match);
  // Solo dos botones: "Inscrito" si ya pague, "Unirme" en cualquier otro caso (no anotado o anotado sin pagar).
  paid = paid === true;

  return (
    <article
      onClick={() => onOpen(match.id)}
      className={cn(
        "flex cursor-pointer flex-col overflow-hidden rounded-md bg-night-container transition-colors duration-fast hover:bg-night-high",
        selected && "ring-1 ring-night-outline",
      )}
      data-testid={`match-card-${match.id}`}
    >
      {/* Foto de portada a sangre completa: llega a los bordes de la tarjeta (sin margen). */}
      <div className="h-32 bg-night-high">
        <CoverImage venue={match.venue} className="h-full w-full object-cover" />
      </div>

      <div className="flex flex-col gap-3 p-3">
      <header className="min-w-0 px-0.5">
        <h3 className="truncate text-subheading font-bold text-night-text">{match.title}</h3>
        <p className="truncate text-caption text-night-muted">{match.venue.name} · {match.venue.district}</p>
      </header>

      <div className="grid grid-cols-4 gap-2">
        <Cell label="Cuándo" className="col-span-2">{whenLabel(match.startsAt, match.durationMinutes)}</Cell>
        <Cell label="Cupos">
          <span className={cn(left > 0 && left <= 2 && "text-crimson")}>{match.confirmedCount}/{match.maxPlayers}</span>
        </Cell>
        <Cell label="Cuota"><span className="text-pitch">{priceLabel(match.pricePerPlayer)}</span></Cell>
      </div>

      <footer className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {match.organizerAvatar ? (
            <img src={match.organizerAvatar} alt="" loading="lazy" className="size-7 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-night-highest text-caption font-bold text-night-text" aria-hidden>
              {initialsOf(match.organizerName)}
            </span>
          )}
          <p className="truncate text-label text-night-muted">{match.organizerName}</p>
        </div>
        <Button
          variant="pitch"
          size="compact"
          className={cn(
            "shrink-0 uppercase",
            paid && "border border-pitch bg-transparent text-pitch shadow-none hover:bg-pitch/10",
            !paid && left === 0 && "bg-night-highest text-pitch shadow-none hover:bg-night-high",
          )}
          onClick={(e) => { e.stopPropagation(); onOpen(match.id); }}
        >
          {paid ? "Inscrito" : "Unirme"}
        </Button>
      </footer>
      </div>
    </article>
  );
}

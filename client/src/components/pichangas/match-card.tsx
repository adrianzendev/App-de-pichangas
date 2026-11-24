import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/pichangas/night-ui";
import {
  initialsOf, priceLabel, spotsLeft, whenLabel,
  type MatchSummary,
} from "@/lib/pichangas";

interface MatchCardProps {
  match: MatchSummary;
  /** true = ya pague mi cupo (solo entonces "Inscrito" y hay pase); cualquier otro valor = "Unirme". */
  paid?: boolean;
  selected?: boolean;
  onOpen: (id: string) => void;
}

// Tarjeta del feed (tema Pichanga Black): foto de la cancha, que tan lleno esta el partido, quien organiza, cuanto cuesta y
// una sola accion grande. Los datos que la app aun no guarda (calificacion del organizador, "buena vibra") no se inventan.
export function MatchCard({ match, paid, selected, onOpen }: MatchCardProps) {
  const left = spotsLeft(match);
  const full = left === 0;
  // Solo dos botones: "Inscrito" si ya pague, "Unirme" en cualquier otro caso (no anotado o anotado sin pagar).
  paid = paid === true;
  const action = paid ? "Inscrito" : "Unirme";

  return (
    <article
      onClick={() => onOpen(match.id)}
      className={cn(
        "flex cursor-pointer flex-col overflow-hidden rounded-md bg-night-container shadow-night-card",
        selected && "ring-1 ring-night-outline",
      )}
      data-testid={`match-card-${match.id}`}
    >
      <div className="relative h-32 overflow-hidden bg-night-high">
        <CoverImage venue={match.venue} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-night-container via-night-container/40 to-transparent" aria-hidden />
        <div className="absolute inset-x-2.5 top-2.5 flex justify-end">
          {!paid && left > 0 && (
            <span className="shrink-0 rounded-sm bg-crimson px-2 py-0.5 text-caption font-bold uppercase text-crimson-on">
              {left === 1 ? "Queda 1 cupo" : `Quedan ${left} cupos`}
            </span>
          )}
        </div>
        <div className="absolute inset-x-3 bottom-2 flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-subheading font-bold text-night-text">{match.title}</h3>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-caption text-night-muted">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="size-icon-md shrink-0 text-aqua" aria-hidden />
            <span className="truncate">{match.venue.name}</span>
          </span>
        </div>

        <div className="rounded-sm bg-night-low p-2.5">
          <p className="text-caption font-bold uppercase text-night-text">{whenLabel(match.startsAt, match.durationMinutes)}</p>
          <p className="text-caption text-night-muted">{match.confirmedCount}/{match.maxPlayers} jugadores confirmados</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {match.organizerAvatar ? (
              <img src={match.organizerAvatar} alt="" loading="lazy" className="size-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-night-highest text-label font-bold text-night-text" aria-hidden>
                {initialsOf(match.organizerName)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-label font-semibold text-night-text">{match.organizerName}</p>
              <p className="text-caption text-night-muted">Organizador</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-caption font-bold uppercase text-night-muted">Por persona</p>
            <p className="text-subheading font-bold text-pitch">{priceLabel(match.pricePerPlayer)}</p>
          </div>
        </div>

        <Button
          variant="pitch"
          size="lg"
          className={cn(
            "w-full uppercase",
            full && "bg-night-highest text-pitch shadow-none hover:bg-night-high",
            paid && "border border-pitch bg-pitch/10 text-pitch shadow-none hover:bg-pitch/20",
          )}
          onClick={(e) => { e.stopPropagation(); onOpen(match.id); }}
        >
          {action}
        </Button>
      </div>
    </article>
  );
}

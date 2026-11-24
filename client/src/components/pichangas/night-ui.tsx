import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { SoccerBall } from "@/components/pichangas/soccer-ball";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { DEFAULT_COVER, coverOf } from "@/lib/pichangas";

// Piezas del tema "Pichanga Black" (jugador). Los colores salen de los tokens night/pitch de index.css.

interface PillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  active?: boolean;
}

/** Chip de distrito: redondo; el activo va en verde electrico con brillo. */
export function NightChip({ active, className, children, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-label font-bold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch",
        active ? "bg-pitch text-pitch-on shadow-glow" : "bg-night-high text-night-text hover:bg-night-highest",
        className,
      )}
      {...props}
    >
      {active && <MapPin className="size-icon-md" aria-hidden />}
      {children}
    </button>
  );
}

/** Filtro rapido (Hoy, Mañana, Fútbol 7...): rectangulo chico en mayusculas. */
export function QuickPill({ active, className, children, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 text-caption font-bold uppercase transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch",
        active ? "bg-night-container text-pitch" : "bg-night-low text-night-muted hover:text-night-text",
        className,
      )}
      {...props}
    >
      {active && <span className="size-1.5 rounded-full bg-pitch" aria-hidden />}
      {children}
    </button>
  );
}

/** Portada de una pichanga: la foto de la cancha o, si no hay (o no carga), la portada por defecto. Nunca queda vacia. */
export function CoverImage({ venue, alt = "", className }: { venue: { photos?: string[] | null }; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? DEFAULT_COVER : coverOf(venue);
  // La portada por defecto es vertical: se encuadra donde esta la accion (los jugadores), no en el centro.
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
      style={src === DEFAULT_COVER ? { objectPosition: "50% 62%" } : undefined}
    />
  );
}

/**
 * Cuadro de bienvenida del feed. Mismo layout que el contenedor de estado del pase: icono circular a la izquierda,
 * badge + titulo + subtitulo apilados y un dato destacado a la derecha.
 */
export function WelcomeBanner({ city, headingLevel = "h2" }: { city: string; headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  return (
    <section aria-label="Bienvenida" className="relative flex items-center justify-between gap-3 overflow-hidden rounded-md bg-night-container p-4 shadow-night-card">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-pitch/10 blur-md" aria-hidden />
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pitch/15 text-pitch" aria-hidden>
          <SoccerBall className="size-icon-xl" />
        </span>
        <div className="min-w-0">
          <Heading className="line-clamp-2 text-body font-bold text-night-text">¡Encuentra tu pichanga de hoy!</Heading>
          <p className="line-clamp-2 text-caption text-night-muted">Cupos libres en canchas techadas con iluminación LED profesional.</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className="block text-caption font-bold uppercase text-night-muted">Ciudad</span>
        <span className="text-body font-bold text-pitch">{city}</span>
      </div>
    </section>
  );
}

/** Selector de ciudad en pastilla oscura. */
export function CitySelect({ value, cities, onChange, className }: { value: string; cities: string[]; onChange: (city: string) => void; className?: string }) {
  if (cities.length < 2) return null;
  return (
    <FilterSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("shrink-0 border-night-highest bg-night-high text-night-text", className)}
      data-testid="city-select"
    >
      {cities.map((c) => <option key={c} value={c}>{c}</option>)}
    </FilterSelect>
  );
}

/** Estado vacio o de error sobre fondo oscuro. */
export function NightEmpty({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md bg-night-container px-6 py-10 text-center">
      <span className="text-night-muted" aria-hidden>{icon}</span>
      <p className="text-body font-semibold text-night-text">{title}</p>
      {description && <p className="text-label text-night-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Boton principal del tema: verde electrico con brillo. */
export function PitchButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-pitch px-5 text-body font-bold text-pitch-on shadow-glow transition-colors duration-fast hover:bg-pitch-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch focus-visible:ring-offset-2 focus-visible:ring-offset-night disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

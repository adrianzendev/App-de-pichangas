import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { surfaceClass } from "@/components/pichangas/surface";
import { ChevronDown, MapPin } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import { NightLinkButton } from "@/components/pichangas/night-controls";
import { cn } from "@/lib/utils";
import { coverOf } from "@/lib/pichangas";
import { VenueGallery } from "@/components/pichangas/venue-gallery";

// Piezas del tema "Pichanga Black" (jugador). Los colores salen de los tokens night/pitch de index.css.

type BadgeTone = "plain" | "pitch" | "crimson" | "muted" | "accent";
const BADGE_TONE: Record<BadgeTone, string> = {
  plain: "bg-night-high text-night-text",
  pitch: "bg-pitch/15 text-pitch",
  crimson: "bg-crimson text-crimson-on",
  muted: "bg-night-container text-night-muted",
  accent: "bg-night-highest text-pitch",
};

/** Pastilla de estado/dato ("Anotado", "Ultimo cupo", "+2"): una sola fuente. `md` para titulos, `sm` dentro de filas y cabeceras. */
export function NightBadge({ tone = "plain", size = "md", className, children }: { tone?: BadgeTone; size?: "sm" | "md"; className?: string; children: ReactNode }) {
  return (
    <span className={cn("rounded-full font-bold", size === "md" ? "px-3 py-1 text-label" : "px-2 py-0.5 text-caption", BADGE_TONE[tone], className)}>
      {children}
    </span>
  );
}

interface PillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  active?: boolean;
  /** Muestra el pin de ubicacion cuando esta activo (chips de distrito). Apagalo en otros usos. */
  pin?: boolean;
}

/** Chip del tema (distrito, posicion...): redondo, sin fondo y con borde; el activo lleva el borde y el texto en el color de acento. */
export function NightChip({ active, pin = true, className, children, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border bg-transparent px-4 text-label font-bold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch",
        active ? "border-pitch text-pitch" : "border-night-highest text-night-text hover:bg-pitch/5",
        className,
      )}
      {...props}
    >
      {active && pin && <MapPin className="size-icon-md" aria-hidden />}
      {children}
    </button>
  );
}

/** Filtro rapido (Hoy, Mañana, Fútbol 7...): pastilla chica en mayusculas; tambien es la del filtro activo (con X). */
export function QuickPill({ active, pin = true, className, children, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-caption font-bold uppercase transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch",
        active ? "border-pitch bg-transparent text-pitch" : "border-night-highest bg-transparent text-night-muted hover:text-night-text",
        className,
      )}
      {...props}
    >
      {active && pin && <span className="size-2 rounded-full bg-pitch" aria-hidden />}
      {children}
    </button>
  );
}

/** Portada de una pichanga: UNA foto de la cancha (la primera) o, si no hay o no carga, la portada por defecto. Es `VenueGallery` con una sola foto: un solo origen para fallback y encuadre. */
export function CoverImage({ venue, alt = "", className }: { venue: { photos?: string[] | null }; alt?: string; className?: string }) {
  return <VenueGallery venue={{ photos: [coverOf(venue)] }} alt={alt} className={className} />;
}

/**
 * Cuadro de bienvenida del feed. Mismo layout que el contenedor de estado del pase: icono circular a la izquierda,
 * titulo + subtitulo apilados. La ciudad ya se ve en el titulo y en el selector: no se repite aqui.
 */
export function WelcomeBanner({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  return (
    // Al pasar el mouse por el banner (o tocarlo) el balon rebota: sube, cae, se aplasta un poco y rebota mas bajo.
    // Es un efecto corto que inicia la persona, igual que el hover de PlayerRow: se mantiene aun con "reducir movimiento".
    <motion.section aria-label="Bienvenida" whileHover="bounce" whileTap="bounce" className={cn(surfaceClass(), "relative flex items-center justify-between gap-3 overflow-hidden p-4")}>
      <div className="flex min-w-0 items-center gap-3">
        <motion.img
          src="/brand/balon.webp" alt="" width={48} height={48} className="size-12 shrink-0"
          style={{ transformOrigin: "50% 100%" }}
          // Tres botes que pierden altura (18 -> 8 -> 3 px). Los tiempos siguen la caida libre: un bote de altura h tarda
          // proporcional a raiz(h), asi que cada uno es mas corto que el anterior. Sube frenando (easeOut) y cae acelerando
          // (easeIn); al tocar el suelo se aplasta (mas en el primer bote) y gira un poco, como una pelota de verdad.
          variants={{
            bounce: {
              y: [0, -18, 0, -8, 0, -3, 0],
              scaleY: [1, 1.03, 0.86, 1.02, 0.95, 1.01, 1],
              scaleX: [1, 0.98, 1.12, 0.99, 1.05, 1, 1],
              rotate: [0, 10, 14, 6, 4, 1, 0],
              transition: { duration: 1.2, times: [0, 0.241, 0.482, 0.643, 0.804, 0.902, 1], ease: ["easeOut", "easeIn", "easeOut", "easeIn", "easeOut", "easeIn"] },
            },
          }}
        />
        <div className="min-w-0">
          <Heading className="line-clamp-2 text-body font-bold text-night-text">¡Encuentra tu pichanga de hoy!</Heading>
          <p className="line-clamp-2 text-caption text-night-muted">Encuentra pichangas en tu localidad y separa tu cupo.</p>
        </div>
      </div>
    </motion.section>
  );
}

/** Menu desplegable del tema: UN solo estilo para "Ordenar", la ciudad y cualquier lista corta. La opcion elegida va en negrita. */
export function NightMenu<T extends string>({ value, options, onSelect, trigger, ariaLabel, align = "end", className }: {
  value: T;
  options: readonly { id: T; label: string }[];
  onSelect: (id: T) => void;
  trigger: ReactNode;
  ariaLabel: string;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <NightLinkButton aria-label={ariaLabel} className={cn("gap-1", className)} data-testid={ariaLabel === "Ciudad" ? "city-select" : undefined}>
          {trigger}
        </NightLinkButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => onSelect(o.id)} className={cn(value === o.id && "font-bold")}>{o.label}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Selector de ciudad del feed (no se muestra con una sola ciudad). */
export function CitySelect({ value, cities, onChange, className }: { value: string; cities: string[]; onChange: (city: string) => void; className?: string }) {
  if (cities.length < 2) return null;
  return (
    <NightMenu
      value={value}
      options={cities.map((c) => ({ id: c, label: c }))}
      onSelect={onChange}
      ariaLabel="Ciudad"
      className={className}
      trigger={<>{value}<ChevronDown className="size-icon-md" aria-hidden /></>}
    />
  );
}

/** Estado vacio o de error sobre fondo oscuro. */
export function NightEmpty({ icon, title, description, action, fill }: { icon: ReactNode; title: string; description?: string; action?: ReactNode; /** Ocupa todo el alto libre de su contenedor (el mensaje queda centrado). */ fill?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", fill && "flex-1 justify-center")}>
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
        "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-pitch px-5 text-body font-bold text-pitch-on shadow-glow transition-colors duration-fast hover:bg-pitch-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch focus-visible:ring-offset-2 focus-visible:ring-offset-night disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

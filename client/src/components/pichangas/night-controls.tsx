import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Controles del tema "Pichanga Black" (jugador y host). Son la UNICA fuente de botones y campos de /play: las pantallas no
// escriben <button> ni <input> a mano (check:field-rules lo vigila). Colores: tokens night/pitch/crimson de index.css.

const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch";

// ───────────── Campos ─────────────

export interface NightInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** "control" = radio de campo (12px); "pill" = redondo (chat). */
  shape?: "control" | "pill";
  /** Muestra el error: anillo en el rojo del tema. */
  invalid?: boolean;
}

/** Campo de texto: 48px, borde lavanda, fondo del campo. Texto de 16px (iOS no hace zoom). */
export const NightInput = forwardRef<HTMLInputElement, NightInputProps>(function NightInput({ shape = "control", invalid, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(
        "h-field w-full border border-night-highest bg-night-lowest px-4 text-base text-night-text placeholder:text-night-muted",
        RING,
        shape === "pill" ? "rounded-full" : "rounded-control",
        invalid && "ring-2 ring-crimson",
        className,
      )}
      {...props}
    />
  );
});

/** Casilla de verificacion con el color de acento. */
export const NightCheckbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function NightCheckbox({ className, ...props }, ref) {
  return <input ref={ref} type="checkbox" className={cn("size-4 accent-pitch", className)} {...props} />;
});

// ───────────── Botones ─────────────

const ICON_TONE = {
  /** Sobre la pagina: tarjeta con hover. */
  surface: "bg-night-container text-night-text hover:bg-night-high",
  /** Un escalon mas fuerte (selector de cupos). */
  soft: "bg-night-highest text-night-text hover:bg-night-high disabled:hover:bg-night-highest",
  /** Accion principal (enviar). */
  pitch: "bg-pitch text-pitch-on hover:bg-pitch-strong",
  /** Sin fondo (avatar de la cabecera). */
  ghost: "hover:bg-night-container",
} as const;
const ICON_SIZE = { sm: "size-8", md: "size-10" } as const;

export interface NightIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: keyof typeof ICON_TONE;
  size?: keyof typeof ICON_SIZE;
  /** Obligatorio: un boton de solo icono no tiene texto. */
  "aria-label": string;
}

/** Boton redondo de solo icono (volver, enviar, quitar/agregar un cupo, filtros). */
export const NightIconButton = forwardRef<HTMLButtonElement, NightIconButtonProps>(function NightIconButton({ tone = "surface", size = "md", className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-fast disabled:opacity-40", RING, ICON_TONE[tone], ICON_SIZE[size], className)}
      {...props}
    />
  );
});

/** Accion de texto sin caja ("Limpiar", "Ordenar", la ciudad). Tambien es el disparador de los menus. */
export const NightLinkButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function NightLinkButton({ className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("inline-flex shrink-0 items-center gap-2 text-label font-bold text-night-muted transition-colors duration-fast hover:text-pitch", RING, className)}
      {...props}
    />
  );
});

/** "← Volver a ...": enlace de regreso de las pantallas de escritorio. */
export function NightBackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <NightLinkButton onClick={onClick}>
      <ArrowLeft className="size-icon-lg" aria-hidden />
      {label}
    </NightLinkButton>
  );
}

// ───────────── Pestanas ─────────────

export interface NightTab<T extends string> { id: T; label: string; count?: number }

/** Pestanas en segmentos ("Proximas" / "Pasadas"): la activa lleva el relleno de acento. */
export function NightTabs<T extends string>({ tabs, value, onChange, ariaLabel }: { tabs: readonly NightTab<T>[]; value: T; onChange: (id: T) => void; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="grid grid-cols-2 rounded-md bg-night-container p-1">
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-label font-bold transition-colors duration-fast",
              RING,
              on ? "bg-pitch-strong text-pitch-on shadow-night-card" : "text-night-muted hover:text-night-text",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-2 text-caption", on ? "bg-pitch-on/15" : "bg-night-high")}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ───────────── Navegacion ─────────────

export interface NightNavButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** "side" = fila del menu lateral; "profile" = la cuenta abajo del menu lateral; "bottom" = barra inferior movil. */
  variant: "side" | "profile" | "bottom";
  active?: boolean;
  icon?: LucideIcon;
  label?: string;
  children?: ReactNode;
}

/** Opcion de navegacion del armazon del jugador: una sola pieza para el menu lateral, la cuenta y la barra inferior. */
export function NightNavButton({ variant, active, icon: Icon, label, children, className, ...props }: NightNavButtonProps) {
  const base =
    variant === "bottom"
      ? cn("flex flex-1 flex-col items-center justify-center gap-1 text-caption font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pitch", active ? "text-pitch" : "text-night-muted")
      : cn(
          "flex h-12 items-center gap-3 rounded-full px-3 text-body font-medium text-night-text transition-colors duration-fast hover:bg-night-container",
          RING,
          variant === "side" ? "whitespace-nowrap" : "w-full text-left",
          active && (variant === "profile" ? "bg-night-container font-bold" : "font-bold"),
        );
  return (
    <button type="button" aria-current={active ? "page" : undefined} className={cn(base, className)} {...props}>
      {Icon && <Icon className={cn("size-6", variant === "side" && active && "text-pitch")} aria-hidden />}
      {label && (variant === "bottom" ? <span>{label}</span> : label)}
      {children}
    </button>
  );
}

// ───────────── Fila de lista ─────────────

/**
 * Fila de una lista seleccionable (chats): icono redondo + titulo + subtitulo. A la derecha, alineados con cada linea:
 * `meta` junto al titulo (fecha del partido) y `metaBottom` junto al subtitulo (hora del ultimo mensaje). Activa = fondo morado muy suave.
 */
export function NightListRow({ active, icon, title, subtitle, meta, metaBottom, onClick }: { active?: boolean; icon?: ReactNode; title: string; subtitle: string; meta?: ReactNode; metaBottom?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      className={cn("flex w-full items-center gap-3 rounded-row px-3 py-3 text-left transition-colors duration-fast", RING, active ? "bg-pitch/5" : "hover:bg-pitch/5")}
    >
      {icon && <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pitch/15 text-pitch" aria-hidden>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-body font-bold text-night-text">{title}</span>
          {meta && <span className="shrink-0 text-caption text-night-muted">{meta}</span>}
        </span>
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-caption text-night-muted">{subtitle}</span>
          {metaBottom && <span className="shrink-0 text-caption text-night-muted">{metaBottom}</span>}
        </span>
      </span>
    </button>
  );
}

// ───────────── Baldosa de accion ─────────────

export function NightTile({ icon, label, onClick, href }: { icon: ReactNode; label: string; onClick?: () => void; href?: string }) {
  const className =
    "flex flex-col items-center justify-center gap-2 rounded-md bg-night-container p-3 text-label font-bold text-night-text transition-transform duration-fast active:scale-95 hover:bg-night-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch";
  const content = (
    <>
      <span className="flex size-10 items-center justify-center rounded-full bg-night-high text-pitch" aria-hidden>{icon}</span>
      {label}
    </>
  );
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={className}>{content}</a>
    : <button type="button" onClick={onClick} className={className}>{content}</button>;
}

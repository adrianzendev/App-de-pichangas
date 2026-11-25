import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-icon-sm border-2",
  sm: "size-icon-md border-2",
  md: "size-icon-lg border-2",
  lg: "size-icon-xl border-4",
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  /** Color via texto: `text-white`, `text-primary-500`. Por defecto hereda `currentColor`. */
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn("inline-block rounded-full border-current border-t-transparent animate-spin", SIZES[size], className)}
    />
  );
}

// Pantalla completa mientras se resuelve la sesion o una redireccion.
// `inline`: carga de una seccion dentro del shell (ya hay header y barra inferior): no fuerza 100vh, si no la pagina scrollea.
export function PageLoader({ inline = false }: { inline?: boolean }) {
  return (
    <div className={inline ? "bg-white flex items-center justify-center py-32" : "min-h-screen bg-white flex items-center justify-center"}>
      <Spinner size="lg" className="text-pitch" />
    </div>
  );
}

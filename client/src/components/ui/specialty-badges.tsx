import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Propiedades de {@link SpecialtyBadges}.
 */
export interface SpecialtyBadgesProps {
  /** Especialidades del tutor; vacio o `null` = no renderiza nada (sin huecos). */
  specialties?: string[] | null;
  /**
   * Maximo de pildoras visibles; el resto se resume en `+N`. Con `max` la fila es de UNA linea
   * (cada pildora se trunca) para no desalinear tarjetas en una grilla. Sin `max`: todas, con salto de linea.
   */
  max?: number;
  className?: string;
}

/**
 * Pildoras de especialidades del tutor. El estilo vive en `Badge` (variante `outline`): un solo
 * lugar para tarjeta de `/tutors`, panel de detalle, panel "Info. del usuario" del chat y perfil propio.
 * No renderiza nada si no hay especialidades.
 *
 * @param {SpecialtyBadgesProps} props - Especialidades y limite visible.
 * @returns {JSX.Element | null} La fila de pildoras, o `null` si no hay ninguna.
 */
export function SpecialtyBadges({ specialties, max, className }: SpecialtyBadgesProps) {
  if (!specialties || specialties.length === 0) return null;

  const limited = max !== undefined;
  const visible = limited ? specialties.slice(0, max) : specialties;
  const extra = limited ? specialties.length - visible.length : 0;

  return (
    <div
      className={cn("flex gap-1.5", limited ? "flex-nowrap overflow-hidden" : "flex-wrap", className)}
      data-testid="tutor-specialties"
    >
      {visible.map((s) => (
        <Badge key={s} variant="outline" className={cn(limited && "min-w-0 shrink")}>
          <span className={cn(limited && "truncate")}>{s}</span>
        </Badge>
      ))}
      {extra > 0 && <Badge variant="outline" className="shrink-0">+{extra}</Badge>}
    </div>
  );
}

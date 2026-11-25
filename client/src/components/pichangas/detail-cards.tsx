import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { surfaceClass } from "@/components/pichangas/surface";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

// Tarjetas del detalle de una pichanga (tema Pichanga Black). Una sola fuente para cada tipo; el detalle solo las compone.

/** Tarjeta con titulo (y texto de apoyo opcional) y contenido: Suplentes, Notas del organizador. */
export function SectionCard({ title, description, className, children }: { title: string; description?: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn(surfaceClass(), "space-y-3 p-card-pad", className)} aria-label={title}>
      <h2 className="text-subheading font-bold uppercase text-night-text">{title}</h2>
      {description && <p className="text-label text-night-muted">{description}</p>}
      {children}
    </section>
  );
}

/** Tarjeta plegable (cerrada por defecto): Reglas del encuentro. */
export function CollapsibleCard({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <details className={cn(surfaceClass(), "group px-card-pad py-3", className)} aria-label={title}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-label font-bold text-night-muted transition-colors duration-fast hover:text-night-text [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-icon-md transition-transform duration-fast group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

/** Ficha del organizador: va aparte de la plantilla (no ocupa cupo). */
export function OrganizerCard({ name, avatar, isMe, className }: { name: string; avatar?: string | null; isMe?: boolean; className?: string }) {
  return (
    <section className={cn(surfaceClass(), "flex items-center gap-3 p-card-pad", className)} aria-label="Organizador">
      <UserAvatar name={name} avatar={avatar} size="md" />
      <div className="min-w-0">
        <p className="text-caption font-bold uppercase text-night-muted">Organizador</p>
        <p className="truncate text-body font-bold text-night-text">{name}{isMe ? " (tú)" : ""}</p>
      </div>
    </section>
  );
}

import { cn } from "@/lib/utils";

/**
 * Insignia de tutor verificado: sello festoneado (el de BadgeCheck de lucide) de fondo verde con el check en blanco.
 * Va ANTES del nombre. Un solo lugar para su forma y color.
 */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Tutor verificado"
      viewBox="0 0 24 24"
      className={cn("size-icon-lg shrink-0 text-primary-600", className)}
    >
      <title>Tutor verificado</title>
      <path
        fill="currentColor"
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      />
      <path fill="none" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  );
}

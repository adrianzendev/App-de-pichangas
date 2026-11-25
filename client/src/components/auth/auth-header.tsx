import type { ReactNode } from "react";

// Titulo + subtitulo de las pantallas de acceso: una sola fuente para login, registro, recuperar, nueva y activar contraseña.
export function AuthHeader({ title, subtitle, night }: { title: string; subtitle?: ReactNode; night?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className={night ? "text-heading font-bold text-night-text" : "text-heading font-bold text-gray-900"}>{title}</h1>
      {subtitle && <p className={night ? "text-body text-night-muted" : "text-body text-gray-700"}>{subtitle}</p>}
    </div>
  );
}

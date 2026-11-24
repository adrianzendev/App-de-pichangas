import type { ReactNode } from "react";

// Titulo + subtitulo de las pantallas de acceso: una sola fuente para login, registro, recuperar, nueva y activar contraseña.
export function AuthHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-heading font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-body text-gray-700">{subtitle}</p>}
    </div>
  );
}

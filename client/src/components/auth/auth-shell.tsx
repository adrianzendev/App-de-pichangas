import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

// Cascarón de las pantallas de acceso: logo arriba y el formulario sobre fondo blanco, sin foto de portada.
// Movil: pantalla completa. Escritorio (md+): la misma pieza como tarjeta centrada.
export function AuthShell({ children, night }: { children: ReactNode; night?: boolean }) {
  const bg = night ? "bg-night font-satoshi text-night-text" : "bg-white";
  return (
    // pt-safe-top: en la app nativa (edge-to-edge) el logo no debe quedar bajo la barra de estado; 0 en navegador.
    <div className={`min-h-screen ${bg} pt-safe-top md:flex md:items-center md:justify-center md:p-4`}>
      <div className={`mx-auto flex min-h-screen w-full max-w-form flex-col overflow-hidden ${night ? "bg-night-container" : "bg-white"} md:min-h-0 md:rounded-sheet`}>
        <BrandLogo size="lg" tone={night ? "night" : "light"} className="ml-4 mt-5  self-start sm:ml-6 md:ml-8 md:mt-8" />
        <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-7 sm:px-6 md:px-8 md:pb-8 md:pt-8">
          {children}
        </div>
      </div>
    </div>
  );
}

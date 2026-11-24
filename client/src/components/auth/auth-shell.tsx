import type { ReactNode } from "react";
import logoMiltareas from "@/assets/logo-miltareas.png";

// Cascarón de las pantallas de acceso: logo arriba y el formulario sobre fondo blanco, sin foto de portada.
// Movil: pantalla completa. Escritorio (md+): la misma pieza como tarjeta centrada.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    // pt-safe-top: en la app nativa (edge-to-edge) el logo no debe quedar bajo la barra de estado; 0 en navegador.
    <div className="min-h-screen bg-white pt-safe-top md:flex md:items-center md:justify-center md:p-4">
      <div className="mx-auto flex min-h-screen w-full max-w-form flex-col overflow-hidden bg-white md:min-h-0 md:rounded-sheet">
        <img
          src={logoMiltareas}
          alt="MilTareas"
          width={290}
          height={64}
          className="ml-4 mt-5 h-7 w-auto self-start sm:ml-6 md:ml-8 md:mt-8"
        />
        <div className="flex flex-1 flex-col gap-4 px-4 pb-6 pt-7 sm:px-6 md:px-8 md:pb-8 md:pt-8">
          {children}
        </div>
      </div>
    </div>
  );
}

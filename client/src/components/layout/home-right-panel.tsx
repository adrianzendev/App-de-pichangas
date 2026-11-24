import { FeaturedTutors } from "@/components/sections/featured-tutors";

// Columna derecha del shell de escritorio (Inicio del alumno): Tutores destacados, 3 de las 12 columnas; el scroll es propio
// y sin barra visible.
export function HomeRightPanel() {
  return (
    <aside aria-label="Tutores destacados" className="hidden h-full min-w-0 flex-col lg:col-span-3 gap-6 overflow-y-auto scrollbar-none lg:flex lg:pt-6" data-testid="home-right-panel">
      <FeaturedTutors />
    </aside>
  );
}

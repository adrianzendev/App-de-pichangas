import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Piezas de maquetacion de las secciones del panel admin: un solo origen para que todas se vean igual.

// Raiz de seccion. Por defecto ocupa TODO el alto restante y la tabla scrollea dentro (su borde inferior llega al final de la pantalla
// aunque haya pocos registros, dejando 24px de aire debajo: `pb-6`); `fill={false}` la deja con la altura de su contenido.
export function AdminSection({ testId, fill = true, children }: { testId: string; fill?: boolean; children: ReactNode }) {
  return (
    <div className={cn("space-y-4", fill && "flex flex-col flex-1 min-h-0 pb-6")} data-testid={testId}>
      {children}
    </div>
  );
}

// Barra superior de las tablas con datos: una fila (buscador + accion principal) y debajo los filtros.
export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="space-y-3 flex-shrink-0">{children}</div>;
}

export function AdminToolbarRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col sm:flex-row gap-3 sm:items-center">{children}</div>;
}

export function AdminFilters({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

// Cabecera de las tablas de catalogo (servicios, cursos, paises…): descripcion + accion principal.
export function AdminSectionHeader({ description, action }: { description: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-shrink-0">
      <p className="text-body text-gray-700">{description}</p>
      {action}
    </div>
  );
}

// Boton "Nuevo …" de todas las secciones: mismo icono, mismo color, sin saltos de linea.
export function AdminCreateButton({ onClick, children, "data-testid": testId }: { onClick: () => void; children: ReactNode; "data-testid"?: string }) {
  return (
    <Button onClick={onClick} data-testid={testId} className="flex-shrink-0">
      <Plus className="size-icon-md" />
      {children}
    </Button>
  );
}

export const ADMIN_PAGE_SIZE = 25;

// Recorta una lista a la pagina pedida. La pagina se ajusta sola si los filtros dejan menos paginas.
export function paginate<T>(list: T[], page: number, size = ADMIN_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(Math.max(page, 1), pageCount);
  return { items: list.slice((current - 1) * size, current * size), page: current, pageCount, total: list.length, size };
}

interface AdminPaginationProps {
  page: number;
  pageCount: number;
  total: number;
  size: number;
  onPageChange: (page: number) => void;
}

// Pie de las tablas largas ("Mostrando 1–25 de 189" + anterior/siguiente). Sin paginas extra no se pinta.
export function AdminPagination({ page, pageCount, total, size, onPageChange }: AdminPaginationProps) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 flex-shrink-0">
      <p className="text-caption text-gray-700">Mostrando {from}–{to} de {total}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-icon-md" />
        </Button>
        <span className="text-caption text-gray-700" aria-live="polite">{page} / {pageCount}</span>
        <Button variant="outline" size="icon" aria-label="Página siguiente" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="size-icon-md" />
        </Button>
      </div>
    </nav>
  );
}

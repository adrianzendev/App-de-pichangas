import type { ReactNode } from "react";
import { useState } from "react";
import { BackButton } from "@/components/ui/back-button";
import { SearchField } from "@/components/ui/search-field";
import { SearchToggleButton } from "@/components/ui/search-toggle-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ListHeaderSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Texto para lectores de pantalla; el boton de la lupa lo usa tambien. */
  label: string;
  /** `data-testid` del campo; el de la lupa es `${testId}-toggle`. */
  testId: string;
}

interface ListHeaderProps {
  title: string;
  subtitle?: string;
  /** Flecha de regreso a la izquierda del titulo (pantallas sin barra inferior). */
  onBack?: () => void;
  search?: ListHeaderSearch;
  /** Campo siempre visible y sin lupa (escritorio); si no, la lupa a la derecha del titulo lo despliega. */
  searchAlwaysOpen?: boolean;
  /** Oculta la fila del titulo desde `lg` (cuando el titulo ya va en el banner, ver PageBannerSheet). */
  hideTitleOnDesktop?: boolean;
  className?: string;
  /** Filtros y acciones bajo el buscador. */
  children?: ReactNode;
}

// Cabecera unica de las pantallas de lista (Pedidos, Tutores, Mensajes, y Publicar en movil): titulo (+ subtitulo,
// + flecha de regreso), buscador y filtros. El buscador es un `SearchField` que la lupa de la fila del titulo
// despliega con autofocus (Escape lo cierra); con texto buscado y el campo cerrado, la lupa lleva un punto verde.
// El titulo arranca arriba en todas las pantallas (items-start); los botones de 40px suben 4px para centrarse en su linea.
// Una sola fuente del comportamiento: no armar `<h1>` + `SearchField` a mano en cada pantalla.
export function ListHeader({ title, subtitle, onBack, search, searchAlwaysOpen = false, hideTitleOnDesktop = false, className, children }: ListHeaderProps) {
  const [open, setOpen] = useState(false);
  const collapsible = !!search && !searchAlwaysOpen;
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className={cn("flex items-start gap-1", hideTitleOnDesktop && "lg:hidden")}>
        {onBack && <BackButton onClick={onBack} className="-ml-2.5 -mt-1 lg:ml-0" data-testid="back-button" />}
        <div className="min-w-0 flex-1">
          <h1 className="text-heading font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-body text-gray-700">{subtitle}</p>}
        </div>
        {collapsible && (
          <div className="-mr-2 -mt-1 shrink-0 lg:mr-0">
            <SearchToggleButton
              open={open}
              active={!!search.value.trim()}
              onClick={() => setOpen((o) => !o)}
              aria-label={search.label}
              data-testid={`${search.testId}-toggle`}
            />
          </div>
        )}
      </div>
      {search && (searchAlwaysOpen || open) && (
        <SearchField
          placeholder={search.placeholder}
          aria-label={search.label}
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          autoFocus={collapsible}
          onKeyDown={(e) => { if (collapsible && e.key === "Escape") setOpen(false); }}
          wrapperClassName={collapsible ? "animate-in fade-in slide-in-from-top-2 duration-200" : undefined}
          data-testid={search.testId}
        />
      )}
      {children}
    </div>
  );
}

// Esqueleto de `ListHeader` (titulo, subtitulo y barra de filtros de 48px): los estados de carga lo ponen dentro del mismo
// `ListScreen` que el contenido real para que la pantalla no salte al cargar.
export function ListHeaderSkeleton({ subtitle = true, filters = true }: { subtitle?: boolean; filters?: boolean }) {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="space-y-2">
        <Skeleton className="h-skeleton-title w-skeleton-title-w" />
        {subtitle && <Skeleton className="h-skeleton-line w-2/3" />}
      </div>
      {filters && <Skeleton className="h-field w-full rounded-md" />}
    </div>
  );
}

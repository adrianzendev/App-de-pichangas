import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SIDEBAR_ROW, SidebarSlot } from "@/components/ui/sidebar-row";
import { BrandLogo } from "@/components/brand-logo";

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
  /** Hover/foco: precarga el chunk y los datos de la pestana antes del clic. */
  onPrefetch?: () => void;
  badge?: ReactNode;
  /** Accion principal del menu (Publicar): boton verde solido en vez de fila de texto. */
  primary?: boolean;
}

interface SidebarNavProps {
  items: SidebarNavItem[];
  /** Perfil abajo del sidebar. Sin esto no se pinta (la app lo lleva en la cabecera de escritorio). */
  profile?: ReactNode;
  /** Sin logo arriba. */
  hideLogo?: boolean;
  /** Con esto el logo es un boton (p. ej. ir al inicio). */
  onLogoClick?: () => void;
  /** Filas en pildora que se ajustan al contenido (estilo X). Ver `SidebarNavList`. */
  pill?: boolean;
  className?: string;
  "data-testid"?: string;
}

interface SidebarNavListProps {
  items: SidebarNavItem[];
  /** Estilo X: el resaltado (hover / activo) es una pildora que mide lo que mide su contenido, no una barra a todo el ancho. */
  pill?: boolean;
  /** Prefijo de `data-testid`: el aside de escritorio y el menu movil pueden estar montados a la vez. */
  testIdPrefix?: string;
}

// Filas del menu: UN solo origen para el sidebar de escritorio y el menu movil de Admin (estado activo,
// contadores, foco, alineacion). El contenedor debe ser `flex flex-col gap-2`.
export function SidebarNavList({ items, testIdPrefix = "nav-desktop", pill = false }: SidebarNavListProps) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        if (item.primary) {
          return (
            <Button
              key={item.id}
              aria-current={item.isActive ? "page" : undefined}
              onClick={item.onClick}
              onPointerEnter={item.onPrefetch}
              onFocus={item.onPrefetch}
              size={pill ? "xxl" : "lg"}
              // En pildora, como las demas filas: en reposo seminegrita y activo en negrita.
              className={cn("my-2 w-full", pill && !item.isActive && "font-semibold")}
              data-testid={`${testIdPrefix}-${item.id}`}
            >
              {/* Estilo X ("Postear"): en pildora el boton principal va solo con texto, sin icono. */}
              {!pill && <Icon className="size-icon-md" />}
              {item.label}
            </Button>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            aria-current={item.isActive ? "page" : undefined}
            onClick={item.onClick}
            onPointerEnter={item.onPrefetch}
            onFocus={item.onPrefetch}
            className={cn(
              SIDEBAR_ROW,
              "transition-colors relative text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              pill ? "w-fit max-w-full self-start rounded-full py-3 pl-3 pr-6 text-nav" : "text-body",
              // Pildora (estilo X): el activo va en negrita y sin fondo; el gris es solo del hover.
              item.isActive
                ? cn("text-gray-900 hover:bg-gray-50", pill ? "bg-transparent font-bold" : "w-full rounded-md bg-gray-50 font-semibold")
                : cn("bg-transparent text-gray-700 hover:bg-gray-50 hover:text-gray-900", !pill && "rounded-md")
            )}
            data-testid={`${testIdPrefix}-${item.id}`}
          >
            <SidebarSlot>
              <Icon className="size-icon-nav" />
              {item.badge}
            </SidebarSlot>
            <span>{item.label}</span>
          </button>
        );
      })}
    </>
  );
}

// Sidebar desktop (>=1024px) compartido entre la app (student/tutor,
// via bottom-navigation.tsx) y Admin (admin-dashboard.tsx) — antes cada
// uno tenia su propio <aside> hardcodeado con tipografia, tamaño de
// icono, color de estado activo y posicion de perfil/logo distintos
// (auditoria: ver CLAUDE.md, no forma parte de la excepcion documentada
// de Admin ahi — esa excepcion es solo sobre no usar ThreeColumnLayout
// en el contenido central, no sobre el sidebar en si).
export function SidebarNav({ items, profile, hideLogo, onLogoClick, pill, className, "data-testid": dataTestId }: SidebarNavProps) {
  const logo = <BrandLogo size="md" tone="light" />;
  return (
    <aside data-testid={dataTestId} aria-label="Navegación principal" className={cn("hidden lg:flex lg:flex-col w-64 shrink-0 lg:h-full lg:overflow-y-auto border-r border-gray-100 bg-white py-6 px-4 gap-2", className)}>
      {/* Arriba: logo, alineado con el borde de los iconos. */}
      {!hideLogo && (
        <div className="px-4 pb-4">
          {onLogoClick ? (
            <button
              type="button"
              onClick={onLogoClick}
              aria-label="Ir al inicio"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {logo}
            </button>
          ) : logo}
        </div>
      )}
      <SidebarNavList items={items} pill={pill} />
      {/* Abajo, como WhatsApp Web: avatar de perfil (su menu abre hacia arriba), centrado bajo los iconos. */}
      {profile && (
        <div className="mt-auto pt-4">
          {profile}
        </div>
      )}
    </aside>
  );
}

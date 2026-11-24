import type { ReactNode } from "react";

// Fila del sidebar de escritorio: UN solo origen para items de menu y trigger de perfil, asi icono/avatar
// y etiqueta quedan alineados. `SidebarSlot` es la columna del icono (token --sidebar-slot en index.css, igual a --avatar-xs):
// iconos (`size-icon-nav`) y avatar `xs` comparten eje. --sidebar-slot = --avatar-xs: un solo valor en index.css.
export const SIDEBAR_ROW = "flex items-center gap-3 rounded-md px-3 py-2.5";

export function SidebarSlot({ children }: { children: ReactNode }) {
  return <div className="relative flex size-sidebar-slot shrink-0 items-center justify-center">{children}</div>;
}

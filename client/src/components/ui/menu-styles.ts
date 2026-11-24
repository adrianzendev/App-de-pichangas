// Estilo unico de menus desplegables (Select, DropdownMenu, ContextMenu, Combobox).
// Panel blanco rounded-lg con sombra suave; el hover/foco del item es gris neutro (gray-100),
// nunca verde. Cambiar aca cambia todos los desplegables de la app.
export const menuPanelClass =
  "rounded-lg border border-border bg-card p-1 text-gray-900 shadow-md";

export const menuItemClass =
  "relative flex cursor-default select-none items-center rounded-md px-2 py-2 text-label outline-none transition-colors focus:bg-gray-100 focus:text-gray-900 data-[state=open]:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

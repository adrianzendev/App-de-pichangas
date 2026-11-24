import type { ComponentType, MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface TaskAction {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  /** Accion destructiva (cancelar, eliminar): texto `error-fg`. */
  destructive?: boolean;
  testId?: string;
}

interface TaskActionsMenuProps {
  actions: TaskAction[];
  triggerTestId?: string;
  className?: string;
}

// Menu "⋮" unico de pedidos (tarjeta de la lista y cabecera del detalle). Usa DropdownMenu
// (panel, foco y z-index de `menu-styles.ts`); no armar menus a mano con `shadow-md` + overlay.
export function TaskActionsMenu({ actions, triggerTestId, className }: TaskActionsMenuProps) {
  // El menu va en un portal pero React propaga los eventos al ancestro: sin esto, tocar el
  // menu o un item dispararia el onClick de la tarjeta (abrir el pedido).
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Acciones del pedido"
          onClick={stop}
          className={cn(className)}
          data-testid={triggerTestId}
        >
          <MoreVertical className="size-icon-lg" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={stop}>
        {actions.map(({ label, icon: Icon, onSelect, destructive, testId }) => (
          <DropdownMenuItem
            key={label}
            onSelect={onSelect}
            className={cn(destructive && "text-error-fg focus:text-error-fg")}
            data-testid={testId}
          >
            <Icon className="size-icon-md" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { MoreVertical } from "lucide-react";
import { ChatIconButton } from "./chat-icon-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Una opcion del menu de la tarjeta de cotizacion.
 */
export interface QuoteCardMenuItem {
  /** Texto visible. */
  label: string;
  /** Ejecuta la opcion. */
  onSelect: () => void;
  /** `data-testid` opcional del item. */
  testId?: string;
}

/**
 * Propiedades de {@link QuoteCardMenu}.
 */
export interface QuoteCardMenuProps {
  items: QuoteCardMenuItem[];
  /** Mensaje propio: el menu se abre a la izquierda; recibido, a la derecha (misma regla que {@link MessageMenuTrigger}). */
  isCurrentUser: boolean;
  /** `data-testid` del boton de tres puntos. */
  testId?: string;
}

/**
 * Menu de tres puntos (siempre visible) de la tarjeta de cotizacion de un mensaje.
 *
 * @param {QuoteCardMenuProps} props - Opciones, lado del mensaje y testid.
 * @returns {JSX.Element | null} El boton con su menu (nada si no hay opciones).
 */
export function QuoteCardMenu({ items, isCurrentUser, testId }: QuoteCardMenuProps) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ChatIconButton aria-label="Opciones de la cotización" className="-mt-2.5 -mr-2.5" data-testid={testId}>
          <MoreVertical className="size-icon-md" />
        </ChatIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isCurrentUser ? "end" : "start"}>
        {items.map(({ label, onSelect, testId: itemTestId }) => (
          <DropdownMenuItem key={label} onClick={onSelect} data-testid={itemTestId}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

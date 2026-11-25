import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionItems, type MenuAction } from "./menu-actions";

/**
 * Estilo de la flecha: `default` (texto y documentos) o `image-overlay` (sobre fotos,
 * en blanco con sombra para leerse sobre cualquier imagen).
 */
export type MenuTriggerVariant = "default" | "image-overlay";

/** Misma flecha (16 px) en todos lados: solo cambia el color segun el fondo. */
const ICON_CLASS: Record<MenuTriggerVariant, string> = {
  default: "size-icon-md text-gray-700/70 hover:text-gray-900 transition-colors cursor-pointer",
  "image-overlay": "size-icon-md text-white/90 hover:text-white drop-shadow cursor-pointer",
};

/**
 * Oculta por defecto y solo aparece al pasar el cursor sobre la burbuja (`group`), estilo
 * WhatsApp Web. En movil (< md) no se muestra: alli el menu se abre con pulsacion larga. En pantallas tactiles sin hover (tablet)
 * queda siempre visible (`hover-none:`) y con area de toque de 40px (`p-3 -m-3` sobre el icono de 16px).
 */
const APPEAR = "hidden md:inline-flex opacity-0 hover-none:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity duration-150";

/**
 * Propiedades de {@link MessageMenuTrigger}.
 */
export interface MessageMenuTriggerProps {
  /** Acciones del mensaje (las mismas que el clic derecho). */
  actions: MenuAction[];
  /** Estilo de la flecha segun el fondo donde se dibuja. */
  variant?: MenuTriggerVariant;
  /** Posicion (p. ej. `absolute top-1 right-1 z-dropdown`); sin ella, va en el flujo (dentro de una tarjeta). */
  className?: string;
  /** Lado de la flecha al que se ancla el menu: `end` (propios, se abre a la izquierda) o `start` (recibidos, se abre a la derecha). */
  align?: "start" | "end";
}

/**
 * Activador unico del menu de un mensaje: la flecha `ChevronDown` como disparador de
 * un `DropdownMenu` de Radix (clic o tap). Sin fondos circulares ni badges: es el
 * mismo icono de 16 px en mensajes de texto, documentos y fotos.
 *
 * @param {MessageMenuTriggerProps} props - Acciones, variante de color y posicion.
 * @returns {JSX.Element | null} La flecha con su menu (nada si no hay acciones).
 */
export function MessageMenuTrigger({ actions, variant = "default", className = "", align = "end" }: MessageMenuTriggerProps) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Opciones del mensaje"
          className={`flex-shrink-0 p-3 -m-3 ${APPEAR} ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <ChevronDown className={ICON_CLASS[variant]} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <ActionItems actions={actions} Item={DropdownMenuItem} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { ArrowLeft, Ban, Flag, MoreVertical, User } from "lucide-react";
import { ChatIconButton } from "./chat-icon-button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TypingIndicator } from "./TypingIndicator";

/**
 * Propiedades de {@link ChatHeader}.
 */
export interface ChatHeaderProps {
  /** Nombre a mostrar (el tutor ve un alias del alumno, no el real). */
  displayName: string;
  avatar?: string | null;
  /** Id de la otra persona (presencia y avatar). */
  userId: string;
  lastSeen?: string | Date | null;
  /** Presencia en tiempo real (WebSocket): si es true muestra "En linea" en vez de lastSeen. */
  isOnline?: boolean;
  /** La otra persona esta redactando: reemplaza el estado de conexion por "Escribiendo...". */
  typing?: boolean;
  /** Split-view desktop: sin boton de volver (la lista ya esta visible) y mas padding lateral. */
  embedded?: boolean;
  onBack?: () => void;
  /** Toda la zona de contacto abre el perfil cuando existe. */
  onOpenProfile?: () => void;
  /** Si existe, aparece el menu de tres puntos con "Ver perfil" (abre este callback). */
  onViewProfile?: () => void;
  /** Si existe, el menu ofrece "Reportar usuario". */
  onReport?: () => void;
  /** Si existe, el menu ofrece bloquear (o desbloquear si `isBlocked`). */
  onBlockToggle?: () => void;
  isBlocked?: boolean;
}

/**
 * Barra superior del chat: volver, contacto (avatar + nombre + estado/"Escribiendo...") y menu.
 * Presentacional: no consulta datos ni abre modales; todo llega por props.
 *
 * @param {ChatHeaderProps} props - Contacto, estado y callbacks.
 * @returns {JSX.Element} La cabecera.
 */
export function ChatHeader({ displayName, avatar, userId, lastSeen, isOnline, typing, embedded, onBack, onOpenProfile, onViewProfile, onReport, onBlockToggle, isBlocked }: ChatHeaderProps) {
  // El contacto es un <button> (teclado y foco) solo si abre el perfil; si no, un contenedor normal.
  const Contact = onOpenProfile ? "button" : "div";
  return (
    <div className="bg-white shadow-sm">
      {!embedded && <div aria-hidden className="h-safe-top" />}
      <div className={`${embedded ? "pr-6" : "px-2"} py-3 flex items-center gap-2`}>
        {!embedded && onBack && (
          <ChatIconButton aria-label="Volver" onClick={onBack}>
            <ArrowLeft className="size-icon-lg" />
          </ChatIconButton>
        )}

        {/* Contacto: UN solo area clicable que abre el perfil (estilo WhatsApp Web). */}
        <Contact
          {...(onOpenProfile ? { type: "button" as const, onClick: onOpenProfile } : {})}
          className={`flex items-center gap-3 flex-1 min-w-0 py-1 text-left select-none${onOpenProfile ? " cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}`}
        >
          <UserAvatar name={displayName} avatar={avatar} size="md" userId={userId} />
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 font-semibold text-body truncate">{displayName}</p>
            <div className="flex items-center gap-2 min-w-0">
              {typing ? (
                <TypingIndicator variant="label" />
              ) : (
                <PresenceIndicator userId={userId} showLabel hideDot size="sm" className="flex-shrink-0" isOnline={isOnline} lastSeen={lastSeen} />
              )}
            </div>
          </div>
        </Contact>

        {(onViewProfile || onReport || onBlockToggle) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ChatIconButton aria-label="Opciones del chat">
                <MoreVertical className="size-icon-lg" />
              </ChatIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onViewProfile && (
                <DropdownMenuItem onSelect={onViewProfile}>
                  <User className="size-icon-md mr-2" /> Ver perfil
                </DropdownMenuItem>
              )}
              {onReport && (
                <DropdownMenuItem onSelect={onReport} data-testid="menu-report-user">
                  <Flag className="size-icon-md mr-2" /> Reportar usuario
                </DropdownMenuItem>
              )}
              {onBlockToggle && (
                <DropdownMenuItem onSelect={onBlockToggle} data-testid="menu-block-user">
                  <Ban className="size-icon-md mr-2" /> {isBlocked ? "Desbloquear usuario" : "Bloquear usuario"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

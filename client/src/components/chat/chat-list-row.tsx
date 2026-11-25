import type { ReactNode } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PresenceIndicator, PRESENCE_ON_AVATAR } from "@/components/ui/presence-indicator";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { cn } from "@/lib/utils";

interface ChatListRowProps {
  name: string;
  avatar?: string | null;
  userId: string;
  isOnline: boolean;
  /** Hora relativa ("10:42", "7 oct"). */
  time: string;
  /** Ultimo mensaje (texto, icono + texto o "Escribiendo..."): una sola linea. */
  preview: ReactNode;
  unreadCount: number;
  selected?: boolean;
  onClick: () => void;
  onPointerEnter?: () => void;
  onTouchStart?: () => void;
  "data-testid"?: string;
}

// Fila de la lista de conversaciones (estilo WhatsApp / iOS): a todo el ancho de la lista, sin tarjeta, esquinas ni divisor
// (las separa el espacio de 72px de alto). Avatar de 48px + nombre + hora + ultimo mensaje en una linea y contador verde.
// Abierta = gris suave (`bg-gray-50`, el mismo color del hover). La lista que la contiene debe sangrar al borde
// (`-mx-card-gap`, ver messages-section.tsx).
export function ChatListRow({ name, avatar, userId, isOnline, time, preview, unreadCount, selected, onClick, onPointerEnter, onTouchStart, ...rest }: ChatListRowProps) {
  const unread = unreadCount > 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onPointerEnter={onPointerEnter}
      onTouchStart={onTouchStart}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 px-4 py-card-pad transition-colors active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        selected ? "bg-gray-50" : "bg-white hover:bg-gray-50"
      )}
      data-testid={rest["data-testid"]}
    >
      <div className="relative shrink-0">
        <UserAvatar name={name} avatar={avatar} size="mdl" />
        <PresenceIndicator userId={userId} isOnline={isOnline} className={PRESENCE_ON_AVATAR} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-body font-semibold text-gray-900">{name}</h3>
          <span className={cn("shrink-0 text-caption", unread ? "font-semibold text-primary-600" : "text-gray-700")}>{time}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={cn("flex min-w-0 flex-1 items-center text-label", unread ? "font-semibold text-gray-900" : "font-normal text-gray-700")}>{preview}</p>
          <UnreadBadge count={unreadCount} max={9} size="md" />
        </div>
      </div>
    </div>
  );
}

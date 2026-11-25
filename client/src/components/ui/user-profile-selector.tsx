import { UserAvatar, type AvatarSize } from "@/components/ui/user-avatar";
import { SIDEBAR_ROW, SidebarSlot } from "@/components/ui/sidebar-row";
import { cn } from "@/lib/utils";

interface UserProfileSelectorProps {
  avatar?: string | null;
  name: string;
  /** Sidebar de escritorio: muestra el nombre junto al avatar (truncado). Header movil: solo avatar. */
  showName?: boolean;
  /** Tamano del avatar; `xs` (por defecto) comparte eje con los iconos del sidebar. */
  avatarSize?: AvatarSize;
  isOpen: boolean;
  onClick: () => void;
  className?: string;
  /** Color/estilo extra del nombre (tema oscuro del jugador); por defecto gris oscuro. */
  nameClassName?: string;
  "data-testid"?: string;
}

// Trigger del perfil en el sidebar: una fila de menu (SIDEBAR_ROW) con avatar y, con showName, el nombre truncado.
// Compartido entre Admin y App (via ProfileMenuButton). Sin borde, chevron, hover ni tooltip; el nombre va tambien
// en aria-label. Cada consumidor arma su propio panel desplegable.
export function UserProfileSelector({ avatar, name, showName, avatarSize = "xs", isOpen, onClick, className, nameClassName, "data-testid": testId }: UserProfileSelectorProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      data-testid={testId}
      className={cn(SIDEBAR_ROW, "bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
    >
      {avatarSize === "xs" ? (
        <SidebarSlot>
          <UserAvatar name={name} avatar={avatar} size="xs" />
        </SidebarSlot>
      ) : (
        // Avatar mayor que la columna del icono (cabecera de escritorio): fuera de SidebarSlot para que no se desborde.
        <UserAvatar name={name} avatar={avatar} size={avatarSize} />
      )}
      {showName && <span className={cn("min-w-0 flex-1 truncate text-left text-body font-medium text-gray-900", nameClassName)}>{name}</span>}
    </button>
  );
}

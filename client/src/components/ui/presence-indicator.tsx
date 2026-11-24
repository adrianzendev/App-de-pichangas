import { getTimeAgo } from "@/lib/connection-utils";
import { useWebSocketFixed } from "@/hooks/useWebSocketFixed";

/** Punto sobre un avatar: su centro cae en el borde del circulo a 45 grados, en cualquier tamano. El padre debe ser `relative` y medir como el avatar. */
export const PRESENCE_ON_AVATAR = "absolute bottom-presence-offset right-presence-offset z-sticky translate-x-1/2 translate-y-1/2";

/** Propiedades de {@link PresenceIndicator}. */
interface PresenceIndicatorProps {
  /** Usuario del que se muestra la presencia. Si no se pasa `isOnline`, se lee del WebSocket con este id. */
  userId: string;
  className?: string;
  /** Muestra el texto: "En línea" o hace cuanto se conecto ("Hace 5 min", "Hace 3 horas"). */
  showLabel?: boolean;
  /** Tamano del punto: `sm` (10px) o `md` (12px). */
  size?: 'sm' | 'md';
  /** Fuerza el estado (p. ej. `onlineUsers.has(id)` que la pantalla ya tiene). Sin esto consulta al WebSocket. */
  isOnline?: boolean;
  /** Ultima conexion (`user.lastSeen`); se usa para el texto cuando no esta en linea. */
  lastSeen?: string | Date | null;
  /** Oculta el punto y deja solo el texto (perfil del tutor, cabecera del chat). */
  hideDot?: boolean;
}

/**
 * Estado de conexion de un usuario: punto (verde en linea / gris desconectado) y/o texto.
 * Es el unico lugar para mostrar presencia: no armar punto y texto a mano en cada pantalla.
 * El calculo del "hace cuanto" vive en `getTimeAgo` (`@/lib/connection-utils`).
 *
 * @example
 * <PresenceIndicator userId={tutor.user.id} showLabel hideDot size="sm" isOnline={isOnline} lastSeen={tutor.user.lastSeen} />
 */
export function PresenceIndicator({ userId, className = "", showLabel = false, size = 'md', isOnline: isOnlineProp, lastSeen, hideDot = false }: PresenceIndicatorProps) {
  // Sin prop: lee la presencia del singleton WS (sin userId no abre conexion, solo se suscribe).
  const { onlineUsers } = useWebSocketFixed();
  const isOnline = isOnlineProp ?? onlineUsers.has(userId);

  const sizeClass = size === 'sm' ? 'size-presence-sm' : 'size-presence-md';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!hideDot && (
        <span
          className={`${sizeClass} rounded-full border-2 border-white ${
            isOnline
              ? 'bg-success'
              : 'bg-gray-300'
          }`}
          title={isOnline ? 'En línea' : 'Desconectado'}
          data-testid={`presence-${userId}-${isOnline ? 'online' : 'offline'}`}
        />
      )}
      {/* `lastSeen` undefined = el dato aun carga: no pintar "Sin conexión" un instante. null = nunca se conecto. */}
      {showLabel && (isOnline || lastSeen !== undefined) && (
        <span className={`text-body ${
          isOnline
            ? 'text-success-fg font-medium'
            : 'text-gray-700'
        }`}>
          {isOnline ? 'En línea' : getTimeAgo(lastSeen ?? null, false)}
        </span>
      )}
    </div>
  );
}

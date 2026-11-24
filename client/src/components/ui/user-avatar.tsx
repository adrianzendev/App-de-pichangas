// Escala de tamanos: 2xs = celdas de tabla densas, xs = inline con el nombre, sm = listas, md = tarjetas (default),
// lg = perfiles, xl = cabeceras. Los valores viven en index.css (--avatar-*): ningun tamano en px suelto aqui.
export const AVATAR_SIZES = {
  "2xs": "var(--avatar-2xs)", xs: "var(--avatar-xs)", sm: "var(--avatar-sm)", md: "var(--avatar-md)",
  mdl: "var(--avatar-mdl)", lg: "var(--avatar-lg)", xl: "var(--avatar-xl)",
} as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

interface UserAvatarProps {
  name?: string | null;
  avatar?: string | null;
  size?: AvatarSize;
  className?: string;
  userId?: string;
  showPresence?: boolean;
}

function getInitials(name: string): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

import { useEffect, useState } from "react";
import { PresenceIndicator, PRESENCE_ON_AVATAR } from "@/components/ui/presence-indicator";

// Iniciales ~40% del avatar, mapeado al token de tipografia mas cercano
// (clases literales: Tailwind las detecta por escaneo de texto estatico).
const INITIALS_TEXT: Record<AvatarSize, string> = {
  "2xs": "text-xs", xs: "text-xs", sm: "text-xs", md: "text-base", mdl: "text-xl", lg: "text-xl", xl: "text-3xl",
};

// Tamano en px de cada token (--avatar-* de index.css): atributos width/height del <img> para no mover el
// diseno al cargar. Mantener alineado con index.css.
const AVATAR_PX: Record<AvatarSize, number> = { "2xs": 20, xs: 24, sm: 32, md: 40, mdl: 48, lg: 64, xl: 100 };

// Ancho que se pide al servidor: cubre pantallas hasta 3x (20-32px -> 96, 40-48px -> 192, 64-100px -> 320).
// El servidor solo acepta 96/192/320/640 (server/object_storage/routes.ts).
const AVATAR_FETCH_W: Record<AvatarSize, 96 | 192 | 320> = { "2xs": 96, xs: 96, sm: 96, md: 192, mdl: 192, lg: 320, xl: 320 };

// Normaliza URLs de avatar y pide la miniatura del tamano justo:
// - /objects/ → URL absoluta + miniatura cuadrada WebP (?w=N&sq=1) en vez del original.
// - Google (lh3.googleusercontent.com) → sufijo =sN-c (cuadrado recortado) en vez del tamano original.
// - /uploads/ (disco antiguo), otras URLs y data URIs → tal cual (sin miniatura posible).
function resolveAvatarUrl(avatar: string, size: AvatarSize): string {
  if (!avatar) return '';
  const w = AVATAR_FETCH_W[size];
  if (avatar.startsWith('/objects/') || avatar.includes('/objects/uploads/')) {
    const abs = avatar.startsWith('/objects/') ? `${window.location.protocol}//${window.location.host}${avatar}` : avatar;
    return `${abs}${abs.includes('?') ? '&' : '?'}w=${w}&sq=1`;
  }
  if (/^https:\/\/lh\d+\.googleusercontent\.com\//.test(avatar) && !avatar.includes('?')) {
    return /=s\d+(-c)?$/.test(avatar) ? avatar.replace(/=s\d+(-c)?$/, `=s${w}-c`) : `${avatar}=s${w}-c`;
  }
  return avatar;
}

// Indices (0-based) de --avatar-color-N donde las iniciales OSCURAS contrastan mas (>=4.5:1) que las
// blancas: colores 1, 3, 5, 8, 9, 11, 12, 14, 15 de index.css. En el resto van blancas.
// Si se cambia un --avatar-color-N, recalcular el contraste de ese indice.
const LIGHT_AVATAR_COLORS = new Set([0, 2, 4, 7, 8, 10, 11, 13, 14]);

function getAvatarColorIndex(name: string): number {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 15;
}

function getAvatarColor(name: string): string {
  const colors = [
    'var(--avatar-color-1)',  'var(--avatar-color-2)',  'var(--avatar-color-3)',
    'var(--avatar-color-4)',  'var(--avatar-color-5)',  'var(--avatar-color-6)',
    'var(--avatar-color-7)',  'var(--avatar-color-8)',  'var(--avatar-color-9)',
    'var(--avatar-color-10)', 'var(--avatar-color-11)', 'var(--avatar-color-12)',
    'var(--avatar-color-13)', 'var(--avatar-color-14)', 'var(--avatar-color-15)',
  ];
  
  return colors[getAvatarColorIndex(name)];
}

export function UserAvatar({ name, avatar, size: sizeProp = "md", className = "", userId, showPresence = false }: UserAvatarProps) {
  const size = AVATAR_SIZES[sizeProp];
  const safeName = name || "Usuario";
  const initials = getInitials(safeName);
  const backgroundColor = getAvatarColor(safeName);
  const initialsColor = LIGHT_AVATAR_COLORS.has(getAvatarColorIndex(safeName)) ? 'var(--gray-900)' : 'var(--white)';

  // Detectar si hay avatar real - acepta /uploads/, /objects/ o cualquier URL válida (http/https)
  const hasRealAvatar = avatar && (
    avatar.startsWith('/uploads/') || 
    avatar.startsWith('/objects/') ||
    avatar.startsWith('http://') || 
    avatar.startsWith('https://') ||
    avatar.startsWith('data:image/')
  );
  // La foto puede apuntar a un archivo que ya no existe (404): cae a iniciales via estado de React
  // (no mutando el DOM), y se reintenta si cambia la URL.
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [avatar]);
  const showInitials = !hasRealAvatar || imageFailed;

  // Normalizar la URL del avatar para manejar rutas /objects/ y URLs absolutas
  const avatarSrc = hasRealAvatar ? resolveAvatarUrl(avatar!, sizeProp) : '';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div 
        className={`relative overflow-hidden ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          backgroundColor: showInitials ? backgroundColor : 'var(--gray-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
      {!showInitials ? (
        <img
          src={avatarSrc}
          alt=""
          width={AVATAR_PX[sizeProp]}
          height={AVATAR_PX[sizeProp]}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            display: 'block'
          }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          className={`${INITIALS_TEXT[sizeProp]} font-semibold leading-none flex items-center justify-center w-full h-full text-center`}
          style={{ color: initialsColor }}
        >
          {initials}
        </span>
      )}
      </div>
      
      {/* Presence indicator */}
      {showPresence && userId && (
        <PresenceIndicator userId={userId} className={PRESENCE_ON_AVATAR} />
      )}
    </div>
  );
}
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { UserAvatar, type AvatarSize } from "./user-avatar";
import { PresenceIndicator, PRESENCE_ON_AVATAR } from "./presence-indicator";
import { tutorTypography } from "./tutor-typography";

interface TutorIdentityProps {
  name: string;
  avatar?: string | null;
  profession?: string | null;
  /** En la misma linea, antes de la profesion (p. ej. la calificacion en los destacados). */
  beforeProfession?: ReactNode;
  avatarSize?: AvatarSize;
  /** Con `userId` + `isOnline` se pinta el punto de presencia sobre el avatar. */
  userId?: string;
  isOnline?: boolean;
  align?: "start" | "center";
  /** Debajo de la profesion: calificacion, trabajos completados, etc. */
  children?: ReactNode;
  className?: string;
}

// Identidad del tutor (avatar + nombre + profesion + metadatos): un solo origen para la tarjeta de /tutors
// (TutorListItem), los candidatos de un pedido, los destacados del Inicio y las filas de "Invitar tutor" de Publicar.
export function TutorIdentity({ name, avatar, profession, beforeProfession, avatarSize = "mdl", userId, isOnline, align = "center", children, className }: TutorIdentityProps) {
  return (
    <div className={cn("flex min-w-0 flex-1 gap-3", align === "start" ? "items-start" : "items-center", className)}>
      <div className="relative shrink-0">
        <UserAvatar name={name} avatar={avatar || undefined} size={avatarSize} />
        {userId && isOnline !== undefined && <PresenceIndicator userId={userId} isOnline={isOnline} className={PRESENCE_ON_AVATAR} />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-body font-semibold text-gray-900">{name}</h3>
        {(profession || beforeProfession) && (
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            {beforeProfession}
            {profession && <p className={cn(tutorTypography.profession, "min-w-0 truncate")}>{profession}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

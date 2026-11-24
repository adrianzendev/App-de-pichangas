import { VerifiedBadge } from "@/components/ui/verified-badge";
import { RatingStars, formatRating } from "@/components/ui/rating-stars";
import { pluralizeEs } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { Button } from "./button";
import { TutorChatButton } from "./tutor-chat-button";
import { Card } from "./card";
import { SpecialtyBadges } from "./specialty-badges";
import { tutorTypography } from "./tutor-typography";

const MAX_VISIBLE_SPECIALTIES = 3;

interface TutorListItemProps {
  name: string;
  avatar?: string | null;
  profession?: string | null;
  specialties?: string[] | null;
  rating?: string | null;
  reviewCount?: number;
  completedTasksCount?: number;
  isVerified?: boolean | null;
  /** Abre el perfil (toda la tarjeta y el boton "Ver perfil"). */
  onClick?: () => void;
  /** Boton "Chat"; no abre el perfil. */
  onMessageClick?: () => void;
  /** Id del tutor: con `isOnline` muestra el punto de presencia sobre el avatar. */
  userId?: string;
  isOnline?: boolean;
}

// Tarjeta de tutor para la grilla de /tutors: avatar con presencia, nombre, calificacion, insignia de verificado,
// especialidades en una linea, pedidos completados y las dos acciones (Chat / Ver perfil).
export function TutorListItem({
  name,
  avatar,
  profession,
  specialties,
  rating,
  reviewCount = 0,
  completedTasksCount = 0,
  isVerified,
  onClick,
  onMessageClick,
  userId,
  isOnline,
}: TutorListItemProps) {
  const hasRating = !!rating && Number(rating) > 0;
  const ratingValue = rating ? formatRating(Number(rating)) : null;

  return (
    <Card
      className={cn("flex h-full flex-col gap-4 rounded-lg p-bento-pad shadow-none cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2")}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick?.(); } }}
    >
      <div className="flex items-start gap-3">
        <UserAvatar name={name} avatar={avatar} size="lg" userId={isOnline ? userId : undefined} showPresence={!!isOnline} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-body font-semibold text-gray-900">
            {isVerified && <VerifiedBadge />}
            <span className="truncate">{name}</span>
          </p>
          {profession && <p className={cn(tutorTypography.profession, "truncate")}>{profession}</p>}
          {hasRating && (
            <RatingStars compact value={Number(rating)} size="sm" label={<span className={tutorTypography.rating}>{ratingValue}{reviewCount > 0 ? ` (${reviewCount})` : ""}</span>} />
          )}
        </div>
      </div>

      <SpecialtyBadges specialties={specialties} max={MAX_VISIBLE_SPECIALTIES} />

      <p className={cn(tutorTypography.meta, "mt-auto")}>
        <span className="font-semibold text-gray-900">{completedTasksCount}</span> {pluralizeEs(completedTasksCount, "pedido completado", "pedidos completados")}
      </p>

      <div className="flex gap-2">
        {onMessageClick && (
          <TutorChatButton
            className="flex-1"
            onClick={(e) => { e.stopPropagation(); onMessageClick(); }}
            data-testid="tutor-message-button"
          />
        )}
        <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
          Ver perfil
        </Button>
      </div>
    </Card>
  );
}

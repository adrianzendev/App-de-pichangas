import { RatingStars, formatRating } from "@/components/ui/rating-stars";
import { pluralizeEs } from "@/lib/pluralize";
import { TutorChatButton } from "@/components/ui/tutor-chat-button";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { TutorIdentity } from "./tutor-identity";
import { EmptyState } from "./empty-state";
import { tutorTypography } from "./tutor-typography";
import { formatPrice } from "@/lib/timezone-utils";
import type { PublicTutor } from "@shared/schema";

interface Candidate {
  id: string;
  tutorId: string;
  tutor?: {
    id?: string;
    name?: string;
    avatar?: string | null;
    lastSeen?: Date | string | null;
  };
  proposedPrice?: string | number | null;
  message?: string;
}

interface CandidatesListProps {
  candidates: Candidate[];
  taskId: string;
  currency?: string | null;
  allTutors?: PublicTutor[];
  onCandidateClick: (candidate: Candidate) => void;
  onViewTutorProfile?: (candidate: Candidate) => void;
  getUnreadCount: (taskId: string, tutorId: string) => number;
  isUserOnline: (tutorId: string) => boolean;
}

export function CandidatesList({
  candidates,
  taskId,
  currency,
  allTutors,
  onCandidateClick,
  onViewTutorProfile,
  getUnreadCount,
  isUserOnline,
}: CandidatesListProps) {
  if (!candidates || candidates.length === 0) {
    return (
      <EmptyState className="flex flex-1 flex-col items-center justify-center" title="Sin candidatos" description="Los tutores interesados aparecerán aquí" />
    );
  }

  return (
    <div className="flex flex-col gap-card-gap p-card-gap">
      {candidates.map((candidate) => {
        const { tutorId } = candidate;
        const isOnline = isUserOnline(tutorId);
        const unreadCount = getUnreadCount(taskId, tutorId);
        const tutorRecord = allTutors?.find((t) => t.user_id === tutorId);
        const rating = parseFloat(tutorRecord?.rating || "0");
        const completedTasksCount = (tutorRecord as any)?.completedTasksCount || 0;

        // proposedPrice se mantiene al dia server-side cuando el tutor manda
        // "Nueva cotizacion" (ver PATCH /api/candidates/:taskId/:tutorId/price)
        // — es por-candidato, no se cruza con la cotizacion de otro tutor.
        const price = candidate.proposedPrice || "0";

        return (
          <div
            key={candidate.id}
            className="cursor-pointer rounded-lg border border-field bg-white p-bento-pad transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            role="button"
            tabIndex={0}
            onClick={() => onCandidateClick(candidate)}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onCandidateClick(candidate); } }}
            data-testid={`candidate-${tutorId}`}
          >
            <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <TutorIdentity name={candidate.tutor?.name || "Tutor"} avatar={candidate.tutor?.avatar} avatarSize="md" userId={tutorId} isOnline={isOnline}>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <RatingStars value={rating} />
                  <span className={tutorTypography.meta}>{formatRating(rating)}</span>
                </div>
                {completedTasksCount > 0 && (
                  <p className={`${tutorTypography.meta} mt-0.5`}>
                    {completedTasksCount} {pluralizeEs(completedTasksCount, "pedido completado", "pedidos completados")}
                  </p>
                )}
              </TutorIdentity>
            </div>
            <span className="shrink-0 text-body font-semibold text-gray-900">{formatPrice(price, currency)}</span>
            <TutorChatButton className="relative shrink-0" onClick={(e) => { e.stopPropagation(); onCandidateClick(candidate); }} data-testid={`button-chat-${tutorId}`}>
              {unreadCount > 0 && (
                <UnreadBadge count={unreadCount} max={9} size="icon" />
              )}
            </TutorChatButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}

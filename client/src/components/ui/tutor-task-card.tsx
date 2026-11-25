import { fmtDeadline } from "@/lib/date-format";
import { pluralizeEs } from "@/lib/pluralize";
import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { getEffectiveStatus } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { anonymizeStudentData } from "@/utils/student-anonymization";
import { formatPrice } from "@/lib/timezone-utils";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import type { TaskWithCandidates } from "@shared/schema";
import { calcUsdEquivalent } from "@/lib/currency-utils";

interface LastMessageData {
  message: string;
  timestamp: string;
  fromCurrentUser: boolean;
  unreadCount: number;
}

interface TutorTaskCardProps {
  task: TaskWithCandidates;
  proposedPrice?: string | null;
  onClick: () => void;
  lastMessage?: LastMessageData | null;
  showLastMessage?: boolean;
  isNew?: boolean;
  currentTutorId?: string;
  isInvited?: boolean;
}

const calculateTimeRemaining = (deadline: string | Date, now: Date) => {
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();
  
  if (diff <= 0) {
    return { text: "Quedan 0d, 0h", expired: true };
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return { text: `Quedan ${days}d ${hours % 24}h`, expired: false };
  }
  
  return { text: `Quedan ${hours}h ${minutes}m`, expired: false };
};

export function TutorTaskCard({ task, proposedPrice, onClick, lastMessage, showLastMessage = false, isNew = false, currentTutorId, isInvited = false }: TutorTaskCardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: exchangeRates } = useExchangeRates();
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  
  const timeRemaining = calculateTimeRemaining(task.deadline, currentTime);
  
  // Determine if task was assigned to this tutor
  const isAssignedToMe = task.assignedTutorId && currentTutorId && task.assignedTutorId === currentTutorId;
  const paymentApproved = task.status === 'in_progress' || task.status === 'completed' || task.status === 'in_review';
  
  // Si el pago fue confirmado y YO no soy el asignado → siempre "Cerrado"
  // (evita mostrar "En progreso" a tutores no asignados aunque assignedTutorId llegue nulo)
  const effectiveStatus = (paymentApproved && currentTutorId && !isAssignedToMe)
    ? "ADJUDICATED"
    : getEffectiveStatus(task.status, timeRemaining.expired);
  
  // Check if this tutor has already applied
  const hasApplied = task.candidates?.some((c: any) => c.tutorId === currentTutorId);
  // Applications are closed if there's an assigned tutor and this tutor hasn't applied yet
  const applicationsClosed = task.assignedTutorId && !hasApplied;
  const displayPrice = proposedPrice || task.budget || '25';

  const usdEquivalent = calcUsdEquivalent(displayPrice, task.currency, exchangeRates?.rates);

  // Student info (anonymized for tutors)
  const studentData = task.user ? anonymizeStudentData(task.user, 'tutor') : null;

  const formatMessageTime = (timestamp: string) => {
    const messageTime = new Date(timestamp);
    const hours = messageTime.getHours();
    const minutes = messageTime.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer active:bg-gray-50 transition-colors"
      data-testid={`task-card-${task.id}`}
    >
      {/* Row 1: Title + Status/New Badge (derecha) */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-body font-semibold text-gray-900 line-clamp-2 break-words flex-1" style={{ overflowWrap: 'anywhere' }}>{task.title}</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isNew && (
            <Badge>Nuevo</Badge>
          )}
          {isInvited && (
            <Badge variant="secondary">Te invitaron</Badge>
          )}
          {/* El estado (status) se sigue guardando y usando en logica/backend; la tarjeta no pinta su badge. */}
        </div>
      </div>
      {/* Row 3: Description - Always 2 lines with ellipsis */}
      <p className="text-body text-gray-700 line-clamp-2 mb-2 break-words" style={{ overflowWrap: 'anywhere' }}>{task.description}</p>
      {/* Row 4: Tiempo restante + Candidatos */}
      <div className="flex flex-wrap items-center gap-2 text-caption text-gray-700">
        {!isAssignedToMe && (
          <>
            <span>{fmtDeadline(task.deadline)}</span>
            <span className="text-body leading-none font-bold text-gray-700">·</span>
          </>
        )}
        <span>{task.candidates?.length || 0} {pluralizeEs(task.candidates?.length || 0, "candidato")}</span>
      </div>
      {/* Row 5: Alumno + Precio, a los extremos */}
      <div className="flex items-center justify-between mt-3 pt-3">
        {studentData ? (
          <div className="flex items-center gap-1">
            <UserAvatar name={studentData.name} avatar={task.user?.avatar} size="xs" />
            <span className="text-caption text-gray-700">{studentData.name}</span>
          </div>
        ) : <span />}
        <div className="flex items-baseline gap-1.5 flex-shrink-0">
          <span className="text-body font-semibold text-gray-900">
            {formatPrice(displayPrice, task.currency)}
          </span>
          {usdEquivalent && (
            <span className="text-caption text-gray-700">≈ {usdEquivalent} USD</span>
          )}
        </div>
      </div>

      {/* Row 6: Last Message (optional) */}
      {showLastMessage && lastMessage && (
        <div className="flex items-center gap-2 mt-3 px-2 py-2 bg-gray-50 rounded-md">
          <MessageCircle className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
          <span className="text-caption text-gray-600 truncate flex-1">
            {lastMessage.fromCurrentUser ? 'Tú: ' : ''}{lastMessage.message.slice(0, 40)}{lastMessage.message.length > 40 ? '...' : ''}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <UnreadBadge count={lastMessage.unreadCount} />
            <span className="text-caption text-gray-700">{formatMessageTime(lastMessage.timestamp)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

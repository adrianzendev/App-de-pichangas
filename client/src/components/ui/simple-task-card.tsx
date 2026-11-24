import { pluralizeEs } from "@/lib/pluralize";
import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Eye, RotateCcw } from "lucide-react";
import { fmtDeadline } from "@/lib/date-format";
import { TaskActionsMenu, type TaskAction } from "@/components/ui/task-actions-menu";
import { TypingCaret } from "@/components/ui/typing-caret";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { UserAvatar } from "@/components/ui/user-avatar";

// "Buscando tutores…": efecto de escritura rapida (letra por letra), pausa corta y vuelve a empezar,
// con cursor parpadeante. No depende de "reducir movimiento" del sistema: revelar texto no desplaza
// nada y el estado de busqueda tiene que notarse siempre.
const SEARCHING_TEXT = "Buscando tutores…";

function AnimatedDots() {
  const typed = useMotionValue(0);
  const visibleText = useTransform(typed, (v) => SEARCHING_TEXT.slice(0, Math.round(v)));

  useEffect(() => {
    const controls = animate(typed, SEARCHING_TEXT.length, {
      duration: 2.2,
      ease: "linear",
      repeat: Infinity,
      repeatDelay: 1,
    });
    return () => controls.stop();
  }, [typed]);

  // El texto completo se reserva invisible (mismo ancho y alto) y el escrito va encima: la fila no cambia de
  // tamano mientras se teclea ni en la pausa en que el texto queda vacio (antes la tarjeta "saltaba").
  return (
    <span className="relative inline-flex items-center text-caption text-gray-700" aria-label="Buscando tutores">
      <span aria-hidden className="invisible">{SEARCHING_TEXT}</span>
      <span aria-hidden className="absolute inset-0 flex items-center whitespace-nowrap">
        <motion.span>{visibleText}</motion.span>
        <motion.span
          className="ml-0.5 inline-flex"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.7, repeat: Infinity }}
        >
          <TypingCaret size="sm" className="bg-gray-700" />
        </motion.span>
      </span>
    </span>
  );
}
import { getTimeRemaining } from "@/utils/task-utils";
import { getEffectiveStatus } from "@/components/ui/status-badge";

interface TaskCandidate {
  id: string;
  tutor: {
    id: number | string;
    name: string;
    avatar?: string | null;
  };
}

interface TaskData {
  id: number | string;
  title: string;
  description?: string;
  subject?: string;
  deadline: Date | string;
  createdAt?: Date | string | null;
  status: string;
  taskNumber?: number | null;
  assignedTutorId?: number | string | null;
  candidates?: TaskCandidate[];
  candidateCount?: number | null;
  budget?: string | null;
  attachments?: string[] | null;
}

interface SimpleTaskCardProps {
  task: TaskData;
  onClick: () => void;
  onRepublish?: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent) => void;
  onView?: (e: React.MouseEvent) => void;
  onCancel?: (e: React.MouseEvent) => void;
  unreadCount?: number;
  /** Pedido abierto en el panel de detalle (escritorio): fondo green-50. */
  selected?: boolean;
  className?: string;
  showPaymentStates?: boolean;
  isTutor?: boolean;
  currentTutorId?: string | number;
}

export function SimpleTaskCard({ 
  task, 
  onClick, 
  onRepublish,
  onEdit,
  onView,
  onCancel,
  unreadCount = 0,
  selected = false,
  className = "",
  showPaymentStates = false,
  isTutor = false,
  currentTutorId
}: SimpleTaskCardProps) {
  const timeRemaining = getTimeRemaining(task.deadline);
  const candidateCount = task.candidateCount ?? task.candidates?.length ?? 0;
  
  // For tutors: determine if task was assigned to another tutor
  const isAssignedToOther = isTutor && task.assignedTutorId && currentTutorId && 
    String(task.assignedTutorId) !== String(currentTutorId);
  const paymentApproved = task.status === 'in_progress' || task.status === 'completed' || task.status === 'in_review';
  
  // Show "Cerrado" only after payment is approved for another tutor
  const effectiveStatus = isAssignedToOther && paymentApproved 
    ? "ADJUDICATED" 
    : getEffectiveStatus(task.status, timeRemaining.isExpired);
  
  // Mismo avatar que el resto de la app (foto o iniciales con color por nombre).
  const renderAvatar = (tutor: { id: number | string; name: string; avatar?: string | null }, size: "2xs" | "xs" | "sm" = "sm") => (
    <UserAvatar name={tutor.name} avatar={tutor.avatar} size={size} />
  );
  
  const renderAssignedTutor = () => {
    if (!task.assignedTutorId || !task.candidates) return null;
    const assignedCandidate = task.candidates.find(c => c.tutor.id === task.assignedTutorId);
    if (!assignedCandidate) return null;
    
    return (
      <div className="flex flex-col gap-1">
        <span className="text-caption text-gray-700">Tutor:</span>
        <div className="flex items-center gap-1">
          {renderAvatar(assignedCandidate.tutor)}
          <span className="text-caption text-gray-700">{assignedCandidate.tutor.name}</span>
        </div>
      </div>
    );
  };
  
  const renderCandidateAvatars = () => {
    if (task.assignedTutorId) return renderAssignedTutor();
    if (!task.candidates || task.candidates.length === 0) {
      if (effectiveStatus === "SELECTION" || task.status === "active") {
        return (
          <AnimatedDots />
        );
      }
      return null;
    }
    
    return (
      <div className="flex flex-col gap-1">
        <span className="text-caption text-gray-700">Candidatos:</span>
        <div className="flex items-center">
          <div className="flex -space-x-1.5">
            {task.candidates.slice(0, 3).map((candidate) => (
              <div key={candidate.id}>
                {renderAvatar(candidate.tutor)}
              </div>
            ))}
          </div>
          {candidateCount > 3 && (
            <span className="text-caption text-gray-700 ml-1">+{candidateCount - 3}</span>
          )}
        </div>
      </div>
    );
  };

  // Pedido vencido o cancelado (solo alumno): punto de estado junto a la fecha, "Republicar" en el menu ⋮, titulo atenuado.
  const canRepublish = !!onRepublish && !isTutor && (effectiveStatus === "CANCELLED" || task.status === "cancelled" || task.status === "expired");
  const isCancelled = effectiveStatus === "CANCELLED" || task.status === "cancelled";

  const candidateAvatars = renderCandidateAvatars();

  const menuActions: TaskAction[] = [];
  if (onView) menuActions.push({ label: "Ver pedido", icon: Eye, testId: `view-task-${task.id}`, onSelect: () => onView({ stopPropagation() {} } as React.MouseEvent) });
  // Republicar vive en el menu ⋮ (accion secundaria): ya no compite con el titulo en la esquina de la tarjeta.
  if (canRepublish) menuActions.push({ label: "Republicar", icon: RotateCcw, testId: `republish-${task.id}`, onSelect: () => onRepublish?.({ stopPropagation() {} } as React.MouseEvent) });

  return (
    <>
    <div
      className={`bg-white ${selected ? "shadow-md" : ""} rounded-lg border border-gray-200 p-bento-pad cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick?.(); } }}
      data-testid={`task-card-${task.id}`}
    >
      {/* Row 1: Title + Status Badge (derecha) */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          className={`text-body font-semibold ${canRepublish ? "text-gray-700" : "text-gray-900"} line-clamp-2 break-anywhere flex-1`}
          data-testid={`task-title-${task.id}`}
        >
          {task.title}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* El estado (status) se sigue guardando y usando en logica/backend; la tarjeta no pinta su badge. */}
          {menuActions.length > 0 && !isTutor && (
            <TaskActionsMenu className="-mr-2.5" triggerTestId={`task-menu-${task.id}`} actions={menuActions} />
          )}
        </div>
      </div>

      {/* Row 2: Time remaining. Solo se pinta con contenido: vacia dejaba un hueco entre titulo y tutor. */}
      {(canRepublish || (effectiveStatus !== "CANCELLED" && !timeRemaining.isExpired)) && (
      <div className="flex min-h-task-meta items-center gap-2 mb-2">
        {canRepublish && (
          // Estado discreto: el color va en el texto (rojo = vencido, gris = cancelado), sin punto ni pastilla.
          <span className={`text-caption ${isCancelled ? "text-gray-700" : "text-error-fg"}`}>
            {isCancelled ? "Cancelado" : fmtDeadline(task.deadline)}
          </span>
        )}
        {!canRepublish && effectiveStatus !== "CANCELLED" && !timeRemaining.isExpired && (
          <span className="text-caption text-gray-700">
            {fmtDeadline(task.deadline)}
          </span>
        )}
      </div>
      )}

      {/* Row 3: Candidates photos + Unread badge. min-h-task-candidates (52px) = alto de la variante mas alta ("Candidatos:" + avatares):
          la fila no cambia de tamano al pasar de "Buscando tutores…" a candidatos (ni cuando no hay nada). */}
      {/* Vencido/cancelado sin candidatos: sin esta fila (antes dejaba un hueco vacio). */}
      {(!canRepublish || candidateAvatars || unreadCount > 0) && (
        <div className="flex min-h-task-candidates items-center justify-between text-body text-gray-700 mt-3">
          {candidateAvatars}
          {unreadCount > 0 && (
            <div className="flex items-center gap-1 self-end">
              <UnreadBadge count={unreadCount} />
              <span className="text-caption text-gray-700">{pluralizeEs(unreadCount, 'mensaje')}</span>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

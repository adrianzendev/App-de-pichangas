import { TaskWithCandidates } from "@shared/schema";
import { 
  BackendHiringStatus, 
  getHiringStateConfig, 
  getEffectiveStatus as getEffectiveStatusFromLib,
  getUnifiedBadge as getUnifiedBadgeFromLib,
  getTimeRemaining as getTimeRemainingFromLib,
  type TimeRemaining,
  type UnifiedBadge
} from "@/lib/hiring-states";

// Re-export tipos para compatibilidad
export type { TimeRemaining, UnifiedBadge };

// Interfaz legacy para compatibilidad
export interface StatusBadge {
  text: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES UNIFICADAS (Redirigen a hiring-states.ts)
// ═══════════════════════════════════════════════════════════════

// Calcula tiempo restante - redirige a hiring-states
export const getTimeRemaining = (deadline: string | Date): TimeRemaining => {
  return getTimeRemainingFromLib(deadline);
};

// Estado efectivo - redirige a hiring-states
export const getEffectiveStatus = (task: TaskWithCandidates): string => {
  const result = getEffectiveStatusFromLib({
    status: task.status,
    deadline: task.deadline,
    assignedTutorId: task.assignedTutorId
  });
  
  // Convertir a formato legacy para compatibilidad
  const backendToLegacy: Record<string, string> = {
    "SELECTION": "active",
    "PAYMENT_REVIEW": "payment_pending",
    "IN_PROGRESS": "in_progress",
    "COMPLETED": "completed",
    "EXPIRED": "expired",
    "CANCELLED": "cancelled",
    "IN_REVISION": "in_review"
  };
  
  return backendToLegacy[result] || task.status;
};

// Badge para tutores (considera si perdió la tarea)
export const getTutorStatusBadge = (task: TaskWithCandidates, currentTutorId: string): StatusBadge => {
  return getUnifiedBadgeFromLib({
    status: task.status,
    deadline: task.deadline,
    assignedTutorId: task.assignedTutorId
  }, currentTutorId);
};

// ═══════════════════════════════════════════════════════════════
// FUNCIONES UTILITARIAS (No relacionadas con estados)
// ═══════════════════════════════════════════════════════════════

// Parsea deadline de manera segura
export function parseDeadline(deadline: unknown): Date {
  if (deadline instanceof Date) return deadline;
  if (typeof deadline === 'string') return new Date(deadline);
  return new Date();
}

// Genera número de tarea legible
export function generateTaskNumber(taskId: string, taskNumber?: number | null): string {
  if (taskNumber) {
    return `#${taskNumber}`;
  }
  const shortId = taskId.slice(-6).toUpperCase();
  return `#${shortId}`;
}

// Obtiene display de materia
export function getSubjectDisplay(task: TaskWithCandidates): string {
  return task.subject || task.service || 'Sin materia';
}

// ═══════════════════════════════════════════════════════════════
// Pedido DISPONIBLE para un tutor (única fuente: lista "Disponibles" y badge de la barra inferior)
// ═══════════════════════════════════════════════════════════════

// El servidor pasa a 'expired' cada 30 min (y solo con usuarios en línea): hasta entonces el pedido
// vencido sigue 'active' en la base, así que el plazo se revisa aquí con la hora actual.
export const isTaskAvailableForTutor = (
  task: { status: string; deadline: string | Date; assignedTutorId?: string | null },
  tutorId: string | undefined,
  now: Date = new Date(),
): boolean => {
  const isOpenStatus = task.status === "active" || task.status === "available";
  const isNotExpired = new Date(task.deadline).getTime() > now.getTime();
  const isAssignedToMe = !!tutorId && task.assignedTutorId === tutorId;
  const paymentConfirmed = ["in_progress", "completed", "in_review"].includes(task.status);
  const anotherConfirmed = paymentConfirmed && !!task.assignedTutorId && !isAssignedToMe;
  return isOpenStatus && isNotExpired && !isAssignedToMe && !anotherConfirmed;
};

// Sistema de Estados de Contratación - MilTareas
// Cheat Sheet: Máquina de Estados (Backend vs Frontend)
// Regla de Oro: La interfaz es minimalista. El usuario solo ve cambios visuales cuando importa.
// Los detalles finos se notifican vía Mensajes de Sistema en el Chat.

// Estados del Backend (ENUM del sistema)
export type BackendHiringStatus = 
  | "SELECTION"       // Fase 1: Negociación - Chat abierto
  | "PAYMENT_REVIEW"  // Fase 1: Pago enviado, validando
  | "TUTOR_SELECTED"  // Fase 1: Tutor elegido, no acepta más postulaciones
  | "ADJUDICATED"     // Fase 1: Adjudicado a otro (perdedores)
  | "IN_PROGRESS"     // Fase 2: Ejecución - Trabajo activo
  | "LATE"            // Fase 2: Trabajo activo pero tarde
  | "EXTRA_REVIEW"    // Fase 2: Validando pago adicional
  | "DELIVERED"       // Fase 2: Archivos entregados
  | "IN_REVISION"     // Fase 2: Solicitud de correcciones
  | "DISPUTE"         // Fase 2: Soporte interviniendo
  | "COMPLETED"       // Fase 3: Cierre - Fondos liberados
  | "TIP_REVIEW"      // Fase 3: Validando propina
  | "CANCELLED"       // Fase 3: Cancelado por usuario
  | "EXPIRED";        // Fase 3: Vencido por tiempo

// Estados visibles en Frontend (6 Badges CSS)
export type FrontendBadgeType = 
  | "DISPONIBLE"    // Badge-Green: SELECTION, PAYMENT_REVIEW
  | "EN_PROGRESO"   // Badge-Blue: IN_PROGRESS, LATE, EXTRA_REVIEW, DELIVERED, IN_REVISION, DISPUTE
  | "FINALIZADO"    // Badge-Gray: COMPLETED, TIP_REVIEW
  | "CERRADO"       // Badge-Gray: ADJUDICATED (perdedores)
  | "CANCELADO"     // Badge-Gray: CANCELLED
  | "VENCIDO";      // Badge-Gray: EXPIRED (tiempo agotado)

// Comportamiento del chat
export type ChatBehavior = 
  | "open"           // Chat abierto normal
  | "open_message"   // Chat abierto + mensaje de sistema
  | "readonly";      // Solo lectura (bloqueado)

// Configuración completa de estado
export interface HiringStateConfig {
  badge: FrontendBadgeType;
  label: string;              // Texto del badge
  chatBehavior: ChatBehavior;
  systemMessage?: string;     // Mensaje de sistema en chat
  banner?: string;            // Banner para estados bloqueados
  phase: 1 | 2 | 3;          // Fase del flujo
}

// Tabla de mapeo definitiva según Cheat Sheet
export const HIRING_STATE_MAP: Record<BackendHiringStatus, HiringStateConfig> = {
  // ═══════════════════════════════════════════════════════════════
  // FASE 1: INICIO (Negociación y Pago)
  // ═══════════════════════════════════════════════════════════════
  SELECTION: {
    badge: "DISPONIBLE",
    label: "Disponible",
    chatBehavior: "open",
    phase: 1
  },
  PAYMENT_REVIEW: {
    badge: "DISPONIBLE",
    label: "Disponible",
    chatBehavior: "open_message",
    systemMessage: "⏳ Validando pago...",
    phase: 1
  },
  TUTOR_SELECTED: {
    badge: "CERRADO",
    label: "Tutor seleccionado",
    chatBehavior: "readonly",
    banner: "El estudiante ya eligió un tutor",
    phase: 1
  },
  ADJUDICATED: {
    badge: "CERRADO",
    label: "Cerrado",
    chatBehavior: "readonly",
    banner: "Ganó otro",
    phase: 1
  },

  // ═══════════════════════════════════════════════════════════════
  // FASE 2: EJECUCIÓN (El "Super Estado" - Siempre AZUL)
  // La tarjeta siempre se ve EN PROGRESO para dar estabilidad
  // Los eventos ocurren dentro del chat
  // ═══════════════════════════════════════════════════════════════
  IN_PROGRESS: {
    badge: "EN_PROGRESO",
    label: "En progreso",
    chatBehavior: "open_message",
    systemMessage: "Pago aprobado. A trabajar.",
    phase: 2
  },
  LATE: {
    badge: "EN_PROGRESO",
    label: "En progreso",
    chatBehavior: "open",
    // Sin mensaje automático, se deduce por el contador en cero
    phase: 2
  },
  EXTRA_REVIEW: {
    badge: "EN_PROGRESO",
    label: "En progreso",
    chatBehavior: "open_message",
    systemMessage: "Validando pago adicional...",
    phase: 2
  },
  DELIVERED: {
    badge: "EN_PROGRESO",
    label: "En progreso",
    chatBehavior: "open_message",
    systemMessage: "Archivos entregados.",
    phase: 2
  },
  IN_REVISION: {
    badge: "EN_PROGRESO",
    label: "En progreso",
    chatBehavior: "open_message",
    systemMessage: "Solicitud de correcciones.",
    phase: 2
  },
  DISPUTE: {
    badge: "EN_PROGRESO",
    label: "En progreso",
    chatBehavior: "readonly",
    banner: "Soporte interviniendo",
    phase: 2
  },

  // ═══════════════════════════════════════════════════════════════
  // FASE 3: CIERRE Y CANCELACIÓN
  // ═══════════════════════════════════════════════════════════════
  COMPLETED: {
    badge: "FINALIZADO",
    label: "Finalizado",
    chatBehavior: "open_message",
    systemMessage: "Fondos liberados.",
    phase: 3
  },
  TIP_REVIEW: {
    badge: "FINALIZADO",
    label: "Finalizado",
    chatBehavior: "open_message",
    systemMessage: "⏳ Validando propina...",
    phase: 3
  },
  CANCELLED: {
    badge: "CANCELADO",
    label: "Cancelado",
    chatBehavior: "readonly",
    banner: "Pedido cancelado",
    phase: 3
  },
  EXPIRED: {
    badge: "VENCIDO",
    label: "Vencida",
    chatBehavior: "readonly",
    banner: "Tiempo agotado",
    phase: 3
  }
};

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE BADGES (5 tipos según Cheat Sheet)
// ═══════════════════════════════════════════════════════════════
export const BADGE_STYLES: Record<FrontendBadgeType, {
  bg: string;
  text: string;
  border: string;
  icon?: string;
}> = {
  DISPONIBLE: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-field",
    icon: ""
  },
  EN_PROGRESO: {
    bg: "bg-gray-100",
    text: "text-success-fg",
    border: "border-success",
    icon: ""
  },
  FINALIZADO: {
    bg: "bg-gray-100",
    text: "text-success-fg",
    border: "border-success",
    icon: ""
  },
  CERRADO: {
    bg: "bg-gray-100",
    text: "text-gray-500",
    border: "border-gray-200",
    icon: ""
  },
  CANCELADO: {
    bg: "bg-gray-100",
    text: "text-gray-500",
    border: "border-gray-200",
    icon: ""
  },
  VENCIDO: {
    bg: "bg-gray-100",
    text: "text-gray-500",
    border: "border-gray-200",
    icon: ""
  }
};

// ═══════════════════════════════════════════════════════════════
// FUNCIONES HELPER
// ═══════════════════════════════════════════════════════════════

// Mapeo de estados legacy → nuevos estados
export function mapLegacyToBackend(legacyStatus: string): BackendHiringStatus {
  const legacyMap: Record<string, BackendHiringStatus> = {
    "active": "SELECTION",
    "available": "SELECTION",
    "payment_pending": "PAYMENT_REVIEW",
    "payment_rejected": "SELECTION",
    "in_progress": "IN_PROGRESS",
    "in_review": "IN_REVISION",
    "completed": "COMPLETED",
    "cancelled": "CANCELLED",
    "expired": "EXPIRED",
    "pagado": "IN_PROGRESS"
  };
  
  // Si ya es un estado nuevo, retornarlo
  if (Object.keys(HIRING_STATE_MAP).includes(legacyStatus)) {
    return legacyStatus as BackendHiringStatus;
  }
  
  return legacyMap[legacyStatus] || "SELECTION";
}

// Obtener config de estado
export function getHiringStateConfig(backendStatus: BackendHiringStatus): HiringStateConfig {
  return HIRING_STATE_MAP[backendStatus] || HIRING_STATE_MAP.SELECTION;
}

// Obtener estilos del badge
export function getBadgeStyles(badge: FrontendBadgeType) {
  return BADGE_STYLES[badge];
}

// Obtener config desde status legacy
export function getHiringStateFromLegacy(legacyStatus: string): HiringStateConfig {
  const backendStatus = mapLegacyToBackend(legacyStatus);
  return getHiringStateConfig(backendStatus);
}

// Verificar si el chat está bloqueado
export function isChatReadonly(backendStatus: BackendHiringStatus): boolean {
  const config = getHiringStateConfig(backendStatus);
  return config.chatBehavior === "readonly";
}

// Obtener mensaje de sistema si existe
export function getSystemMessage(backendStatus: BackendHiringStatus): string | undefined {
  const config = getHiringStateConfig(backendStatus);
  return config.systemMessage;
}

// Obtener banner si existe
export function getBanner(backendStatus: BackendHiringStatus): string | undefined {
  const config = getHiringStateConfig(backendStatus);
  return config.banner;
}

// ═══════════════════════════════════════════════════════════════
// FUNCIONES UNIFICADAS (Única fuente de verdad)
// ═══════════════════════════════════════════════════════════════

export interface TaskStatusInfo {
  status: string;
  deadline: string | Date;
  assignedTutorId?: string | null;
}

// Calcula el estado efectivo considerando expiración
export function getEffectiveStatus(task: TaskStatusInfo): BackendHiringStatus {
  const deadline = new Date(task.deadline);
  const now = new Date();
  const isExpired = deadline < now;
  
  // Estados que pueden expirar
  const expirableStatuses = ["active", "available", "payment_pending", "payment_rejected", "SELECTION", "PAYMENT_REVIEW"];
  
  if (isExpired && expirableStatuses.includes(task.status)) {
    return "EXPIRED";
  }
  
  return mapLegacyToBackend(task.status);
}

// Genera badge unificado para cualquier vista
export interface UnifiedBadge {
  text: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export function getUnifiedBadge(task: TaskStatusInfo, viewerTutorId?: string): UnifiedBadge {
  const effectiveStatus = getEffectiveStatus(task);
  
  // Si el visor es tutor y la tarea está asignada a OTRO tutor (después de pago aprobado)
  if (viewerTutorId && task.assignedTutorId && task.assignedTutorId !== viewerTutorId) {
    const assignedStatuses: BackendHiringStatus[] = ["IN_PROGRESS", "COMPLETED", "DELIVERED", "IN_REVISION", "DISPUTE"];
    if (assignedStatuses.includes(effectiveStatus)) {
      return {
        text: "Cerrado",
        textColor: "text-gray-500",
        bgColor: "bg-gray-100",
        borderColor: "border-gray-200"
      };
    }
  }
  
  const config = getHiringStateConfig(effectiveStatus);
  const styles = getBadgeStyles(config.badge);
  
  return {
    text: config.label,
    textColor: styles.text,
    bgColor: styles.bg,
    borderColor: styles.border
  };
}

// Verifica si el tiempo expiró
export function isTaskExpired(deadline: string | Date): boolean {
  return new Date(deadline) < new Date();
}

// Calcula tiempo restante
export interface TimeRemaining {
  text: string;
  isExpired: boolean;
  expired: boolean; // Alias para compatibilidad
  days: number;
  hours: number;
  minutes: number;
}

export function getTimeRemaining(deadline: string | Date): TimeRemaining {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 60000) {
    return { text: "", isExpired: true, expired: true, days: 0, hours: 0, minutes: 0 };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  let text: string;
  if (days > 0) {
    text = `Quedan ${days}d ${hours}h`;
  } else {
    text = `Quedan ${hours}h ${minutes}min`;
  }
  
  return { text, isExpired: false, expired: false, days, hours, minutes };
}

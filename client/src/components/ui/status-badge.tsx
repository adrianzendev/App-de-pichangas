import { Badge } from "@/components/ui/badge";
import {
  BackendHiringStatus,
  FrontendBadgeType,
  getHiringStateConfig,
  mapLegacyToBackend,
  getBadgeStyles,
} from "@/lib/hiring-states";

// Función de compatibilidad con firma antigua (status: string, isExpired: boolean)
export function getEffectiveStatus(status: string, isExpired: boolean = false): BackendHiringStatus {
  // Si está expirado, devolver EXPIRED
  if (isExpired) {
    const expirableStatuses = ["active", "available", "payment_pending", "payment_rejected", "SELECTION", "PAYMENT_REVIEW"];
    if (expirableStatuses.includes(status)) {
      return "EXPIRED";
    }
  }

  return mapLegacyToBackend(status);
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const backendStatus = mapLegacyToBackend(status);
  const config = getHiringStateConfig(backendStatus);
  const styles = getBadgeStyles(config.badge);

  return (
    <Badge variant="outline" className={`${styles.border} ${styles.text} ${className}`}>
      {config.label}
    </Badge>
  );
}

// Export tipos para uso externo
export type { BackendHiringStatus, FrontendBadgeType };

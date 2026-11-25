import { Badge } from "@/components/ui/badge";

// Etiqueta de estado de pedidos, pagos, tutores y alertas del panel admin.
export function AdminStatusBadge({ status, testId, account }: { status: string; testId?: string; account?: boolean }) {
  const TONE = {
    neutral: "border-field text-gray-700",
    success: "border-primary-600 text-success-fg",
    warning: "border-warning text-warning-fg",
    error:   "border-error text-error-fg",
    info:    "border-info text-info-fg",
  };
  // Tono por estado: espera = warning, en curso = info, ok = success, rechazo = error, cierre sin exito = neutral.
  const styles: Record<string, string> = {
    pending:          TONE.warning,
    approved:         TONE.success,
    rejected:         TONE.error,
    active:           TONE.success,
    paused:           TONE.neutral,
    suspended:        TONE.error,
    in_progress:      TONE.info,
    in_review:        TONE.warning,
    completed:        TONE.success,
    cancelled:        TONE.neutral,
    expired:          TONE.neutral,
    payment_pending:  TONE.warning,
    payment_rejected: TONE.error,
    reviewed:         TONE.success,
    dismissed:        TONE.neutral,
  };

  const labels: Record<string, string> = {
    pending:          "Pendiente",
    approved:         "Aprobado",
    rejected:         "Rechazado",
    active:           "Disponible",
    paused:           "Pausado",
    suspended:        "Suspendido",
    in_progress:      "En progreso",
    in_review:        "En revisión",
    completed:        "Completado",
    cancelled:        "Cancelado",
    expired:          "Expirado",
    payment_pending:  "Pago en revisión",
    payment_rejected: "Pago rechazado",
    reviewed:         "Revisada",
    dismissed:        "Descartada",
  };

  const accountLabels: Record<string, string> = { active: "Activo", paused: "Inactivo" };

  return (
    <Badge variant="outline" data-testid={testId} className={styles[status] || TONE.neutral}>
      {(account && accountLabels[status]) || labels[status] || status}
    </Badge>
  );
}

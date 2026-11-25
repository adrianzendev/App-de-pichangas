import { useState } from "react";
import { AlertTriangle, Ban, Check, EyeOff, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { fmtDate, fmtTime12, LIMA_TZ } from "@/lib/date-format";
import { pluralizeEs } from "@/lib/pluralize";
import type { AdminAlert } from "@shared/schema";
import type { AlertSeverity } from "@shared/alert-severity";

/** Alerta + datos del JOIN de /api/admin-alerts (mensaje, remitente, pedido, moderacion, reincidencia). */
export type EnrichedAlert = AdminAlert & {
  chatMessage?: string | null;
  senderName?: string | null;
  senderRole?: "Alumno" | "Tutor" | null;
  taskTitle?: string | null;
  messageId?: string | null;
  /** Guardada al crear la alerta (o deducida en el servidor en alertas antiguas). */
  severity?: AlertSeverity;
  /** Quien envio el mensaje reportado: a quien se advierte o suspende. */
  offenderId?: string;
  /** 'masked' (censurado al enviar), 'hidden' (oculto por el admin) o null. */
  moderationStatus?: string | null;
  /** Texto original antes de censurar u ocultar (solo admin). */
  originalMessage?: string | null;
  /** Alertas de contacto anteriores (no descartadas) del mismo usuario. */
  priorAlerts?: number;
  actionTaken?: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  message_hidden: "Mensaje ocultado",
  warned: "Usuario advertido",
  suspended: "Cuenta suspendida",
};

const fmtAlertDate = (d: Date | string | null) => (d ? `${fmtDate(d, LIMA_TZ)} ${fmtTime12(d, LIMA_TZ)}` : "-");

interface AlertCardProps {
  alert: EnrichedAlert;
  disabled: boolean;
  onReview: (id: string) => void;
  onDismiss: (id: string) => void;
  /** Acciones de moderacion rapida (solo alertas con mensaje de chat). */
  onHideMessage?: (alert: EnrichedAlert) => void;
  onWarn?: (alert: EnrichedAlert) => void;
  onSuspend?: (alert: EnrichedAlert) => void;
}

// En movil las acciones van debajo del contenido; desde `sm` quedan a la derecha.
export function AlertCard({ alert, disabled, onReview, onDismiss, onHideMessage, onWarn, onSuspend }: AlertCardProps) {
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const high = alert.severity === "high";
  const prior = alert.priorAlerts ?? 0;
  const canModerate = alert.status === "pending" && !!alert.messageId && !!alert.offenderId;
  return (
    <div className="bg-white rounded-lg border border-field p-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3" data-testid={`card-alert-${alert.id}`}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`size-icon-box rounded-md flex items-center justify-center flex-shrink-0 ${high ? "bg-error-bg" : "bg-gray-100"}`}>
          <AlertTriangle className={`size-icon-lg ${high ? "text-error-fg" : "text-gray-700"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={high ? "border-error text-error-fg" : undefined}>
              {high ? "Alta" : "Media"}
            </Badge>
            {alert.senderRole && (
              <Badge variant="outline" className={alert.senderRole === "Tutor" ? "border-primary-600 text-primary-700" : undefined}>
                {alert.senderRole}
              </Badge>
            )}
            {!alert.messageId && <Badge variant="outline">Descripción del pedido</Badge>}
            {alert.moderationStatus === "masked" && <Badge variant="info">Auto-censurado</Badge>}
            {alert.moderationStatus === "hidden" && <Badge variant="neutral">Mensaje oculto</Badge>}
            {prior > 0 && (
              <Badge variant="outline" className={prior >= 2 ? "border-error text-error-fg" : undefined} data-testid={`badge-prior-${alert.id}`}>
                {prior} {pluralizeEs(prior, "alerta")} {prior === 1 ? "previa" : "previas"}
              </Badge>
            )}
            <AdminStatusBadge status={alert.status} testId={`status-alert-${alert.id}`} />
          </div>
          {(alert.senderName || alert.taskTitle) && (
            <p className="text-caption text-gray-700 mt-1 line-clamp-2" title={alert.taskTitle ?? undefined}>
              {alert.senderName && <span className="font-medium text-gray-900">{alert.senderName}</span>}
              {alert.taskTitle && <span> · Pedido: <span className="italic">{alert.taskTitle}</span></span>}
            </p>
          )}
          {alert.originalMessage && (
            <div className="mt-2">
              <p className="text-caption text-gray-700">Original (solo admin)</p>
              <p className="text-body text-gray-900 bg-gray-50 rounded-md px-3 py-2 break-words" data-testid={`text-original-${alert.id}`}>"{alert.originalMessage}"</p>
            </div>
          )}
          {alert.chatMessage && (
            <div className="mt-2">
              {alert.originalMessage && <p className="text-caption text-gray-700">Lo que ve el destinatario</p>}
              <p className="text-body text-gray-900 bg-gray-50 rounded-md px-3 py-2 break-words">"{alert.chatMessage}"</p>
            </div>
          )}
          {!alert.messageId && alert.taskTitle && (
            <p className="text-body text-gray-700 mt-2 bg-gray-50 rounded-md px-3 py-2 break-words italic">
              Detectado en la descripción del pedido
            </p>
          )}
          <p className="text-caption text-gray-700 mt-2">
            Detectado: <span className="text-gray-900">{alert.detectedContent}</span>
          </p>
          <p className="text-caption text-gray-700 mt-1">
            {fmtAlertDate(alert.createdAt)}
            {alert.actionTaken && <span className="text-gray-900"> · {ACTION_LABELS[alert.actionTaken] ?? alert.actionTaken}</span>}
          </p>
        </div>
      </div>
      {alert.status === "pending" && (
        <div className="flex flex-wrap gap-2 sm:flex-col sm:flex-nowrap sm:flex-shrink-0">
          {canModerate && onHideMessage && (
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={disabled || alert.moderationStatus === "hidden"} onClick={() => onHideMessage(alert)} data-testid={`button-hide-${alert.id}`}>
              <EyeOff className="size-icon-md" /> Ocultar mensaje
            </Button>
          )}
          {canModerate && onWarn && (
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={disabled} onClick={() => onWarn(alert)} data-testid={`button-warn-${alert.id}`}>
              <TriangleAlert className="size-icon-md" /> Advertir
            </Button>
          )}
          {canModerate && onSuspend && (
            <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" disabled={disabled} onClick={() => setConfirmSuspend(true)} data-testid={`button-suspend-${alert.id}`}>
              <Ban className="size-icon-md" /> Suspender cuenta
            </Button>
          )}
          <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" disabled={disabled} onClick={() => onReview(alert.id)}>
            <Check className="size-icon-md" /> Revisar
          </Button>
          <Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={disabled} onClick={() => onDismiss(alert.id)}>
            <X className="size-icon-md" /> Descartar
          </Button>
        </div>
      )}
      {onSuspend && (
        <AlertDialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Suspender la cuenta de {alert.senderName ?? "este usuario"}?</AlertDialogTitle>
              <AlertDialogDescription>
                {prior > 0
                  ? `Tiene ${prior} ${pluralizeEs(prior, "alerta")} de contacto previas. `
                  : ""}
                No podrá iniciar sesión ni enviar mensajes hasta que la reactives desde Usuarios.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onSuspend(alert)} data-testid={`button-confirm-suspend-${alert.id}`}>
                <ShieldAlert className="size-icon-md" /> Suspender
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// Alertas que no son de contacto privado (tab "Generales"): solo lectura.
export function GeneralAlertCard({ alert }: { alert: EnrichedAlert }) {
  return (
    <div className="bg-white rounded-lg border border-field p-6 flex items-start gap-3" data-testid={`card-alert-${alert.id}`}>
      <div className="size-icon-box rounded-md flex items-center justify-center flex-shrink-0 bg-gray-100">
        <AlertTriangle className="size-icon-lg text-gray-700" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-body font-medium text-gray-900 capitalize" data-testid={`text-alert-type-${alert.id}`}>
          {alert.type.replace(/_/g, " ")}
        </h4>
        <p className="text-body text-gray-700 mt-1 line-clamp-2">{alert.detectedContent}</p>
        <p className="text-caption text-gray-700 mt-1">{fmtAlertDate(alert.createdAt)}</p>
      </div>
      <AdminStatusBadge status={alert.status} testId={`status-alert-${alert.id}`} />
    </div>
  );
}

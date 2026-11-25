import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TaskNumber } from "@/components/ui/task-number";
import { EnhancedFileDisplay } from "@/components/ui/enhanced-file-display";
import { OutlinedField } from "@/components/ui/outlined-field";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import { calcUsdEquivalent } from "@/lib/currency-utils";
import { formatDateForUser, formatTimeForUser, formatPrice } from "@/lib/timezone-utils";
import type { Task, TaskWithCandidates } from "@shared/schema";

// Algunas pantallas (chat-fullscreen.tsx) resuelven el pedido via
// GET /api/tasks/:id, que no hace join con candidates (solo trae el
// contador denormalizado candidateCount) — a diferencia de las listas que
// si traen TaskWithCandidates completo. Se acepta cualquiera de los dos.
export type QuickViewTask = Task & {
  candidates?: TaskWithCandidates["candidates"];
  candidateCount?: number | null;
};

interface TaskQuickViewDialogProps {
  task: QuickViewTask | null;
  onClose: () => void;
  currentUserCountry?: string | null;
  // El equivalente en USD del presupuesto es informacion interna (cuanto le
  // llega al tutor / referencia para admin) — el alumno nunca debe verla.
  showUsdEquivalent?: boolean;
  // Solo admin ve Servicio, Asignatura y Entregado.
  showAdminFields?: boolean;
  // Estudiante/Tutor: boton de footer, ej. "Ver candidatos". Ausente cuando
  // no se pasa (Admin, o chat-fullscreen.tsx que ya esta dentro del chat).
  footerLabel?: string;
  onGoToTask?: (task: QuickViewTask) => void;
  // Footer propio (ej. Tutores: "Aplicar" / "Ir al chat" segun estado).
  // Reemplaza al boton de footerLabel/onGoToTask.
  footer?: ReactNode;
  // Tutores: tarjeta "Publicado por" (avatar + nombre + presencia).
  publisher?: ReactNode;
  // Admin: modo edicion. Si devuelve contenido, reemplaza el bloque Titulo/Descripcion/
  // Comentario (que en lectura es siempre el mismo para todos los roles).
  renderEditContent?: (task: QuickViewTask) => ReactNode;
  // Admin: alerta de telefono detectado / historial de auditoria. Slots
  // genericos para no acoplar este componente a esas features admin-only.
  beforeContent?: ReactNode;
  afterContent?: ReactNode;
}

// Los datos van en OutlinedField: etiqueta sobre el borde, igual que Detalle de Pago.
const VALUE = "text-body text-gray-900 [overflow-wrap:anywhere]";


// Vista rapida "Detalle del pedido" — unica implementacion para todas las
// pantallas (Admin, feed Inicio, Pedidos, Tutores, /chat-fullscreen).
export function TaskQuickViewDialog({
  task,
  onClose,
  currentUserCountry,
  showUsdEquivalent = false,
  showAdminFields = false,
  footerLabel = "Ver candidatos",
  onGoToTask,
  footer,
  publisher,
  renderEditContent,
  beforeContent,
  afterContent,
}: TaskQuickViewDialogProps) {
  const { data: exchangeRates } = useExchangeRates();
  const country = currentUserCountry || "PE";
  // Misma fecha + hora en todos los campos de fecha del modal.
  const dateTime = (d: Date | string) => `${formatDateForUser(d, country)} · ${formatTimeForUser(d, country)}`;

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose className="rounded-lg max-h-sheet overflow-y-auto overflow-x-hidden p-0 grid-cols-fit">
        {task && (
          <>
            <DialogHeader className="sticky top-0 bg-white shadow-sm px-6 py-4 z-sticky">
              <DialogTitle className="text-heading font-bold text-gray-900">Detalle del pedido</DialogTitle>
              {/* El X por defecto es absolute dentro del contenido con scroll y se va al desplazar: aqui queda fijo en el header sticky. */}
              <DialogClose className="absolute right-4 top-1/2 -translate-y-1/2 size-touch flex items-center justify-center rounded-full text-gray-700 cursor-pointer transition-colors hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-icon-lg" />
                <span className="sr-only">Cerrar</span>
              </DialogClose>
            </DialogHeader>

            <div className="p-6 space-y-6 min-w-0">
              {beforeContent}

              {renderEditContent?.(task) ?? (
                <>
                  <OutlinedField label="Descripción">
                    <p className={`${VALUE} whitespace-pre-wrap`}>{task.description || "-"}</p>
                  </OutlinedField>
                  {task.comment && (
                    <OutlinedField label="Comentario">
                      <p className={`${VALUE} whitespace-pre-wrap`}>{task.comment}</p>
                    </OutlinedField>
                  )}
                </>
              )}

              {task.attachments && task.attachments.length > 0 && (
                <OutlinedField label="Archivos adjuntos">
                  <EnhancedFileDisplay files={task.attachments} names={task.attachmentNames ?? undefined} sizes={task.attachmentSizes ?? undefined} showTitle={false} flat />
                </OutlinedField>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                <OutlinedField label="Presupuesto">
                  <p className="text-body text-gray-900">
                    {formatPrice(task.budget, task.currency)}
                    {showUsdEquivalent && (() => {
                      const usd = calcUsdEquivalent(task.budget, task.currency, exchangeRates?.rates);
                      return usd ? <span className="text-caption text-gray-700 font-normal"> &asymp; {usd} USD</span> : null;
                    })()}
                  </p>
                </OutlinedField>
                <OutlinedField label="Fecha límite">
                  <p className={VALUE}>{dateTime(task.deadline)}</p>
                </OutlinedField>
                <OutlinedField label="Estado">
                  <div><StatusBadge status={task.status} /></div>
                </OutlinedField>
                {showAdminFields && (
                  <OutlinedField label="Servicio">
                    <p className={VALUE}>{task.service || "-"}</p>
                  </OutlinedField>
                )}
                {showAdminFields && (
                  <OutlinedField label="Asignatura">
                    <p className={VALUE}>{task.studyArea || task.subject || "-"}</p>
                  </OutlinedField>
                )}
                <OutlinedField label="Nº de pedido">
                  <TaskNumber taskId={task.id} taskNumber={task.taskNumber} className="text-body text-gray-900" />
                </OutlinedField>
                <OutlinedField label="Nº de candidatos">
                  <p className="text-body text-gray-900">
                    {task.candidates?.length ?? task.candidateCount ?? 0}
                  </p>
                </OutlinedField>
                <OutlinedField label="Fecha de publicación">
                  <p className={VALUE}>{task.createdAt ? dateTime(task.createdAt) : "-"}</p>
                </OutlinedField>
                {showAdminFields && (
                  <OutlinedField label="Entregado">
                    <p className={VALUE}>{task.deliveredAt ? dateTime(task.deliveredAt) : "-"}</p>
                  </OutlinedField>
                )}
                {publisher && (
                  <OutlinedField label="Publicado por" className="col-span-2">
                    {publisher}
                  </OutlinedField>
                )}
              </div>

              {afterContent}
            </div>

            {(footer || onGoToTask) && (
              <div className="sticky bottom-0 bg-white shadow-md p-6">
                {footer ?? (
                  <Button onClick={() => onGoToTask!(task)} className="w-full">
                    {footerLabel}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

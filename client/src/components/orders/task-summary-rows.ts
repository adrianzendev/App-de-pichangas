import { pluralizeEs } from "@/lib/pluralize";
import { formatDateTimeForUser, formatPrice } from "@/lib/timezone-utils";
import { formatFileSize } from "@/lib/file-url-utils";
import { getHiringStateConfig } from "@/lib/hiring-states";
import { getEffectiveStatus } from "@/components/ui/status-badge";
import type { SummaryRow } from "@/components/ui/order-summary";
import type { TaskWithCandidates } from "@shared/schema";

// Mismos campos que "Detalle del pedido" (task-quick-view-dialog.tsx). Titulo, Archivos, Entrega, Presupuesto y Notas
// son las filas del resumen de /publish (Notas = "Notas adicionales" = `comment`, no la descripcion); las filas
// extra solo salen si tienen dato (no "Pendiente").
export function taskSummaryRows(task: TaskWithCandidates, country?: string | null): SummaryRow[] {
  const files = task.attachments?.length ?? 0;
  const names = task.attachmentNames ?? [];
  const sizes = task.attachmentSizes ?? [];
  const fileList = (task.attachments ?? [])
    .map((_, i) => [names[i] || `Archivo ${i + 1}`, sizes[i] ? formatFileSize(sizes[i]) : ""].filter(Boolean).join(" · "))
    .join("\n");
  const candidates = task.candidates?.length ?? task.candidateCount ?? 0;
  const dateTime = (d: Date | string | null | undefined) => (d ? formatDateTimeForUser(d, country || "PE") : "");
  const status = getHiringStateConfig(getEffectiveStatus(task.status, new Date(task.deadline) < new Date())).label;
  const extra: SummaryRow[] = [
    { label: "Estado", value: status },
    { label: "Nº de pedido", value: task.taskNumber ? `Nº ${task.taskNumber}` : "" },
    { label: "Nº de candidatos", value: String(candidates) },
    { label: "Fecha de publicación", value: dateTime(task.createdAt) },
  ].filter((r) => r.value);
  return [
    { label: "Título", value: task.title },
    { label: "Descripción", value: task.description },
    { label: "Archivos", value: fileList || (files > 0 ? `${files} ${pluralizeEs(files, "archivo")}` : "") },
    { label: "Fecha límite", value: dateTime(task.deadline) },
    { label: "Presupuesto", value: formatPrice(task.budget, task.currency) },
    ...extra,
    { label: "Notas", value: task.comment ?? "" },
  ];
}

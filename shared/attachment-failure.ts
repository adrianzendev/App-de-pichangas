import { z } from "zod";

// Fallos de adjuntos que ocurren en el telefono/navegador y nunca llegan al servidor como subida.
// El cliente los reporta a POST /api/client-errors/attachment y quedan en el panel Errores como Advertencia.
// Caso real (2026-11-08): un .docx de 17 KB que la tutora no pudo enviar no dejo ningun rastro en el servidor.

export const ATTACHMENT_FAILURE_REASONS = ["read-failed", "permission-denied", "send-failed"] as const;
export type AttachmentFailureReason = (typeof ATTACHMENT_FAILURE_REASONS)[number];

export const ATTACHMENT_FAILURE_LABEL: Record<AttachmentFailureReason, string> = {
  "read-failed": "el teléfono entregó el archivo vacío o ilegible (suele pasar con archivos de Drive/OneDrive sin descargar)",
  "permission-denied": "sin permiso para acceder a los archivos",
  "send-failed": "falló el envío",
};

export const attachmentFailureSchema = z.object({
  reason: z.enum(ATTACHMENT_FAILURE_REASONS),
  /** Origen del selector: camara, galeria o archivos. */
  source: z.enum(["camera", "gallery", "files"]).optional(),
  /** Pantalla donde ocurrio (pathname, sin query). */
  screen: z.string().max(200).optional(),
  files: z
    .array(z.object({ name: z.string().max(255), size: z.number().int().min(0), type: z.string().max(120) }))
    .max(10)
    .default([]),
  /** Detalle tecnico (p. ej. el mensaje de error del envio). */
  detail: z.string().max(500).optional(),
});
export type AttachmentFailureReport = z.infer<typeof attachmentFailureSchema>;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Texto que se guarda en error_logs.message, en espanol y legible para el administrador. */
export function attachmentFailureMessage(report: AttachmentFailureReport): string {
  const files = report.files.length
    ? report.files.map((f) => `"${f.name}" (${formatBytes(f.size)}${f.type ? `, ${f.type}` : ""})`).join(", ")
    : "archivo sin datos";
  const detail = report.detail ? ` · ${report.detail}` : "";
  return `Adjunto no enviado: ${files} — ${ATTACHMENT_FAILURE_LABEL[report.reason]}${detail}`;
}

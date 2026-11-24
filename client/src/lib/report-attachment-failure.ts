import type { AttachmentFailureReason } from "@shared/attachment-failure";
import type { PickSource } from "@/lib/file-picker";

/**
 * Avisa al panel admin > Errores (como Advertencia) que un adjunto fallo en el telefono/navegador.
 * Se dispara y se olvida: nunca lanza ni bloquea la UI. Ver `shared/attachment-failure.ts`.
 */
export function reportAttachmentFailure(input: {
  reason: AttachmentFailureReason;
  files?: ReadonlyArray<Pick<File, "name" | "size" | "type">>;
  source?: PickSource;
  detail?: string;
}): void {
  try {
    const body = JSON.stringify({
      reason: input.reason,
      source: input.source,
      screen: window.location.pathname.slice(0, 200),
      files: (input.files ?? []).slice(0, 10).map((f) => ({ name: f.name.slice(0, 255), size: f.size, type: (f.type || "").slice(0, 120) })),
      detail: input.detail?.slice(0, 500),
    });
    void fetch("/api/client-errors/attachment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reportar un fallo nunca puede romper la pantalla.
  }
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Chip } from "@/components/ui/chip";
import { FormDialog } from "@/components/ui/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { REPORT_REASONS } from "@shared/schema";

const REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  spam: "Spam o publicidad",
  harassment: "Acoso o insultos",
  inappropriate: "Contenido inapropiado",
  fraud: "Fraude o estafa",
  other: "Otro motivo",
};

interface UseChatSafetyOptions {
  /** Id real de la otra persona (no el alias que ve el tutor). */
  otherUserId: string;
  /** Nombre a mostrar en los dialogos. */
  otherUserName: string;
  taskId?: string;
}

/**
 * Reportar y bloquear a la otra persona del chat (requisito de App Store / Google Play para contenido de usuarios).
 * Devuelve el estado del bloqueo, las acciones para el menu del chat y los dialogos ya montados en `dialogs`.
 */
export function useChatSafety({ otherUserId, otherUserName, taskId }: UseChatSafetyOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number] | null>(null);
  const [details, setDetails] = useState("");

  const { data: blocked } = useQuery<{ userId: string }[]>({ queryKey: ["/api/user/blocks"] });
  const isBlocked = !!blocked?.some((b) => b.userId === otherUserId);

  const closeReport = () => {
    setReportOpen(false);
    setReason(null);
    setDetails("");
  };

  const reportMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/user/reports", { reportedUserId: otherUserId, reason, details: details || undefined, taskId }),
    onSuccess: () => {
      closeReport();
      toast({ title: "Reporte enviado", description: "Nuestro equipo lo revisará. Gracias por avisar." });
    },
    onError: () => toast({ title: "No se pudo enviar el reporte", description: "Inténtalo de nuevo en unos minutos.", variant: "destructive" }),
  });

  const blockMutation = useMutation({
    mutationFn: () => apiRequest(isBlocked ? "DELETE" : "POST", `/api/user/blocks/${otherUserId}`),
    onSuccess: () => {
      setBlockOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["/api/user/blocks"] });
      toast({
        title: isBlocked ? "Usuario desbloqueado" : "Usuario bloqueado",
        description: isBlocked ? "Ya pueden volver a escribirse." : "Ninguno de los dos podrá enviar mensajes al otro.",
      });
    },
    onError: () => toast({ title: "No se pudo completar la acción", description: "Inténtalo de nuevo.", variant: "destructive" }),
  });

  const dialogs = (
    <>
      <FormDialog
        open={reportOpen}
        onOpenChange={(open) => (open ? setReportOpen(true) : closeReport())}
        title={`Reportar a ${otherUserName}`}
        testId="dialog-report-user"
        onCancel={closeReport}
        onSubmit={() => reportMutation.mutate()}
        submitLabel={reportMutation.isPending ? "Enviando…" : "Enviar reporte"}
        submitDisabled={!reason || reportMutation.isPending}
        submitTestId="button-submit-report"
      >
        <div className="space-y-3">
          <p className="text-body text-gray-700">¿Qué ocurrió? El reporte llega a nuestro equipo de revisión.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Motivo del reporte">
            {REPORT_REASONS.map((value) => (
              <Chip key={value} active={reason === value} onClick={() => setReason(value)} data-testid={`report-reason-${value}`}>
                {REASON_LABELS[value]}
              </Chip>
            ))}
          </div>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            placeholder="Detalles (opcional)"
            aria-label="Detalles del reporte"
            data-testid="input-report-details"
          />
        </div>
      </FormDialog>

      <FormDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={isBlocked ? `Desbloquear a ${otherUserName}` : `Bloquear a ${otherUserName}`}
        testId="dialog-block-user"
        onCancel={() => setBlockOpen(false)}
        onSubmit={() => blockMutation.mutate()}
        submitLabel={isBlocked ? "Desbloquear" : "Bloquear"}
        submitVariant={isBlocked ? "default" : "destructive"}
        submitDisabled={blockMutation.isPending}
        submitTestId="button-confirm-block"
      >
        <p className="text-body text-gray-700">
          {isBlocked
            ? "Podrán volver a enviarse mensajes."
            : "Ninguno de los dos podrá enviar mensajes al otro hasta que lo desbloquees. Tus pedidos y pagos no cambian."}
        </p>
      </FormDialog>
    </>
  );

  return { isBlocked, openReport: () => setReportOpen(true), openBlock: () => setBlockOpen(true), dialogs };
}

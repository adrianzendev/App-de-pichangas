import { useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// Aviso unico del panel admin cuando alguna consulta fallo: las tablas quedan en "sin datos" y sin esto parecerian vacias.
export function QueryErrorBanner() {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();
  const failed = useSyncExternalStore(
    (notify) => cache.subscribe(notify),
    () => cache.findAll({ predicate: (q) => q.state.status === "error" }).length,
  );
  if (!failed) return null;
  return (
    <div className="bg-white rounded-lg border border-field mb-4" role="alert">
      <EmptyState
        icon={AlertTriangle}
        title="No se pudieron cargar algunos datos"
        description="Las tablas pueden verse incompletas."
        action={
          <Button onClick={() => queryClient.refetchQueries({ predicate: (q) => q.state.status === "error" })}>
            Reintentar
          </Button>
        }
      />
    </div>
  );
}

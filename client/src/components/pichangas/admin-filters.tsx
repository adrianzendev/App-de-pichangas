import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminPanel } from "@/components/pichangas/admin-ui";
import { PageLoader } from "@/components/ui/spinner";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { toast } from "@/hooks/use-toast";
import { setFilterOptionRequest } from "@/lib/admin-pichangas";
import { FORMAT_OPTIONS, GENDER_OPTIONS, LEVEL_OPTIONS, WHEN_OPTIONS, useDisabledFilters, useFilterOptions } from "@/lib/pichangas";

const GROUPS = [
  { kind: "when", label: "Cuándo", options: WHEN_OPTIONS },
  { kind: "format", label: "Formato", options: FORMAT_OPTIONS },
  { kind: "level", label: "Nivel", options: LEVEL_OPTIONS },
  { kind: "gender", label: "Quién juega", options: GENDER_OPTIONS },
] as const;

// Seccion "Filtros": cada opcion de los filtros del feed se enciende o apaga. El distrito se maneja en "Geografía".
export function AdminFiltersView() {
  const { isLoading } = useFilterOptions();
  const off = useDisabledFilters();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: setFilterOptionRequest,
    onSuccess: (d) => qc.setQueryData(["/api/filter-options"], d),
    onError: () => toast({ variant: "destructive", title: "No pudimos guardar el cambio" }),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {GROUPS.map((g) => (
        <AdminPanel key={g.kind} className="space-y-1 p-4">
          <p className="pb-2 text-label font-bold uppercase text-night-muted">{g.label}</p>
          {g.options.map((o) => {
            const enabled = !off.has(`${g.kind}:${o.id}`);
            return (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-body text-night-text">{o.label}</span>
                <ToggleSwitch checked={enabled} aria-label={`${enabled ? "Ocultar" : "Mostrar"} ${o.label}`} onChange={() => mutation.mutate({ kind: g.kind, value: o.id, enabled: !enabled })} />
              </div>
            );
          })}
        </AdminPanel>
      ))}
    </div>
  );
}

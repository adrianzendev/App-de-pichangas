import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UniversityWithUsage } from "@shared/schema";
import { AdminCreateButton, AdminSection, AdminSectionHeader } from "@/components/admin/admin-layout";
import { AdminRowAction, RowActions } from "@/components/admin/row-actions";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { AdminActionsTd, AdminActionsTh, AdminCountryTd, AdminTable, AdminTableBody, AdminTableCard, AdminTableHead, AdminTableSkeletonRows, AdminTd, AdminTh, AdminTr } from "@/components/ui/admin-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CountrySelect } from "@/components/ui/country-select";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { OutlinedControl } from "@/components/ui/outlined-field";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { pluralizeEs } from "@/lib/pluralize";

const QUERY_KEY = ["/api/admin/universities"];

interface Draft {
  id?: string;
  name: string;
  acronym: string;
  country: string;
}

const EMPTY_DRAFT: Draft = { name: "", acronym: "", country: "" };

// Seccion "Universidades" del panel: el catalogo del que eligen alumnos y tutores su universidad (ya no la escriben a mano).
// Renombrar una universidad actualiza a las cuentas que la tenian elegida; eliminarla no borra el texto de esas cuentas.
export function UniversitiesSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<UniversityWithUsage | null>(null);

  const { data, isLoading } = useQuery<UniversityWithUsage[]>({ queryKey: QUERY_KEY });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
  };
  const onError = (error: any) =>
    toast({ title: "Error", description: error?.message || "No se pudo completar la acción.", variant: "destructive" });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const body = { name: d.name, acronym: d.acronym || null, country: d.country || null };
      await (d.id ? apiRequest("PATCH", `/api/admin/universities/${d.id}`, body) : apiRequest("POST", "/api/admin/universities", body));
    },
    onSuccess: (_, d) => {
      refresh();
      toast({ title: d.id ? "Universidad actualizada" : "Universidad creada", variant: "success" });
      setDraft(null);
    },
    onError,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => { await apiRequest("PATCH", `/api/admin/universities/${id}`, { status: "approved" }); },
    onSuccess: () => { refresh(); toast({ title: "Universidad aprobada", variant: "success" }); },
    onError,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/admin/universities/${id}`); },
    onSuccess: () => {
      refresh();
      toast({ title: "Universidad eliminada" });
      setToDelete(null);
    },
    onError,
  });

  return (
    <AdminSection testId="section-universities">
      <AdminSectionHeader
        description="Las universidades que alumnos y tutores pueden elegir en su perfil. Las sugeridas por usuarios aparecen primero como «Pendiente»: apruébalas, edítalas o elimínalas"
        action={<AdminCreateButton onClick={() => setDraft(EMPTY_DRAFT)} data-testid="button-new-university">Nueva universidad</AdminCreateButton>}
      />
      <AdminTableCard>
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTh>Nombre</AdminTh>
              <AdminTh>Siglas</AdminTh>
              <AdminTh>País</AdminTh>
              <AdminTh align="center">Cuentas</AdminTh>
              <AdminActionsTh />
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {isLoading ? (
              <AdminTableSkeletonRows columns={5} />
            ) : (
              data?.map((u) => (
                <AdminTr key={u.id} data-testid={`row-university-${u.id}`}>
                  <AdminTd variant="primary">
                    {u.name}
                    {u.status === "pending" && <Badge variant="info" className="ml-2">Pendiente</Badge>}
                  </AdminTd>
                  <AdminTd variant="secondary">{u.acronym || "—"}</AdminTd>
                  <AdminCountryTd country={u.country} />
                  <AdminTd align="center" variant="secondary">{u.userCount}</AdminTd>
                  <AdminActionsTd>
                    {u.status === "pending" && <AdminRowAction icon={Check} label="Aprobar universidad" tone="success" onClick={() => approve.mutate(u.id)} />}
                    <RowActions
                      entity="universidad"
                      onEdit={() => setDraft({ id: u.id, name: u.name, acronym: u.acronym ?? "", country: u.country ?? "" })}
                      onDelete={() => setToDelete(u)}
                    />
                  </AdminActionsTd>
                </AdminTr>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
        {!isLoading && data?.length === 0 && (
          <EmptyState title="Aún no hay universidades" description="Crea la primera con «Nueva universidad»: sin ellas, el perfil no tiene qué ofrecer." />
        )}
      </AdminTableCard>

      {draft && (
        <FormDialog
          open
          onOpenChange={(open) => { if (!open) setDraft(null); }}
          title={draft.id ? "Editar universidad" : "Nueva universidad"}
          testId="modal-university"
          onCancel={() => setDraft(null)}
          onSubmit={() => save.mutate(draft)}
          submitLabel={save.isPending ? "Guardando…" : draft.id ? "Guardar cambios" : "Crear universidad"}
          submitDisabled={save.isPending || draft.name.trim().length < 2}
          submitTestId="button-save-university"
        >
          <OutlinedControl htmlFor="university-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              id="university-name"
              aria-required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Universidad Nacional de San Antonio Abad"
              data-testid="input-university-name"
            />
          </OutlinedControl>
          <OutlinedControl htmlFor="university-acronym" label={<>Siglas <span className="font-normal text-gray-700">(opcional)</span></>}>
            <Input
              id="university-acronym"
              maxLength={20}
              value={draft.acronym}
              onChange={(e) => setDraft({ ...draft, acronym: e.target.value })}
              placeholder="UNSAAC"
              data-testid="input-university-acronym"
            />
          </OutlinedControl>
          <OutlinedControl htmlFor="university-country" label={<>País <span className="font-normal text-gray-700">(opcional)</span></>}>
            <CountrySelect id="university-country" value={draft.country} onValueChange={(country) => setDraft({ ...draft, country })} placeholder="Selecciona un país" />
          </OutlinedControl>
        </FormDialog>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => { if (!open) setToDelete(null); }}
        title={`Eliminar ${toDelete?.name ?? "universidad"}`}
        description={
          toDelete && toDelete.userCount > 0
            ? `${toDelete.userCount} ${pluralizeEs(toDelete.userCount, "cuenta la tiene", "cuentas la tienen")} elegida. Conservan el nombre, pero ya no se podrá elegir.`
            : "Esta acción no se puede deshacer."
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </AdminSection>
  );
}

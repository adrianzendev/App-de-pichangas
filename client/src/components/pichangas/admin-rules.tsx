import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  AdminActionsTd, AdminActionsTh, AdminBadge, AdminButton, AdminConfirm, AdminField, AdminFormDialog, AdminInput, AdminSelect, AdminSub,
  AdminTable, AdminTableState, AdminTbody, AdminTd, AdminTextarea, AdminTh, AdminThead, AdminTr,
} from "@/components/pichangas/admin-ui";
import { NightCheckbox } from "@/components/pichangas/night-controls";
import { toast } from "@/hooks/use-toast";
import {
  createRuleRequest, deleteRuleRequest, moveRuleRequest, updateRuleRequest, useAdminAction, useAdminRules,
  type AdminRule, type AdminRuleInput,
} from "@/lib/admin-pichangas";

const ICON_OPTIONS = [
  { value: "clock", label: "Reloj (puntualidad)" },
  { value: "footwear", label: "Calzado" },
  { value: "shield", label: "Escudo (respeto)" },
  { value: "info", label: "Información" },
];
const EMPTY: AdminRuleInput = { title: "", description: "", icon: "shield", isActive: true };
const errorText = (e: unknown) => (e instanceof Error ? e.message : undefined);

function RuleForm({ rule, open, saving, onClose, onSubmit }: {
  rule: AdminRule | null; open: boolean; saving: boolean; onClose: () => void; onSubmit: (d: AdminRuleInput) => void;
}) {
  const [f, setF] = useState<AdminRuleInput>(EMPTY);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (open) { setF(rule ? { title: rule.title, description: rule.description, icon: rule.icon, isActive: rule.isActive } : EMPTY); setTried(false); }
  }, [open, rule]);
  const badTitle = f.title.trim().length < 3;
  const badDesc = f.description.trim().length < 3;
  const submit = () => { setTried(true); if (!badTitle && !badDesc) onSubmit({ ...f, title: f.title.trim(), description: f.description.trim() }); };
  return (
    <AdminFormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={rule ? "Editar regla" : "Nueva regla"}
      onCancel={onClose}
      onSubmit={submit}
      submitLabel={saving ? "Guardando…" : "Guardar"}
      submitDisabled={saving}
    >
      <AdminField label="Título" htmlFor="ru-title">
        <AdminInput id="ru-title" value={f.title} maxLength={80} aria-invalid={tried && badTitle} onChange={(e) => setF({ ...f, title: e.target.value })} />
        {tried && badTitle && <p className="mt-1 text-caption font-bold text-crimson">Mínimo 3 caracteres.</p>}
      </AdminField>
      <AdminField label="Descripción" htmlFor="ru-desc">
        <AdminTextarea id="ru-desc" rows={3} maxLength={300} value={f.description} aria-invalid={tried && badDesc} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <p className="mt-1 text-caption text-night-muted">Usa {"{hora}"} para mostrar la hora de inicio de cada partido.</p>
        {tried && badDesc && <p className="mt-1 text-caption font-bold text-crimson">Mínimo 3 caracteres.</p>}
      </AdminField>
      <AdminField label="Ícono" htmlFor="ru-icon">
        <AdminSelect id="ru-icon" options={ICON_OPTIONS} value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} />
      </AdminField>
      <label htmlFor="ru-active" className="flex items-center gap-2 text-body text-night-text">
        <NightCheckbox id="ru-active" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
        Visible para los jugadores
      </label>
    </AdminFormDialog>
  );
}

// Sección "Reglas" del panel: lo que se muestra como reglas del encuentro en el detalle y el pase de todos los partidos.
export function AdminRulesView() {
  const { data = [], isLoading, isError, refetch } = useAdminRules();
  const create = useAdminAction(createRuleRequest);
  const update = useAdminAction(updateRuleRequest);
  const move = useAdminAction(moveRuleRequest);
  const remove = useAdminAction(deleteRuleRequest);
  // form: undefined = cerrado, null = regla nueva, AdminRule = editando.
  const [form, setForm] = useState<AdminRule | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<AdminRule | null>(null);

  const save = (d: AdminRuleInput) => {
    const opts = {
      onSuccess: () => { toast({ title: form ? "Regla actualizada" : "Regla creada", variant: "success" }); setForm(undefined); },
      onError: (e: unknown) => toast({ variant: "destructive", title: "No pudimos guardar la regla", description: errorText(e) }),
    };
    if (form) update.mutate({ id: form.id, data: d }, opts); else create.mutate(d, opts);
  };

  return (
    <div className="flex flex-1 flex-col space-y-section-gap">
      <div className="flex justify-end"><AdminButton tone="pitch" onClick={() => setForm(null)}>Nueva regla</AdminButton></div>
      <AdminTableState isLoading={isLoading} isError={isError} empty={data.length === 0} columns={4} onRetry={() => refetch()}>
        <AdminTable minWidth={760}>
          <AdminThead><tr><AdminTh>Regla</AdminTh><AdminTh>Estado</AdminTh><AdminTh align="center">Orden</AdminTh><AdminActionsTh /></tr></AdminThead>
          <AdminTbody>
            {data.map((r, i) => (
              <AdminTr key={r.id}>
                <AdminTd tone="primary">{r.title}<AdminSub>{r.description}</AdminSub></AdminTd>
                <AdminTd>{r.isActive ? <AdminBadge tone="success">Visible</AdminBadge> : <AdminBadge tone="neutral">Oculta</AdminBadge>}</AdminTd>
                <AdminTd align="center">
                  <div className="flex justify-center gap-1">
                    <AdminButton compact aria-label="Subir" disabled={i === 0} onClick={() => move.mutate({ id: r.id, direction: "up" })}><ArrowUp className="size-icon-md" /></AdminButton>
                    <AdminButton compact aria-label="Bajar" disabled={i === data.length - 1} onClick={() => move.mutate({ id: r.id, direction: "down" })}><ArrowDown className="size-icon-md" /></AdminButton>
                  </div>
                </AdminTd>
                <AdminActionsTd>
                  <div className="flex justify-end gap-2">
                    <AdminButton compact onClick={() => setForm(r)}>Editar</AdminButton>
                    <AdminButton compact tone="danger" onClick={() => setToDelete(r)}>Eliminar</AdminButton>
                  </div>
                </AdminActionsTd>
              </AdminTr>
            ))}
          </AdminTbody>
        </AdminTable>
      </AdminTableState>
      <RuleForm rule={form ?? null} open={form !== undefined} saving={create.isPending || update.isPending} onClose={() => setForm(undefined)} onSubmit={save} />
      <AdminConfirm
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar esta regla?"
        description={toDelete ? `${toDelete.title}. Deja de mostrarse en todos los partidos. Si solo quieres ocultarla un tiempo, edítala y desmarca "Visible".` : undefined}
        confirmLabel="Eliminar regla"
        destructive
        onConfirm={() => toDelete && remove.mutate(toDelete.id, {
          onSuccess: () => toast({ title: "Regla eliminada", description: toDelete.title }),
          onError: (e) => toast({ variant: "destructive", title: "No pudimos eliminar la regla", description: errorText(e) }),
        })}
      />
    </div>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EnumSelect } from "@/components/ui/enum-select";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { OutlinedControl } from "@/components/ui/outlined-field";
import { Textarea } from "@/components/ui/textarea";
import { AdminActionsTd, AdminActionsTh, AdminTable, AdminTableBody, AdminTableHead, AdminTd, AdminTh, AdminTr } from "@/components/ui/admin-table";
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
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={rule ? "Editar regla" : "Nueva regla"}
      onCancel={onClose}
      onSubmit={submit}
      submitLabel={saving ? "Guardando…" : "Guardar"}
      submitDisabled={saving}
    >
      <OutlinedControl label="Título" htmlFor="ru-title">
        <Input id="ru-title" value={f.title} maxLength={80} aria-invalid={tried && badTitle} onChange={(e) => setF({ ...f, title: e.target.value })} />
        {tried && badTitle && <p className="mt-1 text-caption text-error-fg">Mínimo 3 caracteres.</p>}
      </OutlinedControl>
      <OutlinedControl label="Descripción" htmlFor="ru-desc">
        <Textarea id="ru-desc" rows={3} maxLength={300} value={f.description} aria-invalid={tried && badDesc} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <p className="mt-1 text-caption text-gray-700">Usa {"{hora}"} para mostrar la hora de inicio de cada partido.</p>
        {tried && badDesc && <p className="mt-1 text-caption text-error-fg">Mínimo 3 caracteres.</p>}
      </OutlinedControl>
      <OutlinedControl label="Ícono" htmlFor="ru-icon">
        <EnumSelect id="ru-icon" options={ICON_OPTIONS} value={f.icon} onValueChange={(v) => setF({ ...f, icon: v })} />
      </OutlinedControl>
      <label className="flex items-center gap-2 text-body text-gray-900">
        <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
        Visible para los jugadores
      </label>
    </FormDialog>
  );
}

interface TableStateProps { isLoading: boolean; isError: boolean; empty: boolean; columns: number; onRetry: () => void; children: ReactNode }

// Sección "Reglas" del panel: lo que se muestra como reglas del encuentro en el detalle y el pase de todos los partidos.
export function AdminRulesView({ TableState }: { TableState: (p: TableStateProps) => JSX.Element }) {
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
    <div className="space-y-section-gap">
      <div className="flex justify-end"><Button onClick={() => setForm(null)}>Nueva regla</Button></div>
      <TableState isLoading={isLoading} isError={isError} empty={data.length === 0} columns={4} onRetry={() => refetch()}>
        <AdminTable minWidth={760}>
          <AdminTableHead><tr><AdminTh>Regla</AdminTh><AdminTh>Estado</AdminTh><AdminTh align="center">Orden</AdminTh><AdminActionsTh /></tr></AdminTableHead>
          <AdminTableBody>
            {data.map((r, i) => (
              <AdminTr key={r.id}>
                <AdminTd variant="primary">{r.title}<span className="block text-caption font-normal text-gray-700">{r.description}</span></AdminTd>
                <AdminTd>{r.isActive ? <Badge variant="success">Visible</Badge> : <Badge variant="neutral">Oculta</Badge>}</AdminTd>
                <AdminTd align="center">
                  <div className="flex justify-center gap-1">
                    <Button size="sm" variant="outline" aria-label="Subir" disabled={i === 0} onClick={() => move.mutate({ id: r.id, direction: "up" })}><ArrowUp className="size-icon-md" /></Button>
                    <Button size="sm" variant="outline" aria-label="Bajar" disabled={i === data.length - 1} onClick={() => move.mutate({ id: r.id, direction: "down" })}><ArrowDown className="size-icon-md" /></Button>
                  </div>
                </AdminTd>
                <AdminActionsTd endsWithIcon={false}>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setForm(r)}>Editar</Button>
                    <Button size="sm" variant="destructive-outline" onClick={() => setToDelete(r)}>Eliminar</Button>
                  </div>
                </AdminActionsTd>
              </AdminTr>
            ))}
          </AdminTableBody>
        </AdminTable>
      </TableState>
      <RuleForm rule={form ?? null} open={form !== undefined} saving={create.isPending || update.isPending} onClose={() => setForm(undefined)} onSubmit={save} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar esta regla?"
        description={toDelete ? `${toDelete.title}. Deja de mostrarse en todos los partidos. Si solo quieres ocultarla un tiempo, edítala y desmarca "Visible".` : undefined}
        confirmLabel="Eliminar regla"
        cancelLabel="Volver"
        destructive
        onConfirm={() => toDelete && remove.mutate(toDelete.id, {
          onSuccess: () => toast({ title: "Regla eliminada", description: toDelete.title }),
          onError: (e) => toast({ variant: "destructive", title: "No pudimos eliminar la regla", description: errorText(e) }),
        })}
      />
    </div>
  );
}

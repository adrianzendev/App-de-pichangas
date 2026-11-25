import { OutlinedControl } from "@/components/ui/outlined-field";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { AccountActiveToggle, AccountIdentityFields, type AccountStatus } from "@/components/admin/account-fields";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/** Permisos que se pueden dar a un agente (una sola lista para crear y editar). */
const AGENT_PERMISSIONS = [
  { key: "view_tasks", label: "Ver Pedidos", desc: "Lista de pedidos (solo lectura)" },
  { key: "manage_candidates", label: "Gestionar Candidatos", desc: "Seleccionar tutor en nombre del alumno" },
  { key: "republish_tasks", label: "Republicar Pedidos", desc: "Reabrir pedidos vencidos" },
  { key: "view_tutors", label: "Ver Tutores", desc: "Lista de tutores (solo lectura)" },
  { key: "add_tutors", label: "Agregar Tutores", desc: "Puede registrar nuevos tutores" },
  { key: "edit_tutors", label: "Editar Tutores", desc: "Puede modificar datos de tutores" },
] as const;

interface AgentFormValues {
  name: string;
  email: string;
  password: string;
  status: AccountStatus;
  permissions: string[];
}

const EMPTY_AGENT: AgentFormValues = { name: "", email: "", password: "123456", status: "active", permissions: [] };

interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** create = "Nuevo agente"; edit = "Editar agente" (requiere `agent`). */
  mode: "create" | "edit";
  agent?: (User & { agentPermissions?: string[] | null }) | null;
}

/**
 * Modal unico para crear y editar un agente: mismos campos, mismo interruptor "Cuenta activa" que tutores
 * y alumnos (AccountIdentityFields + AccountActiveToggle) y una sola lista de permisos. Guarda todo con un solo boton.
 */
export function AgentFormDialog({ open, onOpenChange, mode, agent }: AgentFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = mode === "edit";
  const [form, setForm] = useState<AgentFormValues>(EMPTY_AGENT);

  useEffect(() => {
    if (!open) return;
    if (!isEdit || !agent) {
      setForm(EMPTY_AGENT);
      return;
    }
    setForm({
      name: agent.name || "",
      email: agent.email || "",
      password: "",
      // Cuentas guardadas como "inactive" (valor antiguo del interruptor de agentes) cuentan como inactivas
      status: agent.status === "suspended" ? "suspended" : agent.status === "paused" || agent.status === "inactive" ? "paused" : "active",
      permissions: agent.agentPermissions || [],
    });
  }, [open, isEdit, agent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      if (!isEdit) {
        await apiRequest("POST", "/api/admin/agents", {
          name: form.name,
          email: form.email,
          password: form.password,
          status: form.status === "active" ? "active" : "paused",
          agentPermissions: form.permissions,
        });
        return;
      }
      if (!agent) return;
      const data: { name: string; email: string; status: string; password?: string } = {
        name: form.name,
        email: form.email,
        status: form.status,
      };
      if (form.password.trim()) data.password = form.password.trim();
      await Promise.all([
        apiRequest("PATCH", `/api/users/${agent.id}`, data),
        apiRequest("PATCH", `/api/admin/agents/${agent.id}/permissions`, { permissions: form.permissions }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: isEdit ? "Agente actualizado" : "Agente creado", description: isEdit ? undefined : "El agente fue registrado correctamente." });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || (isEdit ? "No se pudo actualizar el agente." : "No se pudo crear el agente."),
        variant: "destructive",
      });
    },
  });

  const patch = (p: Partial<AgentFormValues>) => setForm((prev) => ({ ...prev, ...p }));
  const togglePermission = (key: string) =>
    patch({ permissions: form.permissions.includes(key) ? form.permissions.filter((k) => k !== key) : [...form.permissions, key] });
  const idPrefix = isEdit ? "edit-agent" : "new-agent";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar agente" : "Nuevo agente"}
      testId={isEdit ? "modal-edit-agent" : "modal-create-agent"}
      onCancel={() => onOpenChange(false)}
      onSubmit={() => save.mutate()}
      submitLabel={save.isPending ? (isEdit ? "Guardando…" : "Creando…") : isEdit ? "Guardar cambios" : "Crear agente"}
      submitDisabled={save.isPending || !form.name || !form.email}
      submitClassName="bg-primary-600 hover:bg-primary-700 text-white"
    >
      <AccountIdentityFields idPrefix={idPrefix} value={form} onChange={patch} namePlaceholder="Nombre del agente" />
      <div>
        <OutlinedControl htmlFor={`${idPrefix}-password`} label={<>{isEdit ? "Nueva contraseña" : "Contraseña"} {isEdit && <span className="text-gray-700 font-normal"> (vacío = no cambiar)</span>}</>}>
          <Input
            id={`${idPrefix}-password`}
            value={form.password}
            onChange={(e) => patch({ password: e.target.value })}
            placeholder={isEdit ? "Nueva contraseña" : "123456"}
          />
        </OutlinedControl>
      </div>

      <AccountActiveToggle
        value={form}
        onChange={patch}
        subject="el agente"
        deactivateTo={agent?.status === "suspended" ? "suspended" : "paused"}
      />

      <div className="rounded-lg border border-border bg-card p-card-pad">
        <p className="text-body font-medium leading-none">Permisos</p>
        <div className="mt-2 space-y-1">
          {AGENT_PERMISSIONS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-body text-gray-900">{label}</p>
                <p className="text-caption text-gray-700">{desc}</p>
              </div>
              <ToggleSwitch aria-label={label} checked={form.permissions.includes(key)} onChange={() => togglePermission(key)} />
            </div>
          ))}
        </div>
      </div>
    </FormDialog>
  );
}

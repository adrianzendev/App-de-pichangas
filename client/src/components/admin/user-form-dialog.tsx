import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { FormDialog } from "@/components/ui/form-dialog";
import type { CountryOption } from "@/components/ui/country-select";
import { AccountActiveToggle, AccountFields, type AccountValues } from "@/components/admin/account-fields";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const EMPTY_USER: AccountValues = {
  name: "",
  email: "",
  whatsapp: "",
  university: "",
  country: "PE",
  status: "active",
};

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** create = "Nuevo estudiante"; edit = "Editar usuario" (requiere `user`). */
  mode: "create" | "edit";
  user?: User | null;
  countries?: CountryOption[];
}

/**
 * Modal unico para crear un estudiante y editar un usuario: mismos campos y estilo que el de tutor
 * (comparten AccountFields y AccountActiveToggle). Guarda por su cuenta y refresca la lista de usuarios.
 */
export function UserFormDialog({ open, onOpenChange, mode, user, countries }: UserFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = mode === "edit";
  const [form, setForm] = useState<AccountValues>(EMPTY_USER);

  useEffect(() => {
    if (!open) return;
    if (!isEdit || !user) {
      setForm(EMPTY_USER);
      return;
    }
    setForm({
      name: user.name || "",
      email: user.email || "",
      whatsapp: user.whatsapp || "",
      university: user.university || "",
      country: user.country || "PE",
      status: (user.status as AccountValues["status"] | null) || "active",
    });
  }, [open, isEdit, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        if (!user) return;
        await apiRequest("PATCH", `/api/users/${user.id}`, form);
      } else {
        await apiRequest("POST", "/api/admin/students", form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: isEdit ? "Usuario actualizado" : "Estudiante creado exitosamente" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || (isEdit ? "No se pudo actualizar el usuario" : "No se pudo crear el estudiante"),
        variant: "destructive",
      });
    },
  });

  const patch = (p: Partial<AccountValues>) => setForm((prev) => ({ ...prev, ...p }));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar usuario" : "Nuevo estudiante"}
      testId={isEdit ? "modal-edit-user" : "modal-create-student"}
      onCancel={() => onOpenChange(false)}
      cancelTestId={isEdit ? "button-cancel-edit" : undefined}
      onSubmit={() => save.mutate()}
      submitLabel={save.isPending ? (isEdit ? "Guardando…" : "Creando…") : isEdit ? "Guardar cambios" : "Crear estudiante"}
      submitDisabled={save.isPending || !form.name || !form.email}
      submitTestId={isEdit ? "button-save-user" : undefined}
      submitClassName="bg-primary-600 hover:bg-primary-700 text-white"
    >
      <AccountFields
        idPrefix={isEdit ? "edit-user" : "new-student"}
        value={form}
        onChange={patch}
        countries={countries}
        namePlaceholder="Nombre del usuario"
      />
      <AccountActiveToggle
        value={form}
        onChange={patch}
        subject="el usuario"
        deactivateTo={user?.status === "suspended" ? "suspended" : "paused"}
      />
    </FormDialog>
  );
}

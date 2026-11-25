import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TutorWithUser } from "@shared/schema";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CountryOption } from "@/components/ui/country-select";
import { TutorFormFields, type TutorFormValues } from "@/components/admin/tutor-form-fields";
import { apiRequest } from "@/lib/queryClient";
import { getFileUrl } from "@/lib/file-url-utils";
import { fileToDataUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const EMPTY_TUTOR: TutorFormValues = {
  name: "",
  email: "",
  whatsapp: "",
  university: "",
  country: "PE",
  status: "active",
  profession: "",
  language: "Español", // el pais por defecto (PE) es de LATAM; el servidor repite esa regla si llega vacio
  bio: "",
  isVerified: false,
  hasGeneralAccess: false,
  assignedCourseIds: [],
};

async function uploadTutorPhoto(tutorId: string, file: File) {
  const formData = new FormData();
  formData.append("profilePhoto", file);
  const res = await fetch(`/api/admin/tutors/${tutorId}/upload-photo`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Error al subir la foto");
  }
}

/** Fila de /api/admin/tutors: `activationPending` = invitacion enviada y sin clave definida. */
export type AdminTutor = TutorWithUser & { activationPending?: boolean };

/** Reenvia el correo de activacion (token nuevo). Usado por la tabla y por el modal de edicion. */
export function useResendActivation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tutorId: string) => (await apiRequest("POST", `/api/admin/tutors/${tutorId}/resend-activation`)).json() as Promise<{ email: string }>,
    onSuccess: ({ email }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutors"] });
      toast({ title: `Correo de acceso enviado a ${email}`, variant: "success" });
    },
    onError: (error: any) =>
      toast({ title: "Error", description: error?.message || "No se pudo reenviar el correo", variant: "destructive" }),
  });
}

interface TutorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** create = "Nuevo tutor"; edit = "Editar tutor" (requiere `tutor`). */
  mode: "create" | "edit";
  tutor?: AdminTutor | null;
  countries?: CountryOption[];
  careers?: { id: string; name: string; isActive?: boolean | null }[];
  courses?: { id: string; label: string; isActive?: boolean | null }[];
}

/**
 * Modal unico para crear y editar un tutor: mismos campos, mismo estilo, mismo flujo de foto.
 * Guarda por su cuenta (mutaciones propias) y refresca las listas de tutores y usuarios.
 */
export function TutorFormDialog({ open, onOpenChange, mode, tutor, countries, careers, courses }: TutorFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = mode === "edit";
  const resend = useResendActivation();

  const [form, setForm] = useState<TutorFormValues>(EMPTY_TUTOR);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // En edicion, no se guardan los cursos hasta haber cargado los asignados (evita vaciarlos por error)
  const [coursesLoaded, setCoursesLoaded] = useState(!isEdit);
  // Aviso al desactivar a un tutor que tiene pedidos en curso
  const [activeTasksWarning, setActiveTasksWarning] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhotoFile(null);
    if (!isEdit || !tutor) {
      setForm(EMPTY_TUTOR);
      setPhotoPreview(null);
      setCoursesLoaded(true);
      return;
    }
    const u = tutor.user;
    setForm({
      name: u?.name || "",
      email: u?.email || "",
      whatsapp: u?.whatsapp || "",
      university: u?.university || "",
      country: u?.country || "PE",
      status: (u?.status as TutorFormValues["status"] | null) || "active",
      profession: tutor.profession || "",
      language: tutor.language || "",
      bio: tutor.bio || "",
      isVerified: tutor.isVerified || false,
      hasGeneralAccess: tutor.hasGeneralAccess || false,
      assignedCourseIds: [],
    });
    setPhotoPreview(u?.avatar ? getFileUrl(u.avatar) : null);

    let cancelled = false;
    setCoursesLoaded(false);
    fetch(`/api/admin/tutors/${tutor.id}/courses`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("courses"))))
      .then((assigned: { id: string }[]) => {
        if (cancelled) return;
        setForm((prev) => ({ ...prev, assignedCourseIds: assigned.map((c) => c.id) }));
        setCoursesLoaded(true);
      })
      .catch(() => {
        if (!cancelled) toast({ title: "No se pudieron cargar los cursos asignados", variant: "destructive" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, isEdit, tutor?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      if (!isEdit) {
        const res = await apiRequest("POST", "/api/admin/tutors", { ...form, studyAreaIds: [] });
        const created = await res.json();
        // La foto se sube despues de crear: necesita el id del tutor
        if (photoFile && created?.tutor?.id) {
          await uploadTutorPhoto(created.tutor.id, photoFile).catch(() =>
            toast({ title: "Tutor creado, pero no se pudo subir la foto", variant: "destructive" }),
          );
        }
        return;
      }
      if (!tutor) return;
      if (photoFile) await uploadTutorPhoto(tutor.id, photoFile);
      await Promise.all([
        apiRequest("PATCH", `/api/admin/tutors/${tutor.id}`, {
          userId: tutor.user?.id || "",
          name: form.name,
          email: form.email,
          whatsapp: form.whatsapp,
          university: form.university,
          country: form.country,
          status: form.status,
          profession: form.profession,
          language: form.language,
          bio: form.bio,
          isVerified: form.isVerified,
        }),
        apiRequest("PATCH", `/api/admin/tutors/${tutor.id}/general-access`, { hasGeneralAccess: form.hasGeneralAccess }),
        coursesLoaded
          ? apiRequest("PUT", `/api/admin/tutors/${tutor.id}/courses`, { courseIds: form.assignedCourseIds })
          : Promise.resolve(),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: isEdit ? "Cambios guardados" : "Tutor creado exitosamente" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || (isEdit ? "No se pudieron guardar los cambios." : "No se pudo crear el tutor"),
        variant: "destructive",
      });
    },
  });

  const deactivating = isEdit && tutor?.user?.status === "active" && form.status !== "active";

  // Si se va a desactivar y el tutor tiene pedidos en curso, pide confirmacion antes de guardar
  const handleSubmit = async () => {
    if (!deactivating || !tutor) return save.mutate();
    setChecking(true);
    try {
      const res = await apiRequest("GET", `/api/admin/tutors/${tutor.id}/active-tasks`);
      const { count, tasks } = (await res.json()) as { count: number; tasks: { taskNumber: number | null; title: string }[] };
      if (count === 0) return save.mutate();
      const refs = tasks.map((t) => (t.taskNumber ? `#${t.taskNumber}` : t.title)).join(", ");
      setActiveTasksWarning(
        `Este tutor tiene ${count} pedido${count > 1 ? "s" : ""} activo${count > 1 ? "s" : ""} (${refs}). Si lo desactivas, no podrá iniciar sesión ni atenderlo${count > 1 ? "s" : ""}.`,
      );
    } catch {
      toast({ title: "No se pudo verificar si el tutor tiene pedidos activos", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar tutor" : "Nuevo tutor"}
      testId={isEdit ? "modal-edit-tutor" : "modal-create-tutor"}
      onCancel={() => onOpenChange(false)}
      onSubmit={handleSubmit}
      submitLabel={save.isPending || checking ? (isEdit ? "Guardando…" : "Creando…") : isEdit ? "Guardar cambios" : "Crear tutor"}
      submitDisabled={save.isPending || checking || !form.name || !form.email || (isEdit && !coursesLoaded)}
      submitClassName="bg-primary-600 hover:bg-primary-700 text-white"
    >
      {isEdit && tutor && (
        <div className="space-y-2" data-testid="text-invitation-status">
          <p className="flex items-center gap-2 text-label">
            <span className={`size-2 rounded-full ${tutor.activationPending ? "bg-yellow-500" : "bg-primary-600"}`} aria-hidden />
            {tutor.activationPending ? "Invitación enviada: pendiente de activación" : "Cuenta activada por el tutor"}
          </p>
          <Button
            type="button"
            variant={tutor.activationPending ? "default" : "secondary"}
            className="w-full"
            disabled={resend.isPending}
            onClick={() => resend.mutate(tutor.id)}
            data-testid="button-send-access-email"
          >
            <Mail />
            {resend.isPending
              ? "Enviando…"
              : tutor.activationPending
                ? "Reenviar invitación de acceso"
                : "Enviar enlace de acceso / restablecer contraseña"}
          </Button>
        </div>
      )}
      <TutorFormFields
        idPrefix={isEdit ? "edit-tutor" : "new-tutor"}
        value={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        countries={countries}
        careers={careers}
        courses={courses}
        deactivateTo={tutor?.user?.status === "suspended" ? "suspended" : "paused"}
        photo={{
          preview: photoPreview,
          hasNewFile: !!photoFile,
          onPick: (file) => {
            setPhotoFile(file);
            fileToDataUrl(file).then(setPhotoPreview).catch(() => {});
          },
        }}
      />
    </FormDialog>
    <ConfirmDialog
      open={!!activeTasksWarning}
      onOpenChange={(o) => { if (!o) setActiveTasksWarning(null); }}
      title="Este tutor tiene pedidos activos"
      description={`${activeTasksWarning ?? ""} ¿Seguro que quieres desactivarlo?`}
      confirmLabel="Sí, desactivar"
      destructive
      onConfirm={() => { setActiveTasksWarning(null); save.mutate(); }}
    />
    </>
  );
}

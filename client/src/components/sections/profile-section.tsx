
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Bell, Camera, ImagePlus } from "lucide-react";
import { ListScreen } from "@/components/ui/list-screen";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProfileFields } from "@/components/profile/profile-fields";
import { validateUniversity } from "@shared/profile-validation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AccountSettingsSection } from "@/components/account/account-settings-section";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import type { UserWithType } from "@shared/schema";
import { IconCircle } from "@/components/ui/icon-circle";

export default function ProfileSection() {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const formSynced = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    university: "",
    whatsapp: "",
    country: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: currentUser, isLoading, isError, refetch } = useQuery<UserWithType>({
    queryKey: ["/api/user/current"],
  });
  
  const {
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    checkError: pushCheckError,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications(currentUser?.id || null);

  useEffect(() => {
    // Sincroniza una sola vez (y tras guardar): un refetch en segundo plano no pisa lo que el usuario escribe.
    if (currentUser && !formSynced.current) {
      formSynced.current = true;
      setEditForm({
        name: currentUser.name || "",
        university: currentUser.university || "",
        whatsapp: currentUser.whatsapp || "",
        country: currentUser.country || "",
      });
    }
  }, [currentUser]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      return await apiRequest("PUT", "/api/user/current", data);
    },
    onSuccess: () => {
      formSynced.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/user/current"] });
      toast({ variant: "success", title: "Perfil actualizado", description: "Tus datos han sido guardados correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el perfil.", variant: "destructive" });
    },
  });

  const uploadProfilePhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("profilePhoto", file);
      return await apiRequest("POST", "/api/user/upload-photo", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/current"] });
      toast({ variant: "success", title: "Foto de perfil actualizada", description: "Tu foto de perfil ha sido cambiada correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la foto de perfil.", variant: "destructive" });
    },
  });

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Solo se permiten archivos de imagen.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "La imagen no puede superar los 5MB.", variant: "destructive" });
      return;
    }
    setPendingFile(file);
  };

  const confirmPhotoUpload = () => {
    if (pendingFile) {
      uploadProfilePhotoMutation.mutate(pendingFile);
      setPendingFile(null);
    }
  };

  if (isLoading) {
    return (
      <ListScreen>
        <div className="bg-white">
          <Skeleton className="h-skeleton-panel rounded-md" />
        </div>
      </ListScreen>
    );
  }

  if (isError || !currentUser) {
    return (
      <ListScreen>
        <div className="bg-white">
          <EmptyState
            icon={AlertCircle}
            title="No pudimos cargar tu perfil"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={<Button onClick={() => refetch()}>Reintentar</Button>}
          />
        </div>
      </ListScreen>
    );
  }

  const university = validateUniversity(editForm.university);
  const errors = {
    name: editForm.name.trim() ? "" : "Ingresa tu nombre",
    university: university.error,
  };
  const hasErrors = !!(errors.name || errors.university);

  const dirty =
    editForm.name !== (currentUser.name || "") ||
    editForm.university !== (currentUser.university || "") ||
    editForm.whatsapp !== (currentUser.whatsapp || "") ||
    editForm.country !== (currentUser.country || "");

  return (
    <div>
      <ListScreen>
        {/* Propuesta 1b: identidad arriba + campos en una columna. Mismo borde/alto que PageBannerSheet: a sangre en movil, tarjeta desde lg. */}
        <div className="bg-white">
          <h1 className="sr-only">Mi perfil</h1>
          <form
            className="space-y-7"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setShowErrors(true);
              if (dirty && !hasErrors) updateProfileMutation.mutate({ ...editForm, university: university.value });
            }}
          >
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label="Cambiar foto de perfil"
                  onClick={() => setShowPhotoMenu(true)}
                  className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <UserAvatar name={currentUser.name} avatar={currentUser.avatar} size="lg" />
                  <span aria-hidden className="absolute bottom-0 right-0 flex size-icon-badge-lg items-center justify-center rounded-full bg-green-600 text-white ring-2 ring-white">
                    <Camera className="size-icon-md" />
                  </span>
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="user" hidden onChange={handlePhotoUpload} />
                <input ref={galleryInputRef} type="file" accept="image/*" hidden onChange={handlePhotoUpload} />
              </div>
              <div className="min-w-0">
                <h2 className="text-heading font-bold text-gray-900">{currentUser.name}</h2>
              </div>
            </div>

            <ProfileFields
              value={editForm}
              onChange={(patch) => setEditForm({ ...editForm, ...patch })}
              email={currentUser.email || ""}
              nameError={showErrors ? errors.name : ""}
              universityError={showErrors ? errors.university : ""}
            />

            {/* Siempre visible (web y app nativa): el permiso y los errores del canal se manejan al tocar el interruptor. */}
            <section className="space-y-3">
                <h2 className="text-subheading font-semibold text-gray-900">Preferencias</h2>
                <div className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <IconCircle>
                      <Bell className="size-icon-lg text-green-600" />
                    </IconCircle>
                    <div>
                      <p className="text-body font-medium text-gray-900">Notificaciones</p>
                      <p className="text-caption text-gray-700">Recibe alertas al instante sobre tus pedidos y mensajes</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    aria-label="Notificaciones"
                    checked={pushSubscribed}
                    onChange={() => pushSubscribed ? unsubscribePush() : subscribePush()}
                    disabled={pushLoading}
                  />
                </div>
                {pushCheckError && (
                  // La comprobacion del canal fallo: se explica el motivo bajo el interruptor sin ocultarlo.
                  <p className="text-caption text-gray-700" data-testid="push-check-error">
                    Notificaciones push no disponibles: {pushCheckError}
                  </p>
                )}
              </section>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!dirty}
                isLoading={updateProfileMutation.isPending}
                className="w-full lg:w-auto"
              >
                {updateProfileMutation.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </div>
        <AccountSettingsSection />
      </ListScreen>

      {/* Photo Upload Confirmation Dialog */}
      <AlertDialog open={!!pendingFile} onOpenChange={() => setPendingFile(null)}>
        <AlertDialogContent className="mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar actualización de foto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas realmente actualizar tu foto de perfil? La imagen actual será reemplazada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPhotoUpload}>
              Sí, actualizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo Menu Dialog */}
      <Dialog open={showPhotoMenu} onOpenChange={setShowPhotoMenu}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir archivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => { cameraInputRef.current?.click(); setTimeout(() => setShowPhotoMenu(false), 300); }}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-md text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <IconCircle>
                <Camera className="size-icon-lg text-green-600" />
              </IconCircle>
              <span className="text-body font-semibold">Cámara</span>
            </button>
            <button
              type="button"
              onClick={() => { galleryInputRef.current?.click(); setTimeout(() => setShowPhotoMenu(false), 300); }}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-md text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <IconCircle>
                <ImagePlus className="size-icon-lg text-green-600" />
              </IconCircle>
              <span className="text-body font-semibold">Galería</span>
            </button>
          </div>
          <Button
            onClick={() => setShowPhotoMenu(false)}
            variant="ghost"
            className="w-full mt-2 text-gray-700"
          >
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

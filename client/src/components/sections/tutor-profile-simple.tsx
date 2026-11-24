
import { OutlinedControl } from "@/components/ui/outlined-field";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountSettingsSection } from "@/components/account/account-settings-section";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BarChart3, Bell, Camera, ChevronRight, ImagePlus, Star, Volume2 } from "lucide-react";
import { useLocation } from "wouter";
import { ROUTES } from "@/lib/routes";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { IconCircle } from "@/components/ui/icon-circle";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileFields } from "@/components/profile/profile-fields";
import { validateUniversity } from "@shared/profile-validation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { SpecialtyBadges } from "@/components/ui/specialty-badges";
import { FieldLinkRow } from "@/components/ui/field-link-row";
import { VerifiedBadge } from "@/components/ui/verified-badge";

interface SimpleUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  university?: string | null;
  whatsapp?: string | null;
  country?: string | null;
}

interface SimpleTutor {
  id: string;
  profession: string;
  rating?: string;
  isVerified?: boolean;
  specialties?: string[];
  bio?: string | null;
}

// Sin relleno propio: el contenido arranca en el margen de pagina (px-page-h), como Pedidos y Tutores, y aprovecha todo el ancho.
const SHEET = "bg-white";

// Mi perfil del tutor: misma pantalla que la del alumno (propuesta 1b: identidad arriba + una columna),
// mas el bloque "Perfil profesional" (descripcion y especialidades).
export default function TutorProfileSection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const formSynced = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('soundEnabled') !== 'false';
  });
  const [editForm, setEditForm] = useState({
    name: "",
    university: "",
    whatsapp: "",
    country: "",
    bio: "",
  });

  const { data: currentUser, isLoading: isLoadingUser, isError: isUserError, refetch: refetchUser } = useQuery<SimpleUser>({
    queryKey: ["/api/user/current"],
  });

  const { data: tutorProfile, isLoading: isLoadingTutor } = useQuery<SimpleTutor>({
    queryKey: ["/api/tutor/current"],
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
    if (currentUser && !isLoadingTutor && !formSynced.current) {
      formSynced.current = true;
      setEditForm({
        name: currentUser.name || "",
        university: currentUser.university || "",
        whatsapp: currentUser.whatsapp || "",
        country: currentUser.country || "",
        bio: tutorProfile?.bio || "",
      });
    }
  }, [currentUser, tutorProfile, isLoadingTutor]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const { bio, ...userData } = data;
      await apiRequest("PUT", "/api/user/current", userData);
      if (tutorProfile?.id) {
        await apiRequest("PATCH", `/api/tutors/${tutorProfile.id}`, { bio });
      }
      return true;
    },
    onSuccess: () => {
      formSynced.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/user/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/current"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/current"] });
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
    uploadProfilePhotoMutation.mutate(file);
    event.target.value = '';
  };

  if (isLoadingUser || isLoadingTutor) {
    return (
      <Container fullWidth className="py-page-top space-y-section-gap">
        <div className={SHEET}>
          <Skeleton className="h-96 rounded-md" />
        </div>
      </Container>
    );
  }

  if (isUserError || !currentUser) {
    return (
      <Container fullWidth className="py-page-top space-y-section-gap">
        <div className={SHEET}>
          <EmptyState
            icon={AlertCircle}
            title="No pudimos cargar tu perfil"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={<Button onClick={() => refetchUser()}>Reintentar</Button>}
          />
        </div>
      </Container>
    );
  }

  const nameError = editForm.name.trim() ? "" : "Ingresa tu nombre";
  const university = validateUniversity(editForm.university);
  const dirty =
    editForm.name !== (currentUser.name || "") ||
    editForm.university !== (currentUser.university || "") ||
    editForm.whatsapp !== (currentUser.whatsapp || "") ||
    editForm.country !== (currentUser.country || "") ||
    editForm.bio !== (tutorProfile?.bio || "");

  const photoRow = "w-full flex items-center gap-4 px-4 py-3 rounded-md text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors";
  const prefRow = "flex items-center justify-between gap-3 rounded-md bg-gray-50 px-4 py-3";

  return (
    <div>
      <Container fullWidth className="py-page-top space-y-section-gap">
        <div className={SHEET}>
          <h1 className="sr-only">Mi perfil</h1>
          <form
            className="space-y-7"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setShowErrors(true);
              if (dirty && !nameError && !university.error) updateProfileMutation.mutate({ ...editForm, university: university.value });
            }}
          >
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label="Cambiar foto de perfil"
                  onClick={() => setShowPhotoMenu(true)}
                  disabled={uploadProfilePhotoMutation.isPending}
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
                <div className="flex items-center gap-2">
                  {tutorProfile?.isVerified && <VerifiedBadge />}
                  <h2 className="text-heading font-bold text-gray-900">{currentUser.name}</h2>
                </div>
                <p className="flex items-center gap-1 text-body text-gray-700">
                  <span className="truncate">{tutorProfile?.profession || "Tutor"}</span>
                  <Star aria-hidden className="size-icon-md shrink-0 fill-green-600 text-green-600" />
                  <span>{Number(tutorProfile?.rating || 0).toFixed(1)}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLocation(ROUTES.tutorStats)}
              className={`${prefRow} w-full text-left transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
              data-testid="link-tutor-stats"
            >
              <span className="flex items-center gap-3">
                <IconCircle>
                  <BarChart3 className="size-icon-lg text-green-600" />
                </IconCircle>
                <span>
                  <span className="block text-body font-medium text-gray-900">Mis estadísticas</span>
                  <span className="block text-caption text-gray-700">Vistas de tu perfil, pedidos, calificación y más</span>
                </span>
              </span>
              <ChevronRight aria-hidden className="size-icon-lg shrink-0 text-gray-700" />
            </button>

            <ProfileFields
              value={editForm}
              onChange={(patch) => setEditForm({ ...editForm, ...patch })}
              email={currentUser.email}
              nameError={showErrors ? nameError : ""}
              universityError={showErrors ? university.error : ""}
            />

            <section className="space-y-3">
              <h2 className="text-subheading font-semibold text-gray-900">Perfil profesional</h2>
              <div className="space-y-field-gap">
                <div>
                  <OutlinedControl htmlFor="profile-bio" label={<>Descripción <span className="font-normal text-gray-700">(opcional)</span></>}>
                    <Textarea
                      id="profile-bio"
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      placeholder="Cuéntanos sobre ti, tu experiencia y cómo puedes ayudar…"
                      className="resize-none"
                      rows={4}
                    />
                  </OutlinedControl>
                </div>
                {/* Las especialidades se eligen en su propia pagina (buscador + lista de materias); aqui solo se ve el resumen. */}
                <FieldLinkRow onClick={() => setLocation(ROUTES.tutorSpecialties)} data-testid="profile-specialties">
                  <span className="text-body font-medium text-gray-900">
                    Especialidades <span className="font-normal text-gray-700">(opcional)</span>
                  </span>
                  {(tutorProfile?.specialties ?? []).length > 0 ? (
                    <SpecialtyBadges specialties={tutorProfile?.specialties} max={4} />
                  ) : (
                    <span className="text-label text-gray-700">Elige las materias en las que ayudas</span>
                  )}
                </FieldLinkRow>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-subheading font-semibold text-gray-900">Preferencias</h2>
              <div className="space-y-2">
                {/* Siempre visible (web y app nativa): el permiso y los errores del canal se manejan al tocar el interruptor. */}
                <div className={prefRow}>
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
                <div className={prefRow}>
                  <div className="flex items-center gap-3">
                    <IconCircle>
                      <Volume2 className="size-icon-lg text-green-600" />
                    </IconCircle>
                    <div>
                      <p className="text-body font-medium text-gray-900">Sonido de notificaciones</p>
                      <p className="text-caption text-gray-700">Reproduce un sonido al recibir pagos</p>
                    </div>
                  </div>
                  <ToggleSwitch
                    aria-label="Sonido de notificaciones"
                    checked={soundEnabled}
                    onChange={() => {
                      const newValue = !soundEnabled;
                      setSoundEnabled(newValue);
                      localStorage.setItem('soundEnabled', newValue.toString());
                      toast({
                        title: newValue ? "Sonido activado" : "Sonido desactivado",
                        description: newValue ? "Escucharás un sonido cuando recibas pagos." : "No recibirás sonidos de notificación.",
                      });
                    }}
                  />
                </div>
              </div>
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
      </Container>

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
              className={photoRow}
            >
              <IconCircle>
                <Camera className="size-icon-lg text-green-600" />
              </IconCircle>
              <span className="text-body font-semibold">Cámara</span>
            </button>
            <button
              type="button"
              onClick={() => { galleryInputRef.current?.click(); setTimeout(() => setShowPhotoMenu(false), 300); }}
              className={photoRow}
            >
              <IconCircle>
                <ImagePlus className="size-icon-lg text-green-600" />
              </IconCircle>
              <span className="text-body font-semibold">Galería</span>
            </button>
          </div>
          <Button type="button" variant="ghost" onClick={() => setShowPhotoMenu(false)} className="w-full mt-2 text-gray-700">
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

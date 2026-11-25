import type { HTMLAttributes, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bookmark, Check, Star } from "lucide-react";
import { formatCompletedCount } from "@shared/completed-count";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Card } from "@/components/ui/card";
import { TutorChatButton } from "@/components/ui/tutor-chat-button";
import { RatingStars } from "@/components/ui/rating-stars";
import { cn } from "@/lib/utils";
import type { PublicTutor, TutorProfile, UserWithType } from "@shared/schema";
import { useWebSocketFixed } from "@/hooks/useWebSocketFixed";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { pluralizeEs } from "@/lib/pluralize";
import { fmtDate } from "@/lib/date-format";
import { EmptyState } from "@/components/ui/empty-state";
import { PresenceIndicator, PRESENCE_ON_AVATAR } from "@/components/ui/presence-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { SpecialtyBadges } from "@/components/ui/specialty-badges";
import { tutorTypography } from "@/components/ui/tutor-typography";

/** Tamaño de las estrellas del perfil (identidad y reseñas): una sola constante, cambiarla mueve las dos a la vez. */
const PROFILE_STARS = "lg" as const;

type ChatStarted = (result: { threadId?: string; userId: string; userName: string }) => void;

interface TutorProfileContentProps {
  /** Slug (/tutor/olga-perez) o id del tutor: el servidor resuelve ambos. */
  tutorKey: string;
  // Sin este callback (pagina standalone /tutor/:id): navega a /chat-fullscreen
  // con el hilo abierto. Con el (panel del Sheet en /tutors): el caller decide
  // adonde ir (p.ej. cerrar el panel y navegar a /messages).
  // threadId ausente = todavia no existe conversacion (no se crea hasta
  // el primer mensaje real, ver chatMutation) — el caller navega en modo
  // borrador (sin threadId en la URL).
  onChatStarted?: ChatStarted;
  /** Oculta "Enviar mensaje" (p. ej. dentro del propio chat). */
  showChatAction?: boolean;
  /** Sin el relleno propio de la hoja (`lg:p-4`): el contenido llena su columna y usa el margen de la pantalla que lo envuelve (`ListScreen`). */
  flush?: boolean;
}

// Perfil del tutor en tarjetas con borde (propuesta D del lienzo de diseno). Dos piezas que comparten la misma consulta:
//  - TutorProfileMain: identidad + datos, descripcion, especialidades, idioma y resenas (columna de 7/10).
// TutorProfileContent las apila en una columna (movil, panel del chat); en escritorio las reparten tutors-section y tutor-profile-page.

/** Consulta del perfil publico + resenas en una sola peticion (GET /api/tutors/:key). Con la lista ya cargada se pinta al instante (dato provisional, sin resenas). */
function useTutorProfile(tutorKey: string) {
  return useQuery<TutorProfile>({
    queryKey: ["/api/tutors", tutorKey],
    placeholderData: () =>
      queryClient.getQueryData<PublicTutor[]>(["/api/tutors"])?.find((t) => t.id === tutorKey || t.slug === tutorKey) as TutorProfile | undefined,
    retry: (count, err) => !String((err as Error)?.message).startsWith("404") && count < 1,
  });
}

/** Guardar en favoritos + abrir el chat del tutor. */
function useTutorActions(tutor: TutorProfile | undefined, onChatStarted?: ChatStarted) {
  const { toast } = useToast();

  const toggleFavorite = useMutation({
    mutationFn: async ({ tutorId, isFavorite }: { tutorId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        return apiRequest("DELETE", `/api/favorites/${tutorId}`);
      } else {
        return apiRequest("POST", "/api/favorites", { tutorId });
      }
    },
    onSuccess: (_, { isFavorite }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tutors"] });
      toast({
        title: isFavorite ? "Eliminado de favoritos" : "¡Guardado como favorito!",
        description: isFavorite ? "Tutor eliminado de tu lista de favoritos." : "Ahora puedes invitarlo fácilmente cuando publiques un pedido.",
        duration: 3000,
      });
    },
  });

  const chat = useMutation({
    mutationFn: async () => {
      if (!tutor) throw new Error("Tutor no encontrado");
      // tutorId = user_id del tutor, no el id del perfil (tutorId prop de este componente).
      const res = await apiRequest("POST", "/api/chat/get-or-create", { tutorId: tutor.user.id });
      return res.json() as Promise<{ threadId: string | null }>;
    },
    onSuccess: ({ threadId }) => {
      if (!tutor) return;
      onChatStarted?.({ threadId: threadId ?? undefined, userId: tutor.user.id, userName: tutor.user.name });
    },
    onError: () => {
      toast({ title: "No se pudo abrir el chat", variant: "destructive" });
    },
  });

  return { toggleFavorite, chat };
}

/** Tarjeta de una seccion del perfil: titulo + contenido, borde gris y esquinas de tarjeta. */
function ProfileCard({ title, titleAside, children, className, ...rest }: { title?: ReactNode; titleAside?: ReactNode; children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <Card className={cn("flex flex-col gap-3 p-bento-pad", className)} {...rest}>
      {title && (
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-subheading font-semibold text-gray-900">{title}</h3>
          {titleAside}
        </div>
      )}
      {children}
    </Card>
  );
}

/** Dato de la fila de la cabecera: valor y etiqueta. */
function Fact({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-body font-semibold text-gray-900">{value}</span>
      <span className="text-label font-normal text-gray-700">{label}</span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Cargando perfil" className="flex flex-col items-center gap-3 py-20">
      <Skeleton className="size-avatar-lg rounded-full" />
      <Skeleton className="h-skeleton-line w-skeleton-title-w" />
      <Skeleton className="h-skeleton-meta-h w-skeleton-meta-w" />
    </div>
  );
}

interface ActionsProps {
  tutor: TutorProfile;
  onChatStarted?: ChatStarted;
  showChatAction: boolean;
}

/** Guardar en favoritos + Chat. Van dentro de la tarjeta de identidad: a la derecha de los datos en escritorio, debajo en movil. */
function ProfileActions({ tutor, onChatStarted, showChatAction }: ActionsProps) {
  const { toggleFavorite, chat } = useTutorActions(tutor, onChatStarted);
  const save = (
    <Button
      variant="outline"
      className="min-w-fit flex-1 sm:flex-none"
      aria-pressed={!!tutor.isFavorite}
      onClick={() => toggleFavorite.mutate({ tutorId: tutor.id, isFavorite: tutor.isFavorite || false })}
      disabled={toggleFavorite.isPending}
    >
      <Bookmark className={cn("size-icon-md", tutor.isFavorite && "fill-primary-600 text-primary-600")} />
      {tutor.isFavorite ? "Guardado en favoritos" : "Guardar en favoritos"}
    </Button>
  );
  const chatButton = showChatAction && (
    <TutorChatButton className="flex-1 sm:flex-none" onClick={() => chat.mutate()} isLoading={chat.isPending} />
  );

  return (
    <div className="flex flex-wrap gap-2">
      {save}
      {chatButton}
    </div>
  );
}

interface MainProps {
  tutorKey: string;
  onChatStarted?: ChatStarted;
  showChatAction?: boolean;
}

export function TutorProfileMain({ tutorKey, onChatStarted, showChatAction = true }: MainProps) {
  const { data: tutor, isLoading, isError, error, isPlaceholderData, refetch } = useTutorProfile(tutorKey);
  const { data: currentUser } = useQuery<UserWithType>({ queryKey: ["/api/user/current"] });
  const { onlineUsers } = useWebSocketFixed(currentUser?.id);
  const isOnline = tutor ? onlineUsers.has(tutor.user.id) : false;
  const reviews = tutor?.reviews ?? [];

  if (isLoading) return <ProfileSkeleton />;

  if (isError && !String((error as Error)?.message).startsWith("404")) {
    return (
      <EmptyState
        centered
        title="No pudimos cargar el perfil"
        description="Revisa tu conexión e inténtalo de nuevo."
        action={<Button onClick={() => refetch()}>Reintentar</Button>}
      />
    );
  }

  if (!tutor) return <EmptyState className="py-20" title="Tutor no encontrado" />;

  const rating = Number(tutor.rating);
  const completed = tutor.completedTasksCount || 0;

  return (
    <div className="flex flex-col gap-4">
      <ProfileCard className="gap-5" aria-label="Identidad">
        <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap sm:gap-5">
          <div className="relative shrink-0">
            <UserAvatar name={tutor.user.name} avatar={tutor.user.avatar} size="xl" />
            {isOnline && <PresenceIndicator userId={tutor.user.id} isOnline className={PRESENCE_ON_AVATAR} />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* text-subheading: la pagina ya tiene su titulo (text-heading), el nombre del tutor es un titulo de seccion. */}
            <h2 className="flex items-center gap-2 text-subheading font-semibold text-gray-900">
              {tutor.isVerified && <VerifiedBadge />}
              <span className="min-w-0">{tutor.user.name}</span>
            </h2>
            <p className={tutorTypography.profession}>{tutor.profession || "Tutor"}</p>
            <PresenceIndicator userId={tutor.user.id} showLabel hideDot size="sm" isOnline={isOnline} lastSeen={tutor.user.lastSeen} className="justify-start" />
          </div>
          {/* Calificacion: estrellas y debajo "5.0 (1 reseña)" en una sola linea. Movil: baja a su propia fila para que el nombre no se parta en dos lineas. */}
          <div className="flex w-full shrink-0 flex-row flex-wrap items-center gap-x-3 gap-y-1 sm:w-auto sm:flex-col sm:items-end sm:gap-1">
            {rating > 0 ? (
              <>
                <RatingStars value={rating} size={PROFILE_STARS} />
                <span className="text-label text-gray-700">
                  <span className="font-semibold text-gray-900">{rating.toFixed(1)}</span>
                  {!isPlaceholderData && <> ({reviews.length} {pluralizeEs(reviews.length, "reseña")})</>}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-icon-md text-gray-700" />
                <span className="text-label text-gray-700">Sin calificación</span>
              </span>
            )}
          </div>
        </div>

        {tutor.isVerified && (
          <Badge variant="outline" className="w-fit gap-1.5 border-primary-600 text-primary-600">
            <Check className="size-icon-md" />
            Tutor verificado por Mil Tareas
          </Badge>
        )}

        {/* Datos a la izquierda y acciones a la derecha (escritorio); en movil las acciones bajan a su propia fila. */}
        <div className="flex flex-col gap-5 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-10">
            <Fact value={formatCompletedCount(completed)} label={pluralizeEs(completed, "Pedido completado", "Pedidos completados")} />
          </div>
          <ProfileActions tutor={tutor} onChatStarted={onChatStarted} showChatAction={showChatAction} />
        </div>
      </ProfileCard>

      {tutor.bio && (
        <ProfileCard title="Sobre mí">
          <p className={tutorTypography.bio}>{tutor.bio}</p>
        </ProfileCard>
      )}

      {(tutor.specialties || []).length > 0 && (
        <ProfileCard title="Especialidades">
          <SpecialtyBadges specialties={tutor.specialties} />
        </ProfileCard>
      )}

      {tutor.language && (
        <ProfileCard title="Idiomas" data-testid="tutor-language">
          <p className="text-body text-gray-900">
            <span className="font-semibold">{tutor.language}</span> <span className="text-gray-700">(nativo)</span>
          </p>
        </ProfileCard>
      )}

      <ProfileCard
        title={`Reseñas${isPlaceholderData ? "" : ` (${reviews.length})`}`}
        titleAside={!isPlaceholderData && reviews.length > 0 && rating > 0 ? (
          <span className="text-label text-gray-700">Calificación general: <span className="font-semibold text-gray-900">{rating.toFixed(1)}/5</span></span>
        ) : undefined}
      >
        {isPlaceholderData ? (
          <Skeleton className="h-skeleton-meta-h w-skeleton-title-w" />
        ) : reviews.length === 0 ? (
          <EmptyState title="Aún no hay reseñas" description="Sé el primero en dejar una reseña" />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {reviews.map((review) => (
              <article key={review.id} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-body font-semibold text-gray-900">{review.student?.name || "Cliente"}</span>
                    <span className="inline-flex items-center gap-2">
                      <RatingStars value={Number(review.rating)} size={PROFILE_STARS} />
                      <span className="text-label font-semibold text-gray-900">{Number(review.rating)}/5</span>
                    </span>
                  </div>
                  {review.publishedAt && <time className="text-label text-gray-700" dateTime={new Date(review.publishedAt).toISOString()}>{fmtDate(review.publishedAt)}</time>}
                </div>
                {review.comment && <p className="text-body text-gray-700">{review.comment}</p>}
              </article>
            ))}
          </div>
        )}
        {!isPlaceholderData && reviews.length > 0 && (
          <p className="text-label text-gray-700">Las reseñas las escriben alumnos que contrataron a este tutor.</p>
        )}
      </ProfileCard>
    </div>
  );
}

/** Perfil en una sola columna de tarjetas: identidad con sus acciones y, debajo, descripcion, especialidades, idioma y reseñas. */
export function TutorProfileContent({ tutorKey, onChatStarted, showChatAction = true, flush = false }: TutorProfileContentProps) {
  return (
    <div className={cn("flex flex-col gap-4", !flush && "lg:p-4")}>
      <TutorProfileMain tutorKey={tutorKey} onChatStarted={onChatStarted} showChatAction={showChatAction} />
    </div>
  );
}

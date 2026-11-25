import { useQuery } from "@tanstack/react-query";
import { ROUTES, tutorRoute } from "@/lib/routes";
import { useLocation } from "wouter";
import { TutorChatButton } from "@/components/ui/tutor-chat-button";
import { RatingStars, formatRating } from "@/components/ui/rating-stars";
import { SectionLink } from "@/components/ui/section-link";
import { TutorIdentity } from "@/components/ui/tutor-identity";
import type { PublicTutor } from "@shared/schema";

const MAX_FEATURED = 3;

/**
 * Columna derecha de Inicio (estudiante): hasta 3 tutores. Primero los mejor calificados, luego los verificados y los
 * de mas trabajos completados; los que aun no tienen resenas entran igual, sin estrella (la app esta
 * empezando y casi nadie tiene calificacion). Reutiliza la consulta de /tutors.
 */
export function FeaturedTutors() {
  const [, setLocation] = useLocation();
  const { data: tutors } = useQuery<PublicTutor[]>({ queryKey: ["/api/tutors"] });

  const featured = [...(tutors ?? [])]
    // /api/tutors no filtra por estado: aqui solo cuentan tutores con cuenta activa.
    .filter((t) => t.user?.status === "active")
    .sort(
      (a, b) =>
        Number(b.rating) - Number(a.rating) ||
        Number(!!b.isVerified) - Number(!!a.isVerified) ||
        ((b as any).completedTasksCount || 0) - ((a as any).completedTasksCount || 0),
    )
    .slice(0, MAX_FEATURED);

  if (featured.length === 0) return null;

  return (
    <div>
      {/* Estilo X ("A quien seguir"): un solo recuadro con borde; las filas van dentro, sin tarjeta propia. */}
      <section className="rounded-lg border border-border bg-white p-card-pad" data-testid="featured-tutors">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-subheading font-semibold text-gray-900">Tutores destacados</h2>
          <SectionLink onClick={() => setLocation(ROUTES.tutors)} data-testid="featured-tutors-all">Ver todos</SectionLink>
        </div>
        <ul className="flex flex-col">
          {featured.map((tutor) => (
            <li key={tutor.id} className="flex items-center gap-3 py-3">
              <button
                type="button"
                onClick={() => setLocation(tutorRoute(tutor))}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid={`featured-tutor-${tutor.id}`}
              >
                <TutorIdentity
                  name={tutor.user.name}
                  avatar={tutor.user.avatar}
                  profession={tutor.profession}
                  beforeProfession={Number(tutor.rating) > 0 && (
                    <RatingStars compact className="shrink-0" value={Number(tutor.rating)} size="sm" label={<span className="text-caption font-semibold text-primary-600">{formatRating(Number(tutor.rating))}</span>} />
                  )}
                />

              </button>
              <TutorChatButton
                className="shrink-0"
                onClick={() => setLocation(`${ROUTES.messages}?userId=${tutor.user_id}&userName=${encodeURIComponent(tutor.user.name)}`)}
                data-testid={`featured-tutor-chat-${tutor.id}`}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

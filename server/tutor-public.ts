import type { PublicReview, PublicTutor, ReviewWithStudent, TutorWithUser } from "@shared/schema";
import { getStudentAlias } from "./student-alias";

// Proyecciones PUBLICAS de tutores y resenas. Toda respuesta de /api/tutors* pasa por aqui: se arma campo a campo
// (lista blanca), nunca con spread del usuario, para que una columna nueva en `users` no se filtre por accidente.

/** Tutor para listas y perfil. `extra` = isFavorite / completedTasksCount calculados por el endpoint. */
export function toPublicTutor(t: TutorWithUser, extra: Pick<PublicTutor, "isFavorite" | "completedTasksCount"> = {}): PublicTutor {
  return {
    id: t.id,
    slug: t.slug ?? null,
    user_id: t.user_id,
    profession: t.profession ?? null,
    specialties: t.specialties ?? null,
    bio: t.bio ?? null,
    language: t.language ?? null,
    rating: t.rating ?? null,
    isVerified: t.isVerified ?? null,
    user: t.user && { id: t.user.id, name: t.user.name, avatar: t.user.avatar ?? null, lastSeen: t.user.lastSeen ?? null, status: t.user.status ?? null },
    ...extra,
  };
}

/** Resena publicada: nota, comentario y alias del cliente ("Cliente 31215"). Sin su nombre real, foto, correo, WhatsApp ni el pedido. */
export function toPublicReview(r: ReviewWithStudent): PublicReview {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment ?? null,
    publishedAt: r.publishedAt ?? null,
    student: { name: getStudentAlias(r.studentId), avatar: null },
  };
}

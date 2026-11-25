import { queryClient } from "@/lib/queryClient";

// Unico origen de los `import()` de las secciones de home.tsx. `lazy()` y la precarga llaman a
// la MISMA funcion, asi el navegador reutiliza el modulo ya descargado (sin doble descarga ni spinner).
export const sectionLoaders = {
  publish: () => import("@/components/sections/publish-section"),
  tutors: () => import("@/components/sections/tutors-section"),
  profile: () => import("@/components/sections/profile-section"),
  changePassword: () => import("@/pages/change-password"),
  account: () => import("@/components/sections/account-section"),
  messages: () => import("@/components/sections/messages-section"),
  messagesSplit: () => import("@/components/sections/messages-desktop-split"),
  tutorProfile: () => import("@/components/sections/tutor-profile-simple"),
  tutorStats: () => import("@/components/sections/tutor-stats-section"),
  tutorSpecialties: () => import("@/components/sections/tutor-specialties-section"),
  university: () => import("@/components/sections/university-picker-section"),
  tutorWork: () => import("@/components/sections/tutor-work-section"),
  orders: () => import("@/components/sections/orders-section"),
};

// Pestana del menu -> chunks (y datos) que necesita. Las pestanas sin entrada (inicio) no cargan chunk propio.
const TAB_PREFETCH: Record<string, { chunks: Array<() => Promise<unknown>>; queries?: string[] }> = {
  mensajes: { chunks: [sectionLoaders.messages, sectionLoaders.messagesSplit] },
  pedidos: { chunks: [sectionLoaders.orders, sectionLoaders.tutorWork] },
  trabajos: { chunks: [sectionLoaders.tutorWork] },
  publicar: { chunks: [sectionLoaders.publish], queries: ["/api/my-tutors"] },
  tutores: { chunks: [sectionLoaders.tutors], queries: ["/api/tutors", "/api/my-tutors"] },
  perfil: { chunks: [sectionLoaders.profile, sectionLoaders.tutorProfile] },
};

/** Precarga chunk y datos de una pestana (hover/foco/toque). Idempotente; los errores se ignoran. */
export function prefetchSection(tab: string, isTutor = false) {
  const entry = TAB_PREFETCH[tab];
  if (!entry) return;
  entry.chunks.forEach((load) => load().catch(() => {}));
  // /api/my-tutors es solo de alumnos: a un tutor le devolveria error.
  if (!isTutor) entry.queries?.forEach((key) => queryClient.prefetchQuery({ queryKey: [key] }).catch(() => {}));
}

/** Precarga ociosa de todas las pestanas tras montar Home. Respeta "ahorro de datos". */
export function prefetchAllSections() {
  if ((navigator as any).connection?.saveData) return;
  const run = () => Object.values(TAB_PREFETCH).forEach((e) => e.chunks.forEach((l) => l().catch(() => {})));
  if ("requestIdleCallback" in window) (window as any).requestIdleCallback(run, { timeout: 3000 });
  else setTimeout(run, 1500);
}

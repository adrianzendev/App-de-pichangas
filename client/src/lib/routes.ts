// Fuente unica de las rutas de la app (en ingles). La UI sigue en espanol: las etiquetas viven en cada pestana.
//
// El id de pestana de `home.tsx` / `BottomNavigation` es el primer segmento de la URL, asi que TAB y ROUTES van juntos.
// Las rutas en espanol (LEGACY_ROUTES) siguen vivas como redirecciones permanentes: correos, notificaciones push
// y atajos de la PWA ya emitidos las contienen. No borrarlas.
//
// NO renombrar `/auth/callback`, `/reset-password` ni `/forgot-password`: Supabase (OAuth y recuperacion de
// contrasena) tiene esas URLs en su lista de redirecciones permitidas.

/** Pestanas del shell de `home.tsx` (= primer segmento de la URL). */
export const TAB = {
  home: "home",
  orders: "orders",
  jobs: "jobs",
  publish: "publish",
  tutors: "tutors",
  messages: "messages",
  profile: "profile",
  studentProfile: "student-profile",
  tutorProfile: "tutor-profile",
  tutorStats: "tutor-stats",
  tutorSpecialties: "tutor-specialties",
  university: "university",
  changePassword: "change-password",
  account: "account",
} as const;

export type Tab = (typeof TAB)[keyof typeof TAB];

export const VALID_TABS: readonly string[] = Object.values(TAB);

export const ROUTES = {
  /** Inicio (alumno) / entrada de la app; el tutor es enviado a `jobs`. */
  root: "/",
  home: `/${TAB.home}`,
  orders: `/${TAB.orders}`,
  jobs: `/${TAB.jobs}`,
  publish: `/${TAB.publish}`,
  tutors: `/${TAB.tutors}`,
  messages: `/${TAB.messages}`,
  profile: `/${TAB.profile}`,
  studentProfile: `/${TAB.studentProfile}`,
  tutorProfile: `/${TAB.tutorProfile}`,
  tutorStats: `/${TAB.tutorStats}`,
  tutorSpecialties: `/${TAB.tutorSpecialties}`,
  university: `/${TAB.university}`,
  changePassword: `/${TAB.changePassword}`,
  account: `/${TAB.account}`,
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  chatFullscreen: "/chat-fullscreen",
  // Paginas publicas (las tiendas exigen una URL): politica de privacidad, terminos y como eliminar la cuenta.
  privacy: "/privacy",
  terms: "/terms",
  deleteAccount: "/delete-account",
  /** Enlace de un solo uso del correo para definir la contrasena (cuenta nueva o restablecer). */
  activateAccount: "/activate-account",
} as const;

/** Un partido para armar su URL: con titulo sale legible (`/play/loza-wanchaq-tarde-b09bc189`); solo con el id, `/play/b09bc189`. */
export type MatchRef = string | { id: string; title: string };
/** Segmentos de /play que no son partidos. */
export const PLAY_RESERVED = ["mine", "profile"] as const;
export function matchSlug(m: MatchRef): string {
  const id = (typeof m === "string" ? m : m.id).slice(0, 8);
  if (typeof m === "string") return id;
  const words = m.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/g, "");
  return words ? `${words}-${id}` : id;
}
/** Id corto (8 caracteres) de un segmento `slug-id8`; si no tiene ese formato se devuelve igual (id completo o solo id8). */
export const matchIdFromParam = (param: string) => /-([0-9a-f]{8})$/.exec(param)?.[1] ?? param;

/** Pichangas: perfil del jugador que busca partidos. `/` y `/play` abren el feed. */
export const PLAY_ROUTES = {
  feed: "/play",
  mine: "/play/mine",
  profile: "/play/profile",
  match: (m: MatchRef) => `/play/${matchSlug(m)}`,
  /** Pase digital + chat del equipo: la pantalla que se abre despues de anotarse. */
  pass: (m: MatchRef) => `/play/${matchSlug(m)}/pass`,
  /** Confirmar y pagar: paso final antes del pase (pago simulado por ahora). */
  pay: (m: MatchRef) => `/play/${matchSlug(m)}/pay`,
} as const;
export const PLAY_PATTERNS = {
  match: "/play/:id",
  pass: "/play/:id/pass",
  pay: "/play/:id/pay",
} as const;

/** Pichangas: panel del administrador. */
export const ADMIN_ROUTES = {
  overview: "/panel",
  matches: "/panel/matches",
  venues: "/panel/venues",
  players: "/panel/players",
  rules: "/panel/rules",
} as const;

/** Rutas de autenticacion: NO renombrar (estan en la lista de Redirect URLs de Supabase). */
export const AUTH_ROUTES = {
  callback: "/auth/callback",
  resetPassword: "/reset-password",
  forgotPassword: "/forgot-password",
} as const;

/** Rutas con el id de un pedido: `/home/:taskId`, `/orders/:taskId`. */
export const taskRoute = {
  home: (taskId: string) => `${ROUTES.home}/${taskId}`,
  orders: (taskId: string) => `${ROUTES.orders}/${taskId}`,
};

/** Patrones de ruta con parametro, para `<Route path>` y `useRoute`. */
export const ROUTE_PATTERNS = {
  homeTask: `${ROUTES.home}/:taskId`,
  ordersTask: `${ROUTES.orders}/:taskId`,
  /** Perfil del tutor: `:key` es el slug ("olga-perez") o, en enlaces antiguos, el id. */
  tutor: "/tutor/:key",
} as const;

/** Ruta del perfil de un tutor: /tutor/olga-perez; si aun no tiene slug, /tutor/<id> (el servidor resuelve ambos). */
export const tutorRoute = (tutor: { id: string; slug?: string | null }): string => `/tutor/${tutor.slug ?? tutor.id}`;

/** Ruta antigua (espanol) -> ruta nueva. Conservan `:taskId`, la query y el hash al redirigir. */
export const LEGACY_ROUTES: Readonly<Record<string, string>> = {
  "/inicio": ROUTES.home,
  "/inicio/:taskId": ROUTE_PATTERNS.homeTask,
  "/pedidos": ROUTES.orders,
  "/pedidos/:taskId": ROUTE_PATTERNS.ordersTask,
  "/trabajos": ROUTES.jobs,
  "/publicar": ROUTES.publish,
  "/tutores": ROUTES.tutors,
  "/mensajes": ROUTES.messages,
  "/chats": ROUTES.messages,
  "/perfil": ROUTES.profile,
  "/perfil-estudiante": ROUTES.studentProfile,
  "/perfil-tutor": ROUTES.tutorProfile,
  "/cambiar-contrasena": ROUTES.changePassword,
  "/cuenta": ROUTES.account,
  // Pichangas: formatos anteriores de la URL de un partido (/play/match/<uuid>, /play/m/<uuid>).
  "/play/match/:id": PLAY_PATTERNS.match,
  "/play/match/:id/pass": PLAY_PATTERNS.pass,
  "/play/match/:id/pay": PLAY_PATTERNS.pay,
  "/play/m/:id": PLAY_PATTERNS.match,
  "/play/m/:id/pass": PLAY_PATTERNS.pass,
  "/play/m/:id/pay": PLAY_PATTERNS.pay,
  "/agente": ROUTES.dashboard,
};

/** Valores antiguos del parametro `?from=` del chat a pantalla completa -> pestana actual. */
export function normalizeFromSection(value: string | null): Tab {
  const legacy: Record<string, Tab> = { inicio: TAB.home, pedidos: TAB.orders, mensajes: TAB.messages };
  if (!value) return TAB.home;
  return (legacy[value] ?? (VALID_TABS.includes(value) ? value : TAB.home)) as Tab;
}

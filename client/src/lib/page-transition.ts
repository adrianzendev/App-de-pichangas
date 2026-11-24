import { flushSync } from "react-dom";
import type { RouterProps } from "wouter";
import { MQ } from "@/lib/breakpoints";
import { ROUTES } from "@/lib/routes";

// Deslizamiento entre pantallas con la View Transitions API, enganchado a `aroundNav` del Router de wouter
// (App.tsx): cada `setLocation` / `<Link>` de la app pasa por aqui, sin tocar los sitios que navegan.
//   - pestana <-> pestana: sin View Transition (fundido por CSS: `.page-fade-in` en home.tsx).
//   - pestana -> pantalla profunda (detalle de pedido, chat, perfil de tutor, Publicar...): entra desde la derecha.
//   - pantalla profunda -> pestana: sale hacia la derecha. Profunda -> profunda: entra desde la derecha.
// Solo bajo `lg` (movil y tablet vertical). Sin soporte de la API, con `replace` o con movimiento reducido, navega
// sin animar. El CSS de las animaciones vive en index.css ("Transiciones de pantalla").
// Limite: el boton Atras del sistema y `history.back()` (popstate) no pasan por `navigate`, asi que no animan.

type NavKind = "forward" | "back";
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<unknown> };
};

// Raices de las pestanas del shell (`home.tsx`).
const TAB_ROOTS: ReadonlySet<string> = new Set([
  ROUTES.root, ROUTES.home, ROUTES.orders, ROUTES.jobs, ROUTES.tutors, ROUTES.messages,
]);
// Pantallas profundas del shell: se abren "encima" de una pestana.
const DEEP_ROUTES: readonly string[] = [
  ROUTES.chatFullscreen, ROUTES.publish, ROUTES.account, ROUTES.profile,
  ROUTES.studentProfile, ROUTES.tutorProfile, ROUTES.changePassword,
];
const DEEP_PREFIXES = [`${ROUTES.orders}/`, `${ROUTES.home}/`, "/tutor/"];

const pathOf = (url: string): string => url.split(/[?#]/)[0] || ROUTES.root;
const isDeep = (path: string): boolean => DEEP_ROUTES.includes(path) || DEEP_PREFIXES.some((p) => path.startsWith(p));
const isAppScreen = (path: string): boolean => TAB_ROOTS.has(path) || isDeep(path);

function navKind(from: string, to: string): NavKind | null {
  if (from === to || !isAppScreen(from) || !isAppScreen(to)) return null;
  const fromTab = TAB_ROOTS.has(from);
  const toTab = TAB_ROOTS.has(to);
  if (fromTab && toTab) return null;
  return toTab ? "back" : "forward";
}

let current = 0; // transicion en curso: solo la ultima limpia `data-nav`

export const aroundNav: NonNullable<RouterProps["aroundNav"]> = (navigate, to, options) => {
  const doc = document as ViewTransitionDocument;
  const kind = options?.replace ? null : navKind(window.location.pathname, pathOf(to));
  if (
    !kind ||
    !doc.startViewTransition ||
    window.matchMedia(MQ.lg).matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    navigate(to, options);
    return;
  }
  const root = doc.documentElement;
  const id = ++current;
  root.dataset.nav = kind;
  const transition = doc.startViewTransition(() => flushSync(() => navigate(to, options)));
  transition.finished.catch(() => {}).then(() => {
    if (id === current) delete root.dataset.nav;
  });
};

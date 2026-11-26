import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarPlus, LogOut, MessageSquare, Search, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAY_ROUTES } from "@/lib/routes";
import { logout } from "@/lib/logout";
import { NightIconButton, NightNavButton } from "@/components/pichangas/night-controls";
import { UserAvatar } from "@/components/ui/user-avatar";
import { BrandLogo } from "@/components/brand-logo";
import { ProfileMenuButton } from "@/components/layout/profile-menu-button";
import type { AccountAction } from "@/components/account/use-account-actions";

/** Cerrar sesion: el unico cierre de sesion de la app es lib/logout (limpia cache y sesion del dispositivo). */
export const LOGOUT_ACTION: AccountAction = {
  id: "logout", label: "Cerrar sesión", icon: LogOut, onSelect: () => void logout(), testId: "menu-logout", danger: true,
};

export interface ShellItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

/** Solo se muestra a quien activo el perfil de host. */
export const HOST_NAV: ShellItem = { id: "host", label: "Organizar", icon: CalendarPlus, path: PLAY_ROUTES.host };

export const PLAYER_NAV: ShellItem[] = [
  { id: "feed", label: "Explorar", icon: Search, path: PLAY_ROUTES.feed },
  { id: "mine", label: "Mis pichangas", icon: CalendarCheck, path: PLAY_ROUTES.mine },
  { id: "chats", label: "Chats", icon: MessageSquare, path: PLAY_ROUTES.chats },
];

interface PlayerShellProps {
  active: string;
  /** Opciones del menu (por defecto, las del jugador). El perfil admin pasa las suyas. */
  items?: ShellItem[];
  /** Rotulo bajo el logo (p. ej. "Administración"). El nombre de la app ya va dentro del logo. */
  brand?: string;
  /** Acciones del menu de cuenta (abajo del menu lateral). Por defecto: Mi perfil y Cerrar sesion. */
  accountActions?: AccountAction[];
  /** Control junto al avatar en la cabecera movil (p. ej. el selector de ciudad del feed). */
  headerAction?: ReactNode;
  /** Oculta la cabecera y la barra inferior movil (pantalla de detalle): la accion principal ocupa su lugar. */
  hideMobileBar?: boolean;
  children: ReactNode;
}

// Armazon del jugador, tema "Pichanga Black": fondo azul noche, Satoshi, verde electrico solo para lo activo.
// Misma cuadricula que el shell de home.tsx (CLAUDE.md "Shell de escritorio"): 12 columnas, gap-6, tope `max-w-shell`.
export function PlayerShell({ active, items: itemsProp = PLAYER_NAV, brand, accountActions, headerAction, hideMobileBar, children }: PlayerShellProps) {
  const [, setLocation] = useLocation();
  // El menu del jugador suma "Organizar" cuando tiene el perfil de host (el menu del admin no cambia).
  const { data: playerProfile } = useQuery<{ isHost: boolean }>({ queryKey: ["/api/player/profile"], enabled: itemsProp === PLAYER_NAV });
  const items = itemsProp === PLAYER_NAV && playerProfile?.isHost ? [...PLAYER_NAV, HOST_NAV] : itemsProp;
  const { data: me } = useQuery<{ name: string; avatar?: string | null } | null>({ queryKey: ["/api/user/current"] });
  const actions: AccountAction[] = accountActions ?? [
    { id: "profile", label: "Mi perfil", icon: User, onSelect: () => setLocation(PLAY_ROUTES.profile), testId: "menu-profile" },
    LOGOUT_ACTION,
  ];

  return (
    <div className="min-h-dvh bg-night font-satoshi text-night-text">
      <div className="shell-grid min-h-dvh lg:mx-auto lg:grid lg:w-full lg:max-w-shell lg:grid-cols-12 lg:gap-6 lg:px-6">
        <aside className="hidden flex-col gap-1 p-4 lg:sticky lg:top-0 lg:col-span-2 lg:flex lg:h-dvh" aria-label="Menú principal">
          <div className="px-4 pb-4 pt-2">
            <Link href={PLAY_ROUTES.feed} aria-label="Ir al inicio" className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch">
              <BrandLogo size="md" />
            </Link>
            {brand && <p className="mt-1 text-label font-semibold text-night-muted">{brand}</p>}
          </div>
          <nav className="flex flex-col gap-1">
            {items.map((item) => {
              const on = item.id === active;
              return (
                <NightNavButton key={item.id} variant="side" active={on} icon={item.icon} label={item.label} onClick={() => setLocation(item.path)} />
              );
            })}
          </nav>
          {/* Cuenta: avatar + nombre abajo del menu; el popover abre hacia arriba. */}
          <div className="mt-auto space-y-1 pb-2">
            {accountActions ? (
              <ProfileMenuButton align="left" placement="above" actions={actions} nameClassName="text-night-text" />
            ) : (
              // Jugador: el nombre de abajo y "Perfil" del menu abren la misma pantalla (ProfileView), no dos cosas distintas.
              <NightNavButton variant="profile" active={active === "profile"} aria-label="Mi perfil" onClick={() => setLocation(PLAY_ROUTES.profile)}>
                <UserAvatar name={me?.name ?? "Usuario"} avatar={me?.avatar ?? undefined} size="sm" />
                <span className="min-w-0 truncate">{me?.name ?? "Usuario"}</span>
              </NightNavButton>
            )}
          </div>
        </aside>

        <main className={cn("min-w-0 lg:col-span-10 lg:px-4", !hideMobileBar && "pb-bottom-nav lg:pb-0")}>
          {!hideMobileBar && (
            <header className="sticky top-0 z-sticky flex h-16 items-center justify-between bg-night/90 px-page-h shadow-night-bar lg:hidden">
              <Link href={PLAY_ROUTES.feed} aria-label="Ir al inicio" className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch">
              <BrandLogo size="sm" />
            </Link>
              <div className="flex items-center gap-2">
                {headerAction}
                <NightIconButton tone="ghost" aria-label="Mi perfil" onClick={() => setLocation(PLAY_ROUTES.profile)}>
                  <UserAvatar name={me?.name ?? "Usuario"} avatar={me?.avatar ?? undefined} size="sm" />
                </NightIconButton>
              </div>
            </header>
          )}
          {children}
        </main>
      </div>

      {!hideMobileBar && (
        <nav
          aria-label="Menú principal"
          className="fixed inset-x-0 bottom-0 z-sticky flex h-bottom-nav bg-night-lowest/90 shadow-night-nav lg:hidden"
        >
          {items.map((item) => {
            const on = item.id === active;
            return (
              <NightNavButton key={item.id} variant="bottom" active={on} icon={item.icon} label={item.label} onClick={() => setLocation(item.path)} />
            );
          })}
        </nav>
      )}
    </div>
  );
}

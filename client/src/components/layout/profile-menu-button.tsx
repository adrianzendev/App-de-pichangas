import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { useLocation } from "wouter";
import { UserAvatar, type AvatarSize } from "@/components/ui/user-avatar";
import { UserProfileSelector } from "@/components/ui/user-profile-selector";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MQ } from "@/lib/breakpoints";
import { cn } from "@/lib/utils";
import { useAccountActions, type AccountAction } from "@/components/account/use-account-actions";

// Trigger de la cuenta: SOLO el avatar (estilo WhatsApp). Un solo montaje por tamaño de pantalla (useMediaQuery):
//  - movil/tablet (<lg): el avatar abre la pantalla /account (AccountSection).
//  - escritorio (>=lg): el avatar abre un popover blanco con las mismas acciones (use-account-actions).
interface ProfileMenuButtonProps {
  className?: string;
  align?: "left" | "right";
  /** Con align="left": el popover abre hacia arriba (avatar abajo del sidebar) o hacia abajo (avatar arriba). */
  placement?: "above" | "below";
  /** Reemplaza las acciones por defecto (Admin). Con acciones propias siempre abre el popover, tambien en movil. */
  actions?: AccountAction[];
  /** Nombre junto al avatar en escritorio. Por defecto solo con align="left" (sidebar). */
  showName?: boolean;
  /** Tamano del avatar en escritorio (cabecera: "md"); por defecto el del sidebar. */
  avatarSize?: AvatarSize;
  /** Con align="left": el trigger es una pildora que se ajusta al contenido, como las filas de `SidebarNav pill`. */
  pill?: boolean;
}

export function ProfileMenuButton({ className = "", align = "right", placement = "above", actions: customActions, showName, avatarSize, pill }: ProfileMenuButtonProps) {
  const isDesktop = useMediaQuery(MQ.lg);
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, displayName, roleLabel, actions: defaultActions } = useAccountActions();
  const actions = customActions ?? defaultActions;

  // Escape cierra el popover (teclado).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isDesktop && !customActions) {
    return (
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setLocation(ROUTES.account)}
          aria-label={displayName}
          data-testid="header-profile"
          className="flex items-center rounded-full p-1 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UserAvatar name={user?.name || "Usuario"} avatar={user?.avatar || undefined} size="sm" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <UserProfileSelector
        name={displayName}
        avatar={user?.avatar}
        showName={showName ?? align === "left"}
        avatarSize={avatarSize}
        className={align === "left" ? (pill ? "w-fit max-w-full rounded-full py-3 pl-3 pr-6 hover:bg-gray-50" : "w-full") : undefined}
        isOpen={open}
        onClick={() => setOpen(!open)}
        data-testid="header-profile"
      />

      {open && (
        <>
          {/* Capa transparente: clic fuera cierra el menu */}
          <div className="fixed inset-0 z-dropdown" aria-hidden onClick={() => setOpen(false)} />
          {/* En el sidebar (align="left") abre hacia arriba desde el avatar; en el header (align="right") hacia abajo. Unica capa con sombra (shadow-float). */}
          <div
            role="menu"
            aria-label="Cuenta"
            className={cn(
              "absolute z-toast rounded-card border border-border bg-white p-2 shadow-float",
              align === "left" ? (placement === "above" ? "bottom-full left-0 right-0 mb-2" : "top-full left-0 right-0 mt-2") : "right-0 top-full mt-2 w-popover-menu"
            )}
          >
            <div className="flex items-center gap-3 px-3 pb-4 pt-3">
              <UserAvatar name={user?.name || "Usuario"} avatar={user?.avatar || undefined} size="mdl" />
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-gray-900">{displayName}</p>
                <p className="text-caption text-gray-700">{roleLabel}</p>
              </div>
            </div>
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); a.onSelect(); }}
                data-testid={a.testId}
                className={cn(
                  "flex h-menu-row w-full items-center gap-3 rounded-md px-3 text-left text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  a.danger ? "mt-2 text-error-fg hover:bg-error-bg hover:text-error-strong" : "text-gray-900 hover:bg-gray-50"
                )}
              >
                <a.icon className="size-icon-lg shrink-0" aria-hidden />
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

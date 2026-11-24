import { Menu, Bell, BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPichangas from "@/assets/logo-pichangas.png";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ProfileMenuButton } from "@/components/layout/profile-menu-button";
import type { User as UserType } from "@shared/schema";
import { Spinner } from "@/components/ui/spinner";

interface HeaderProps {
  // Header unico para toda la app: 'user' (alumno/tutor, default) conserva
  // el comportamiento de siempre (logo -> "/", ProfileMenuButton).
  // 'admin' reemplaza el <div> maquetado a mano que vivia en
  // admin-dashboard.tsx (mismo px-page-h/altura/borde que 'user', logo a
  // "/dashboard", acciones de admin a la derecha).
  role?: "admin" | "user";
  onOpenMobileMenu?: () => void;
  pushSupported?: boolean;
  pushLoading?: boolean;
  pushSubscribed?: boolean;
  onTogglePush?: () => void;
  isAdmin?: boolean;
  pendingAlertsCount?: number;
  onAlertsClick?: () => void;
}

export default function Header({
  role = "user",
  onOpenMobileMenu,
  pushSupported,
  pushLoading,
  pushSubscribed,
  onTogglePush,
  isAdmin,
  pendingAlertsCount = 0,
  onAlertsClick,
}: HeaderProps) {
  const isAdminRole = role === "admin";
  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/user/current"],
  });

  return (
    <>
      <header
        className={`bg-white px-page-h py-3 lg:hidden ${
          isAdminRole ? "fixed top-0 left-0 right-0 z-sticky border-b border-gray-100" : ""
        }`}
      >
        <div aria-hidden className="h-safe-top" />
        <div className="mx-auto flex items-center justify-between max-w-container">
          <Link href={isAdminRole ? "/dashboard" : "/"} className="cursor-pointer">
            <img src={logoPichangas} alt="Pichangas Perú" width={58} height={40} className="w-auto h-10" />
          </Link>

          {isAdminRole ? (
            <div className="flex items-center gap-1">
              {pushSupported && (
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={pushSubscribed ? "Notificaciones push activas" : "Activar notificaciones push"}
                  onClick={onTogglePush}
                  disabled={pushLoading}
                  title={pushSubscribed ? "Notificaciones push activas" : "Activar notificaciones push"}
                  className={pushSubscribed ? "text-green-700" : undefined}
                >
                  {pushLoading ? (
                    <Spinner size="md" className="block" />
                  ) : pushSubscribed ? (
                    <BellRing className="w-5 h-5" />
                  ) : (
                    <BellOff className="w-5 h-5" />
                  )}
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Alertas pendientes"
                  onClick={onAlertsClick}
                  className="relative"
                >
                  <Bell className="w-5 h-5" />
                  {pendingAlertsCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-gray-700 rounded-full" />
                  )}
                </Button>
              )}
              {/* Mismo pill que ProfileMenuButton (profile-menu-button.tsx:38)
                  — unico trigger del drawer, ya no hay boton duplicado. */}
              <button
                onClick={onOpenMobileMenu}
                className="flex items-center gap-2 pl-1 pr-2 py-1 bg-transparent border border-gray-200 rounded-full active:scale-95 hover:bg-gray-100/80 transition-colors cursor-pointer"
                aria-label="Abrir menú"
                data-testid="button-mobile-menu"
              >
                <UserAvatar name={currentUser?.name || "Admin"} avatar={currentUser?.avatar} size="xs" />
                <Menu className="w-4 h-4 text-gray-700 shrink-0" />
              </button>
            </div>
          ) : (
            <div className="relative flex items-center gap-2">
              <ProfileMenuButton />
            </div>
          )}
        </div>
      </header>

    </>
  );
}

import { HelpCircle, Lock, LogOut, User, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { logout } from "@/lib/logout";
import { SUPPORT_URL } from "@/lib/support";
import type { User as UserType } from "@shared/schema";

export interface AccountAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  testId: string;
  /** Accion destructiva (cerrar sesion): se separa y va en `error-fg`. */
  danger?: boolean;
}


// Primer nombre + primer apellido (convencion peruana "Nombre(s) Apellido1 Apellido2":
// 3+ palabras -> primera + anteultima, saltando el segundo apellido).
export function getDisplayName(fullName?: string): string {
  if (!fullName) return "Usuario";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 2]}`;
}

const ROLE_LABELS: Record<string, string> = { tutor: "Tutor", admin: "Administrador", agent: "Agente" };

// Fuente unica del menu de cuenta: lo usan el popover de escritorio (ProfileMenuButton) y la pantalla /account (movil).
// Un solo origen = mismas acciones, mismos testids y mismo orden en los dos.
export function useAccountActions() {
  const [, setLocation] = useLocation();
  const { data: user } = useQuery<UserType>({ queryKey: ["/api/user/current"] });
  const userType = (user as { userType?: string } | undefined)?.userType;

  const actions: AccountAction[] = [
    {
      id: "profile",
      label: "Mi perfil",
      icon: User,
      onSelect: () => setLocation(userType === "tutor" ? ROUTES.tutorProfile : ROUTES.studentProfile),
      testId: "menu-profile",
    },
    { id: "password", label: "Cambiar contraseña", icon: Lock, onSelect: () => setLocation(ROUTES.changePassword), testId: "menu-settings" },
    {
      id: "help",
      label: "Centro de ayuda",
      icon: HelpCircle,
      onSelect: () => window.open(SUPPORT_URL, "_blank", "noopener,noreferrer"),
      testId: "menu-help",
    },
    { id: "logout", label: "Cerrar sesión", icon: LogOut, onSelect: () => void logout(), testId: "menu-logout", danger: true },
  ];

  return {
    user,
    displayName: getDisplayName(user?.name),
    roleLabel: ROLE_LABELS[userType ?? ""] ?? "Jugador",
    actions,
  };
}

import { useId, useRef } from "react";
import { Camera, LogOut, Settings } from "lucide-react";
import { ProfileMenuButton } from "@/components/layout/profile-menu-button";
import type { AccountAction } from "@/components/account/use-account-actions";

interface AdminProfileMenuProps {
  isAdmin: boolean;
  isUploadingPhoto: boolean;
  onPhotoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSettingsClick: () => void;
  onLogout: () => void;
  /** Hacia donde abre el menu: "above" cuando el avatar esta abajo del sidebar. */
  placement?: "above" | "below";
}

// Menu de cuenta del Admin: es el MISMO ProfileMenuButton de la app (avatar + nombre, popover blanco, misma
// cabecera con nombre y rol); solo cambian las acciones (Cambiar foto, Configuracion, Cerrar sesion).
export function AdminProfileMenu({ isAdmin, isUploadingPhoto, onPhotoUpload, onSettingsClick, onLogout, placement = "below" }: AdminProfileMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Dos instancias conviven en el DOM (sidebar desktop oculto por CSS + Sheet movil): useId evita ids duplicados.
  const photoInputId = useId();

  const actions: AccountAction[] = [
    { id: "photo", label: "Cambiar foto", icon: Camera, onSelect: () => inputRef.current?.click(), testId: "menu-photo" },
    ...(isAdmin ? [{ id: "settings", label: "Configuración", icon: Settings, onSelect: onSettingsClick, testId: "menu-admin-settings" }] : []),
    { id: "logout", label: "Cerrar sesión", icon: LogOut, onSelect: onLogout, testId: "menu-logout", danger: true },
  ];

  return (
    <>
      <input ref={inputRef} id={photoInputId} type="file" accept="image/*" onChange={onPhotoUpload} className="hidden" disabled={isUploadingPhoto} />
      <ProfileMenuButton align="left" placement={placement} actions={actions} className="w-full" />
    </>
  );
}

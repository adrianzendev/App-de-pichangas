import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface AuthNoticeProps {
  /** Icono del estado (correo enviado, listo…), dentro de un circulo verde claro. */
  icon?: LucideIcon;
  title: string;
  /** El titulo es el h1 de la pantalla (cuando no hay `AuthHeader` encima). */
  pageTitle?: boolean;
  /** Texto principal. */
  children?: ReactNode;
  /** Nota de apoyo bajo el texto (caption): "Revisa tu carpeta de spam…". Sin fondo ni caja. */
  hint?: ReactNode;
  /** Botones o enlaces al final, a todo el ancho. */
  actions?: ReactNode;
}

// Estado terminal de un formulario de acceso (correo enviado, contraseña lista, enlace invalido): icono + titulo + texto + nota + acciones.
// Un solo espaciado y una sola tipografia; reemplaza los bloques que cada pantalla armaba a mano.
export function AuthNotice({ icon: Icon, title, pageTitle, children, hint, actions }: AuthNoticeProps) {
  const TitleTag = pageTitle ? "h1" : "p";
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {Icon && (
        <div className="flex size-avatar-lg items-center justify-center rounded-full bg-green-100">
          <Icon className="size-icon-xl text-green-600" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <TitleTag className={pageTitle ? "text-heading font-bold text-gray-900" : "text-subheading font-semibold text-gray-900"}>{title}</TitleTag>
        {children && <div className="text-body text-gray-700">{children}</div>}
      </div>
      {hint && <div className="flex flex-col gap-1 text-caption text-gray-700">{hint}</div>}
      {actions && <div className="flex w-full flex-col items-center gap-3">{actions}</div>}
    </div>
  );
}

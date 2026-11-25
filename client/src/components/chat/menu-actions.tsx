import type { ComponentType, ReactNode } from "react";
import { Copy, Download, ExternalLink, Reply, type LucideIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Una accion del menu de un mensaje. Se define UNA sola vez y la pintan tanto el
 * clic derecho (`ContextMenu`) como la flecha desplegable (`DropdownMenu`).
 */
export interface MenuAction {
  /** Clave estable (`reply`, `copy`, `open`, `save`). */
  key: string;
  /** Texto visible. */
  label: string;
  /** Icono de Lucide. */
  icon: LucideIcon;
  /** Deshabilitada (p. ej. descargar mientras el mensaje se envia). */
  disabled?: boolean;
  /** Ejecuta la accion. */
  onSelect: () => void;
}

/**
 * Datos y callbacks para construir las acciones de un mensaje.
 */
export interface MessageMenuActionsInput {
  /** Texto propio del mensaje (sin placeholder de adjunto); habilita "Copiar texto". */
  text?: string | null;
  /** Hay adjunto: habilita "Abrir" y "Guardar como...". */
  hasAttachment: boolean;
  /** Se puede descargar ahora (false mientras se envia). */
  canDownload: boolean;
  /** Abre el primer adjunto. */
  onOpen?: () => void;
  /** Descarga el primer adjunto. */
  onDownload?: () => void;
  /** Responder / citar este mensaje (undefined = no disponible, p. ej. aun se esta enviando). */
  onReply?: () => void;
}

/**
 * Construye las acciones reales de un mensaje: "Responder", "Copiar texto" (si hay
 * texto) y "Abrir" / "Guardar como..." (si hay adjunto). Sin Reenviar, Editar ni
 * Eliminar: esas funciones aun no existen.
 *
 * @param {MessageMenuActionsInput} input - Contenido del mensaje y callbacks.
 * @returns {MenuAction[]} Lista de acciones (vacia si no hay nada que ofrecer).
 */
export function buildMessageMenuActions({ text, hasAttachment, canDownload, onOpen, onDownload, onReply }: MessageMenuActionsInput): MenuAction[] {
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text!.trim());
      toast({ title: "Texto copiado" });
    } catch {
      toast({ title: "No se pudo copiar el texto", variant: "destructive" });
    }
  };
  return [
    ...(onReply ? [{ key: "reply", label: "Responder", icon: Reply, onSelect: onReply }] : []),
    ...(text?.trim() ? [{ key: "copy", label: "Copiar texto", icon: Copy, onSelect: copyText }] : []),
    ...(hasAttachment ? [
      { key: "open", label: "Abrir", icon: ExternalLink, onSelect: () => onOpen?.() },
      { key: "save", label: "Guardar como…", icon: Download, disabled: !canDownload, onSelect: () => onDownload?.() },
    ] : []),
  ];
}

/** Lo minimo que comparten `ContextMenuItem` y `DropdownMenuItem`. */
type MenuItemComponent = ComponentType<{ disabled?: boolean; onSelect?: (event: Event) => void; children?: ReactNode }>;

/**
 * Lista de acciones con el MISMO marcado (icono + texto) para cualquiera de los
 * dos menus; solo cambia el componente `Item` de Radix que la pinta.
 *
 * @param {object} props - Acciones y componente de item (`ContextMenuItem` o `DropdownMenuItem`).
 * @returns {JSX.Element} Los items del menu.
 */
export function ActionItems({ actions, Item }: { actions: MenuAction[]; Item: MenuItemComponent }) {
  return (
    <>
      {actions.map(({ key, label, icon: Icon, disabled, onSelect }) => (
        <Item key={key} disabled={disabled} onSelect={onSelect}>
          <Icon className="mr-2 size-icon-md" /> {label}
        </Item>
      ))}
    </>
  );
}

import type { ComponentPropsWithoutRef } from "react";
import { Pencil, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteIconButton } from "@/components/ui/delete-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ROW_ACTION_TONE = {
  default: "",
  success: "text-primary-600 hover:text-primary-700",
  danger: "text-error-fg hover:text-error-fg",
} as const;

interface AdminRowActionProps extends Omit<ComponentPropsWithoutRef<typeof Button>, "children" | "variant" | "size" | "className" | "aria-label"> {
  icon: LucideIcon;
  /** Nombre accesible; tambien es el tooltip si no se pasa `tooltip`. */
  label: string;
  tooltip?: string;
  tone?: keyof typeof ROW_ACTION_TONE;
}

// Boton de icono de una fila de tabla admin, dentro de AdminActionsTd. UN solo origen de tamano, color y tooltip.
export function AdminRowAction({ icon: Icon, label, tooltip, tone = "default", ...props }: AdminRowActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className={ROW_ACTION_TONE[tone]} {...props}>
          <Icon className="size-icon-md" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip ?? label}</TooltipContent>
    </Tooltip>
  );
}

type AdminDeleteButtonProps = ComponentPropsWithoutRef<typeof DeleteIconButton>;

// Papelera de una fila de tabla admin: DeleteIconButton con el mismo tooltip que el resto de acciones.
export function AdminDeleteButton(props: AdminDeleteButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DeleteIconButton {...props} />
      </TooltipTrigger>
      <TooltipContent>{props["aria-label"]}</TooltipContent>
    </Tooltip>
  );
}

interface RowActionsProps {
  entity: string; // "servicio", "curso"…: va en el aria-label
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}

// Editar / eliminar de una fila de tabla admin, dentro de AdminActionsTd.
export function RowActions({ entity, onEdit, onDelete, deleteDisabled }: RowActionsProps) {
  return (
    <>
      <AdminRowAction icon={Pencil} label={`Editar ${entity}`} onClick={onEdit} />
      <AdminDeleteButton aria-label={`Eliminar ${entity}`} onClick={onDelete} disabled={deleteDisabled} />
    </>
  );
}

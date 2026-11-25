import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonBaseProps = Omit<ComponentPropsWithoutRef<typeof Button>, "variant" | "size">;

type DeleteIconButtonProps = Omit<ButtonBaseProps, "children"> & { "aria-label": string };

// Papelera de solo icono: UN solo origen de icono y color en toda la app. forwardRef: tambien va dentro de TooltipTrigger asChild.
export const DeleteIconButton = forwardRef<HTMLButtonElement, DeleteIconButtonProps>(({ "aria-label": ariaLabel, className, ...props }, ref) => (
  <Button ref={ref} variant="ghost" size="icon" aria-label={ariaLabel} className={cn("text-error-fg hover:text-error-fg", className)} {...props}>
    <Trash2 className="size-icon-md" />
  </Button>
));
DeleteIconButton.displayName = "DeleteIconButton";

// Misma papelera con texto, para acciones principales de un modal.
export function DeleteButton({ children = "Eliminar", ...props }: ButtonBaseProps) {
  return (
    <Button variant="destructive-outline" {...props}>
      <Trash2 className="size-icon-md" />
      {children}
    </Button>
  );
}

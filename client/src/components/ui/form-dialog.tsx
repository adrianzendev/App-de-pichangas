import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
  onCancel: () => void;
  cancelLabel?: ReactNode;
  cancelTestId?: string;
  /** Sin `onSubmit` no hay boton principal: el pie es solo el boton de cierre. */
  onSubmit?: () => void;
  submitLabel?: ReactNode;
  submitDisabled?: boolean;
  submitVariant?: "default" | "destructive";
  submitClassName?: string;
  submitTestId?: string;
}

// Dialogo de formulario: titulo, cuerpo y pie Cancelar + accion principal.
// El cuerpo (campos) va como children.
export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  testId,
  className,
  onCancel,
  cancelLabel = "Cancelar",
  cancelTestId,
  onSubmit,
  submitLabel,
  submitDisabled,
  submitVariant = "default",
  submitClassName,
  submitTestId,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={testId} className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-field-gap">
          {children}
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={onCancel} data-testid={cancelTestId}>
              {cancelLabel}
            </Button>
            {onSubmit && (
              <Button
                variant={submitVariant}
                className={cn("flex-1", submitClassName)}
                disabled={submitDisabled}
                onClick={onSubmit}
                data-testid={submitTestId}
              >
                {submitLabel}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

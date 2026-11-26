import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Accion destructiva (cancelar pedido, eliminar): boton de confirmar en coral. */
  destructive?: boolean;
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="mx-4">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={destructive ? "bg-error hover:opacity-90 text-white" : undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Reemplazo de window.confirm():
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (await confirm({ title: "...", destructive: true })) { ... }
 *   return (<>... {confirmDialog}</>);
 * Renderizar `confirmDialog` FUERA de elementos con onClick (el portal burbujea
 * eventos de React al padre).
 */
export function useConfirm() {
  const [state, setState] = React.useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ options, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const confirmDialog = state ? (
    <ConfirmDialog
      {...state.options}
      open
      onOpenChange={(open) => !open && close(false)}
      onConfirm={() => close(true)}
    />
  ) : null;

  return { confirm, confirmDialog };
}

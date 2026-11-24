import { OutlinedControl } from "@/components/ui/outlined-field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { DELETE_CONFIRM_WORD, useDeleteAccount } from "@/components/account/use-delete-account";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Confirmacion de "Eliminar cuenta" (Mi perfil > Ajustes de cuenta). La misma logica que la pagina /delete-account.
export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const del = useDeleteAccount();
  const close = () => {
    del.reset();
    onOpenChange(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Eliminar cuenta"
      testId="dialog-delete-account"
      onCancel={close}
      onSubmit={del.submit}
      submitLabel={del.isPending ? "Eliminando…" : "Eliminar mi cuenta"}
      submitVariant="destructive"
      submitDisabled={!del.canSubmit}
      submitTestId="button-delete-account"
    >
      <div className="space-y-3">
        <div className="space-y-2 text-body text-gray-700">
          <p>Se borran tus datos personales: nombre, correo, teléfono, foto y los dispositivos con avisos. No podrás volver a entrar con esta cuenta.</p>
          <p>Los pedidos, pagos y mensajes compartidos con otra persona se conservan sin tu identidad. No puedes eliminarla con un pedido con pago o trabajo en curso.</p>
        </div>
        <OutlinedControl htmlFor="delete-confirmation-dialog" label={<>Escribe {DELETE_CONFIRM_WORD} para confirmar</>}>
          <Input
            id="delete-confirmation-dialog"
            value={del.confirmation}
            onChange={(e) => del.setConfirmation(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") del.submit(); }}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder={DELETE_CONFIRM_WORD}
            aria-invalid={!!del.error}
            data-testid="input-delete-confirmation"
          />
        </OutlinedControl>
        {del.error && (
          <p role="alert" className="text-body text-error-fg" data-testid="delete-account-error">
            {del.error}
          </p>
        )}
      </div>
    </FormDialog>
  );
}

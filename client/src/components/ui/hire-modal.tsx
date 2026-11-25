import { AttachField } from "@/components/ui/attach-field";
import { useEffect, useMemo } from "react";
import { Copy, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useToast } from "@/hooks/use-toast";

interface BankAccount {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
}

interface HireModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutorName: string;
  tutorAvatar?: string;
  taskTitle: string;
  price: string;
  bankAccounts: BankAccount[];
  paymentMethod: string;
  onPaymentMethodChange: (accountId: string) => void;
  receiptFile: File | null;
  onReceiptChange: (file: File | null) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

// Agrupa en bloques de 3 desde la izquierda: "935436864" -> "935 436 864".
function formatAccountNumber(value: string): string {
  return value.replace(/(\d{3})(?=\d)/g, "$1 ");
}

// Cabecera numerada de cada paso (1 Transfiere, 2 Sube el comprobante): el orden es real.
function StepTitle({ n, id, children }: { n: number; id: string; children: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-primary-600 text-caption font-bold text-white">{n}</span>
      <h3 id={id} className="text-subheading font-semibold text-gray-900">{children}</h3>
    </div>
  );
}

export function HireModal({
  isOpen,
  onClose,
  tutorName,
  tutorAvatar,
  taskTitle,
  price,
  bankAccounts,
  paymentMethod,
  onPaymentMethodChange,
  receiptFile,
  onReceiptChange,
  onSubmit,
  isSubmitting,
}: HireModalProps) {
  const { toast } = useToast();
  const selectedAccount = bankAccounts.find((acc) => acc.id === paymentMethod);

  // Object URL del comprobante: una por archivo (no una por render) y se revoca al cambiar de archivo o cerrar.
  const receiptPreviewUrl = useMemo(
    () => (receiptFile?.type.startsWith("image/") ? URL.createObjectURL(receiptFile) : null),
    [receiptFile],
  );
  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  // Un chip por cuenta cargada por administración — muestra el banco/proveedor
  // real (bankName, ej. "BCP", "Yape"), no el accountType interno.
  useEffect(() => {
    if (bankAccounts.length && !bankAccounts.some((acc) => acc.id === paymentMethod)) {
      onPaymentMethodChange(bankAccounts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankAccounts]);

  const handleCopy = () => {
    if (!selectedAccount) return;
    navigator.clipboard.writeText(selectedAccount.accountNumber);
    toast({ title: "Copiado", description: "Número de cuenta copiado" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-full max-w-viewport-gutter rounded-card p-0 overflow-x-hidden"
        data-testid="dialog-payment"
      >
        <div className="px-4 py-3 overflow-x-hidden">
          <DialogTitle>Contratar tutor</DialogTitle>
        </div>

        <div className="px-4 pb-4 space-y-6 w-full max-w-full overflow-x-hidden">
          {/* Resumen: el total es lo primero que se lee */}
          <div className="flex flex-col items-center gap-1 text-center min-w-0">
            <UserAvatar name={tutorName} avatar={tutorAvatar} size="mdl" />
            <p className="mt-1 max-w-full text-body font-semibold text-gray-900 truncate">{tutorName}</p>
            <p className="max-w-full text-caption text-muted truncate">{taskTitle}</p>
            <p className="mt-2 text-heading font-bold text-gray-900">{price}</p>
          </div>

          {/* Paso 1: transferir */}
          <section aria-labelledby="pay-step-1">
            <StepTitle n={1} id="pay-step-1">Transfiere</StepTitle>
            {bankAccounts.length > 0 ? (
              <div role="group" aria-label="Método de pago" className="flex flex-wrap gap-2">
                {bankAccounts.map((account) => (
                  <Chip
                    key={account.id}
                    active={account.id === paymentMethod}
                    onClick={() => onPaymentMethodChange(account.id)}
                    data-testid={`tab-payment-${account.id}`}
                  >
                    {account.bankName}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-caption text-muted">No hay métodos de pago configurados para tu país.</p>
            )}

            {selectedAccount ? (
              <div className="mt-3 bg-card border border-border rounded-lg p-card-pad">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <p className="text-heading font-display font-bold text-gray-900 truncate" data-testid="text-account-number">
                    {formatAccountNumber(selectedAccount.accountNumber)}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="flex-shrink-0"
                    data-testid="button-copy-account"
                  >
                    <Copy className="size-icon-md" />
                    Copiar
                  </Button>
                </div>
                <p className="text-body text-muted mt-1 truncate">{selectedAccount.accountHolder}</p>
              </div>
            ) : bankAccounts.length > 0 && (
              <p className="text-caption text-muted mt-2">No hay una cuenta configurada para este método en tu país.</p>
            )}
          </section>

          {/* Paso 2: comprobante */}
          <section aria-labelledby="pay-step-2">
            <StepTitle n={2} id="pay-step-2">Sube el comprobante</StepTitle>

            {receiptFile ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md w-full max-w-full">
                {receiptPreviewUrl ? (
                  <img
                    src={receiptPreviewUrl}
                    alt="Vista previa del comprobante"
                    className="size-thumb object-contain rounded-md bg-white shadow-sm flex-shrink-0"
                  />
                ) : (
                  <FileText className="size-icon-xl text-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-body text-gray-900 truncate">{receiptFile.name}</p>
                  <p className="text-caption text-primary-700">Comprobante adjunto</p>
                </div>
                <label
                  htmlFor="receipt"
                  className="text-caption font-medium text-gray-900 hover:underline cursor-pointer flex-shrink-0"
                  data-testid="button-change-receipt"
                >
                  Cambiar
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Quitar comprobante"
                  onClick={() => onReceiptChange(null)}
                  className="flex-shrink-0"
                  data-testid="button-remove-receipt"
                >
                  <X className="size-icon-md text-muted" aria-hidden />
                </Button>
              </div>
            ) : (
              <AttachField htmlFor="receipt">Adjuntar comprobante de pago</AttachField>
            )}
            <Input
              id="receipt"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => onReceiptChange(e.target.files?.[0] || null)}
              className="hidden"
              data-testid="input-receipt"
            />
          </section>

          {/* Acciones */}
          <div className="space-y-2 w-full max-w-full pb-safe-min">
            <Button
              type="button"
              onClick={onSubmit}
              isLoading={isSubmitting}
              className="w-full"
              data-testid="button-submit-payment"
            >
              {isSubmitting ? "Enviando…" : `Pagar ${price}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full"
              data-testid="button-cancel-payment"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

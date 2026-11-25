import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Confirmacion tras publicar. Cerrarlo (o pulsar el boton) reinicia el formulario y lleva a /orders.
export function PublishSuccessDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="text-center p-8 z-modal">
        <DialogHeader className="sr-only"><DialogTitle>Pedido publicado</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-6">
          <div className="size-avatar-lg rounded-full bg-gray-100 flex items-center justify-center">
            <CheckCircle className="size-icon-xl text-primary-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-heading font-bold text-gray-900">¡Pedido publicado!</h2>
            <p className="text-gray-700">Tu pedido ha sido publicado exitosamente. Los tutores podrán verlo y enviarte propuestas.</p>
          </div>
          <Button size="lg" onClick={onClose} className="w-full">
            Ver mis pedidos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Button } from "@/components/ui/button";
import { TaskNumber } from "@/components/ui/task-number";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { TaskWithCandidates } from "@shared/schema";

interface ExpiredTaskModalProps {
  task: TaskWithCandidates;
  onClose: () => void;
}

export function ExpiredTaskModal({ task, onClose }: ExpiredTaskModalProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className=" text-center">
        <DialogTitle>
          Pedido expirado
        </DialogTitle>

        {/* Task Info */}
        <div className="mb-4">
          <TaskNumber taskId={String(task.id)} taskNumber={task.taskNumber} className="text-label text-gray-700" />
          <p className="text-label text-gray-700 mt-1 line-clamp-2">{task.title}</p>
        </div>

        {/* Message */}
        <p className="text-label text-gray-700 mb-6">
          Este pedido ya no está disponible. Si el alumno lo vuelve a activar, podrás aplicar nuevamente.
        </p>

        {/* Action Button */}
        <Button
          onClick={onClose}
          className="w-full bg-gray-900 hover:bg-gray-700 text-white font-medium"
        >
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}

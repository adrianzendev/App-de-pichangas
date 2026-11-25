import { SimpleTaskCard } from "@/components/ui/simple-task-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import type { TaskWithCandidates } from "@shared/schema";

interface TaskListProps {
  tasks: TaskWithCandidates[];
  onTaskClick: (task: TaskWithCandidates) => void;
  onRepublish: (task: TaskWithCandidates, e: React.MouseEvent) => void;
  onView?: (task: TaskWithCandidates, e: React.MouseEvent) => void;
  onCancel?: (task: TaskWithCandidates, e: React.MouseEvent) => void;
  getTotalUnreadForTask: (task: TaskWithCandidates) => number;
  emptyStateAction?: () => void;
  emptyStateText?: string;
  emptyStateButtonText?: string;
  showPaymentStates?: boolean;
  maxItems?: number;
  isTutor?: boolean;
  currentTutorId?: string | number;
  selectedTaskId?: string | number | null;
}

export function TaskList({
  tasks,
  onTaskClick,
  onRepublish,
  onView,
  onCancel,
  getTotalUnreadForTask,
  emptyStateAction,
  emptyStateText = "Publica tu primer pedido para recibir ayuda",
  emptyStateButtonText = "Publicar pedido",
  showPaymentStates = true,
  maxItems,
  isTutor = false,
  currentTutorId,
  selectedTaskId,
}: TaskListProps) {
  const displayTasks = maxItems ? tasks.slice(0, maxItems) : tasks;

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-field p-8">
        <EmptyState
          icon={Inbox}
          title={isTutor ? "Sin trabajos aún" : "Sin pedidos aún"}
          description={emptyStateText}
          action={emptyStateAction && <Button onClick={emptyStateAction}>{emptyStateButtonText}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-card-gap">
      {displayTasks.map((task) => {
        const unreadCount = getTotalUnreadForTask(task);

        return (
          <SimpleTaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            onRepublish={(e) => onRepublish(task, e)}
            onView={onView ? (e) => onView(task, e) : undefined}
            onCancel={onCancel ? (e) => onCancel(task, e) : undefined}
            unreadCount={unreadCount}
            selected={selectedTaskId != null && String(selectedTaskId) === String(task.id)}
            showPaymentStates={showPaymentStates}
            isTutor={isTutor}
            currentTutorId={currentTutorId}
          />
        );
      })}
    </div>
  );
}

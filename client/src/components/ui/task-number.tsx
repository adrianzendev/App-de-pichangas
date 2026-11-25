interface TaskNumberProps {
  taskId: string;
  taskNumber?: number | null;
  className?: string;
}

export function TaskNumber({ taskId, taskNumber, className = "text-caption text-gray-700" }: TaskNumberProps) {
  const displayNumber = taskNumber || taskId.slice(-6);
  return <span className={className}>Nº {displayNumber}</span>;
}

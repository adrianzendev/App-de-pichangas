import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Boton u otro elemento de accion debajo del texto. */
  action?: ReactNode;
  /** Centrado en el alto que queda bajo el titulo y los filtros (error de carga, lista vacia). */
  centered?: boolean;
  className?: string;
}

export function EmptyState({ title, description, icon: Icon, action, centered, className }: EmptyStateProps) {
  return (
    <div className={cn("text-center py-8", centered && "flex min-h-empty-center flex-col items-center justify-center lg:flex-1", className)}>
      {Icon && <Icon className="size-icon-empty mx-auto mb-3 text-gray-300" />}
      <p className={cn("text-body text-gray-700", Icon && "font-medium text-gray-900")}>{title}</p>
      {description && <p className="text-body text-gray-700 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

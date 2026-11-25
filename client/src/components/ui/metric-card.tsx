import { LucideIcon } from "lucide-react";
import { OUTLINED_LABEL } from "@/components/ui/outlined-field";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  subtitle?: string;
  testId: string;
  indicator?: boolean;
}

export function MetricCard({ title, value, icon: Icon, subtitle, testId, indicator = false }: MetricCardProps) {
  return (
    <div className="relative bg-white rounded-lg border border-field p-card-pad" data-testid={testId}>
      <p className={OUTLINED_LABEL}>{title}</p>
      <div className="flex items-center justify-between">
        <p className="text-heading font-semibold text-gray-900" data-testid={`${testId}-value`}>{value}</p>
        {Icon && (
          <div className="relative">
            <Icon className="size-icon-xl text-gray-700" aria-hidden />
            {indicator && (
              <span className="absolute -top-1 -right-1 size-presence-md bg-primary-600 rounded-full border-2 border-white" />
            )}
          </div>
        )}
      </div>
      {subtitle && (
        <p className="text-caption text-gray-700 mt-2">{subtitle}</p>
      )}
    </div>
  );
}

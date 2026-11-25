import * as React from "react";
import { Check, ChevronRight } from "lucide-react";

/* ─── CampoFila: row in summary ─── */
export function CampoFila({ icon, label, required, value, placeholder, isComplete, onClick }: {
  icon: React.ReactNode; label: string; required?: boolean;
  value?: string; placeholder: string; isComplete: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-gray-50/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <div className={`size-icon-circle rounded-full flex items-center justify-center shrink-0 transition-colors ${isComplete ? 'bg-primary-600' : 'bg-gray-100'}`}>
        {isComplete ? <Check className="size-icon-md text-white" /> : <span className="text-gray-700 flex items-center justify-center">{icon}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-caption text-gray-700 font-medium">
          {label}{required && <span className="text-gray-300 ml-0.5">*</span>}
        </p>
        {value
          ? <p className="text-body font-semibold text-gray-900 truncate mt-0.5">{value}</p>
          : <p className="text-body text-gray-700 mt-0.5">{placeholder}</p>
        }
      </div>
      <ChevronRight className="size-icon-lg text-gray-700 shrink-0" />
    </button>
  );
}

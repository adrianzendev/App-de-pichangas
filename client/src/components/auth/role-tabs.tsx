import { cn } from "@/lib/utils";

export type AuthRole = "student" | "tutor";

const ROLES: { value: AuthRole; label: string }[] = [
  { value: "student", label: "Soy estudiante" },
  { value: "tutor", label: "Soy tutor" },
];

// Selector Alumno / Tutor del login y del registro: pestañas subrayadas (la activa en negro, negrita y con linea; sin verde ni fondo).
export function RoleTabs({ value, onChange }: { value: AuthRole; onChange: (role: AuthRole) => void }) {
  return (
    <div role="tablist" aria-label="Tipo de cuenta" className="grid grid-cols-2 border-b border-border">
      {ROLES.map((role) => {
        const active = value === role.value;
        return (
          <button
            key={role.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(role.value)}
            data-testid={`role-${role.value}`}
            className={cn(
              "-mb-px h-12 border-b-2 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              active ? "border-gray-900 font-bold text-gray-900" : "border-transparent font-medium text-gray-700 hover:text-gray-900",
            )}
          >
            {role.label}
          </button>
        );
      })}
    </div>
  );
}

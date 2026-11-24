import { Button } from "@/components/ui/button";

interface QuickUser {
  id: string;
  name?: string | null;
  email: string;
}

interface DevQuickLoginProps {
  groups: { title: string; users: QuickUser[]; variant?: "outline" | "default" }[];
  onLogin: (email: string) => void;
  disabled?: boolean;
}

// Acceso rapido de pruebas (solo en desarrollo; /api/auth/dev-login responde 404 en produccion).
export function DevQuickLogin({ groups, onLogin, disabled }: DevQuickLoginProps) {
  return (
    <div className="space-y-3">
      {groups.filter((g) => g.users.length > 0).map((g) => (
        <div key={g.title}>
          <p className="mb-2 text-caption font-medium uppercase tracking-wide text-gray-700">{g.title}</p>
          <div className="grid grid-cols-2 gap-2">
            {g.users.map((user) => (
              <Button
                key={user.id}
                type="button"
                size="sm"
                variant={g.variant ?? "outline"}
                disabled={disabled}
                title={user.email}
                onClick={() => onLogin(user.email)}
                data-testid={`quick-login-${user.id}`}
              >
                <span className="truncate">{user.name || user.email.split("@")[0]}</span>
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

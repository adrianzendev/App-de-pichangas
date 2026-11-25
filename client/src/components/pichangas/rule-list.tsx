import { Clock, Footprints, Info, ShieldCheck, type LucideIcon } from "lucide-react";
import { ruleText, usePichangaRules } from "@/lib/pichangas";

export const RULE_ICON_MAP: Record<string, LucideIcon> = { clock: Clock, footwear: Footprints, shield: ShieldCheck, info: Info };

// Reglas del encuentro (las configura el admin). Un solo componente para el detalle y el pase.
export function RuleList({ startsAt }: { startsAt: string }) {
  const { data: rules = [] } = usePichangaRules();
  if (rules.length === 0) return null;
  return (
    <ul className="space-y-4">
      {rules.map((rule) => {
        const Icon = RULE_ICON_MAP[rule.icon] ?? ShieldCheck;
        return (
          <li key={rule.id} className="flex gap-3">
            <Icon className="mt-1 size-5 shrink-0 text-pitch" aria-hidden />
            <div className="min-w-0">
              <p className="text-body font-bold text-night-text">{rule.title}</p>
              <p className="text-label text-night-muted">{ruleText(rule, startsAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

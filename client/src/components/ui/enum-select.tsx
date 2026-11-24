import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EnumOption } from "@/lib/options";

interface EnumSelectProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SelectTrigger>, "onChange" | "value" | "defaultValue"> {
  options: EnumOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

// Select de una lista fija de valores. Las props extra (id, data-testid, className) van al trigger.
export const EnumSelect = React.forwardRef<HTMLButtonElement, EnumSelectProps>(
  ({ options, value, onValueChange, placeholder, ...triggerProps }, ref) => (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger ref={ref} {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
);
EnumSelect.displayName = "EnumSelect";

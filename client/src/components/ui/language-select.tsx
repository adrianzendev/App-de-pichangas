import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TUTOR_LANGUAGES, formatTutorLanguage } from "@shared/tutor-language";

interface LanguageSelectProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SelectTrigger>, "onChange" | "value" | "defaultValue"> {
  value?: string;
  onValueChange: (language: string) => void;
  placeholder?: string;
}

// Idioma principal (nativo) del tutor. Una sola lista: TUTOR_LANGUAGES (shared/tutor-language.ts).
export const LanguageSelect = React.forwardRef<HTMLButtonElement, LanguageSelectProps>(
  ({ value, onValueChange, placeholder, ...triggerProps }, ref) => (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger ref={ref} {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {TUTOR_LANGUAGES.map((l) => (
          <SelectItem key={l} value={l}>
            {formatTutorLanguage(l)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
);
LanguageSelect.displayName = "LanguageSelect";

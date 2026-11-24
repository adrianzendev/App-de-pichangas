import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountries, isActiveCountry, type CountryInfo } from "@/hooks/use-countries";

export type CountryOption = CountryInfo;

interface CountrySelectProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SelectTrigger>, "onChange" | "value" | "defaultValue"> {
  value?: string;
  onValueChange: (code: string) => void;
  /** Lista ya cargada por el caller. Si se omite: /api/countries (activos), o la lista local. */
  countries?: CountryOption[];
  placeholder?: string;
  contentPosition?: "item-aligned" | "popper";
}

// Opciones = solo nombre. El emoji de bandera se renderiza como siglas (PE, CL)
// en Windows, asi que no se imprime aqui; la bandera queda solo como dato en BD.
export const CountrySelect = React.forwardRef<HTMLButtonElement, CountrySelectProps>(
  ({ value, onValueChange, countries, placeholder, contentPosition, ...triggerProps }, ref) => {
    const remote = useCountries(!countries);
    const options = countries ? countries.filter(isActiveCountry) : remote;

    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger ref={ref} {...triggerProps}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position={contentPosition}>
          {options.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  },
);
CountrySelect.displayName = "CountrySelect";

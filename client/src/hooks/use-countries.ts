import { useQuery } from "@tanstack/react-query";
import { countries as fallbackCountries } from "@/lib/timezone-utils";

export interface CountryInfo {
  code: string;
  name: string;
  flag?: string | null;
  phoneCode?: string | null;
  isActive?: boolean | null;
}

export const isActiveCountry = (c: CountryInfo) => c.isActive === undefined || c.isActive === true;

// Paises activos de /api/countries; si la API no responde o viene vacia, la lista local.
export function useCountries(enabled = true): CountryInfo[] {
  const { data } = useQuery<CountryInfo[]>({ queryKey: ["/api/countries"], enabled });
  return (data?.length ? data : fallbackCountries).filter(isActiveCountry);
}

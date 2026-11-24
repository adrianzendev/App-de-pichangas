import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CountryInfo } from "@/hooks/use-countries";

// Al cambiar el campo `country`, cambia el prefijo de `whatsapp` (+51 -> +56)
// conservando los digitos ya escritos. Solo se reemplaza el prefijo conocido
// (el mas largo que coincida) para no comerse los digitos del numero.
export function usePhonePrefix(form: UseFormReturn<any>, countries: CountryInfo[]) {
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name !== "country" || !value.country) return;
      const selected = countries.find((c) => c.code === value.country);
      if (!selected?.phoneCode) return;
      const current: string = form.getValues("whatsapp") || "";
      const prev = countries
        .map((c) => c.phoneCode)
        .filter((p): p is string => !!p && current.startsWith(p))
        .sort((a, b) => b.length - a.length)[0];
      const number = prev ? current.slice(prev.length) : current.replace(/^\+\d*/, "");
      form.setValue("whatsapp", selected.phoneCode + number);
    });
    return () => subscription.unsubscribe();
  }, [form, countries]);
}

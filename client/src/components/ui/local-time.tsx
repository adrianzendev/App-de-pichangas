import { useEffect, useState } from "react";
import { timezoneForCountry } from "@shared/country-timezone";
import { fmtTime12 } from "@/lib/date-format";

interface LocalTimeProps {
  /** Pais de la persona (ISO-2 o ISO-3, como en users.country). */
  country?: string | null;
  className?: string;
}

// Hora local actual de una persona segun su pais ("03:20 PM"), se actualiza cada 30 s. Sin pais conocido: "-".
// Fuente unica de zonas: shared/country-timezone.ts.
export function LocalTime({ country, className }: LocalTimeProps) {
  const timeZone = timezoneForCountry(country);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!timeZone) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [timeZone]);

  if (!timeZone) return <span className={className ?? "text-gray-700"}>-</span>;
  return (
    <span className={className} title={timeZone.replace(/_/g, " ")}>
      {fmtTime12(now, timeZone)}
    </span>
  );
}

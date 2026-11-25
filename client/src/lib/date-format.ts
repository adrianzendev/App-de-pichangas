import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// Formatos de fecha/hora de la app (locale es-PE). Un solo lugar para opciones
// de Intl y el locale de date-fns, en vez de repetirlos inline en cada vista.

export const LIMA_TZ = "America/Lima";

type DateInput = Date | string | number;

const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

// "03:30 PM"
export function fmtTime12(d: DateInput, timeZone?: string): string {
  return toDate(d)
    .toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone })
    .toUpperCase();
}

// "12/03/2025"
export function fmtDate(d: DateInput, timeZone?: string): string {
  return toDate(d).toLocaleDateString("es-PE", { timeZone });
}

// Propios (no Intl): el locale es-PE devuelve el mes con mayuscula ("Agosto") y el corto con guion ("17-jun.").
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT =["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Dia, mes (0-11) y anio de una fecha en la zona horaria dada (por defecto la del dispositivo).
function dateParts(d: Date, timeZone?: string): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "numeric", year: "numeric", timeZone }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month") - 1, year: get("year") };
}

// "12 mar" (este anio) | "12 mar 2025" (otro anio). Con espacio, sin guion ni punto.
export function fmtDateShort(d: DateInput, timeZone?: string): string {
  const date = toDate(d);
  const { day, month, year } = dateParts(date, timeZone);
  const label = `${day} ${MONTHS_SHORT[month]}`;
  return year === dateParts(new Date(), timeZone).year ? label : `${label} ${year}`;
}

// Lista de hilos: hoy -> hora ("2:30 PM"), anio actual -> "16 sep",
// anio anterior -> "16/09/25".
export function fmtListDate(d: DateInput): string {
  const date = toDate(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return fmtTime12(date);
  if (date.getFullYear() === now.getFullYear()) return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)}`;
}

// Separador de dia del chat: "Hoy" | "Ayer" | "9 de mayo" | "9 de mayo, 2025".
export function fmtDayLabelLong(d: DateInput): string {
  const date = toDate(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Hoy";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  const label = `${date.getDate()} de ${MONTHS_LONG[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label}, ${date.getFullYear()}`;
}

// "hace 3 horas"
export function fmtRelative(d: DateInput): string {
  return formatDistanceToNow(toDate(d), { addSuffix: true, locale: es });
}

// "12/03/2025 03:30 PM"
export function fmtDateTime(d: DateInput, timeZone?: string): string {
  return `${fmtDate(d, timeZone)} ${fmtTime12(d, timeZone)}`;
}

// "12 mar, 03:30 PM"
export function fmtDateTimeShort(d: DateInput, timeZone?: string): string {
  return `${fmtDateShort(d, timeZone)}, ${fmtTime12(d, timeZone)}`;
}

// Vencimiento de un pedido en lenguaje natural, para tarjetas: "Vence en 3 horas", "Vence mañana", "Venció ayer",
// "Venció hace 2 días". A partir de 7 dias pasa a fecha ("Vence el 12 mar") porque "hace 23 dias" ya no ayuda.
const plural = (n: number, unit: string) => `${n} ${n === 1 ? unit : unit === "mes" ? "meses" : `${unit}s`}`;
export function fmtDeadline(deadline: DateInput, now: number = Date.now()): string {
  const end = toDate(deadline).getTime();
  const future = end >= now;
  const diff = Math.abs(end - now);
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  const verb = future ? "Vence" : "Venció";
  const when = (amount: string) => (future ? `en ${amount}` : `hace ${amount}`);
  if (minutes < 1) return future ? "Vence en menos de 1 minuto" : "Venció hace instantes";
  if (hours < 1) return `${verb} ${when(plural(minutes, "minuto"))}`;
  if (days < 1) return `${verb} ${when(plural(hours, "hora"))}`;
  if (days === 1) return future ? "Vence mañana" : "Venció ayer";
  if (days < 7) return `${verb} ${when(plural(days, "día"))}`;
  return `${verb} el ${fmtDateShort(deadline)}`;
}

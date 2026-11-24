// Utilidades de fecha y hora del formulario de Publicar (plazos, horas en tramos de 15 min, anticipacion minima).

/* ─── Date/time helpers ─── */
export const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// Antes vivia duplicada (una copia local al componente, otra hardcodeada
// en el schema Zod) — compartida aca para que nunca se desincronicen.
export const MIN_LEAD_HOURS = 3;

export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const h12 = h % 12 || 12;
      const period = h >= 12 ? 'PM' : 'AM';
      slots.push(`${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`);
    }
  }
  return slots;
}
export const TIME_SLOTS = generateTimeSlots();

export function parseTimeSlot(slot: string) {
  const [time, period] = slot.split(' ');
  const [h, m] = time.split(':').map(Number);
  return { hour: h, minute: m, period: period as 'AM' | 'PM' };
}
export function formatTimeSlot(h: number, m: number, p: string) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
}
// Usado por los chips de duracion rapida Y por el default/auto-ajuste de
// hora al elegir HOY — un solo lugar para "redondear al siguiente cuarto".
export function roundUpToQuarterHour(d: Date): Date {
  const r = new Date(d);
  const rm = Math.ceil(r.getMinutes() / 15) * 15;
  if (rm >= 60) { r.setHours(r.getHours() + 1); r.setMinutes(0); } else { r.setMinutes(rm); }
  return r;
}
export function minAllowedNow(): Date {
  const d = new Date();
  d.setHours(d.getHours() + MIN_LEAD_HOURS);
  return d;
}

export const DEADLINE_QUICK = [
  { label: '3 horas', hours: 3 }, { label: '24 horas', hours: 24 }, { label: '7 días', hours: 168 },
];


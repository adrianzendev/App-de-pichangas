import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { DAYS_ES, MONTHS_ES, TIME_SLOTS, parseTimeSlot, formatTimeSlot, roundUpToQuarterHour, minAllowedNow, DEADLINE_QUICK } from "./deadline-utils";

/* ─── Inline Date+Time picker ─── */
export function InlineDateTimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const parsed = value ? new Date(value) : null;
  // Sin value todavia (primera apertura): default a HOY + la primera hora
  // valida (ahora + redondeada a cuarto de hora) en vez de
  // dejar el calendario sin nada seleccionado.
  const seed = parsed ?? roundUpToQuarterHour(minAllowedNow());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(seed);
  const [hour, setHour] = useState(seed.getHours() % 12 || 12);
  const [minute, setMinute] = useState(seed.getMinutes());
  const [period, setPeriod] = useState<'AM' | 'PM'>(seed.getHours() >= 12 ? 'PM' : 'AM');
  const [activeQuickDuration, setActiveQuickDuration] = useState<number | null>(null);
  const timeListRef = useRef<HTMLDivElement>(null);
  const selectedTimeSlot = formatTimeSlot(hour, minute, period);

  const getFullDateTime = (date: Date | null, h: number, m: number, p: string): Date | null => {
    if (!date) return null;
    const d = new Date(date);
    let h24 = h % 12;
    if (p === 'PM') h24 += 12;
    d.setHours(h24, m, 0, 0);
    return d;
  };
  const updateValue = (date: Date | null, h: number, m: number, p: string) => {
    if (!date) return;
    const d = new Date(date);
    let h24 = h % 12; if (p === 'PM') h24 += 12;
    d.setHours(h24, m, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  // Confirma el default en el form (RHF) desde el primer render, no solo
  // en pantalla — si no, "Listo" quedaria deshabilitado aunque el
  // calendario ya muestre un dia/hora elegidos.
  useEffect(() => {
    if (!value) updateValue(seed, seed.getHours() % 12 || 12, seed.getMinutes(), seed.getHours() >= 12 ? 'PM' : 'AM');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleSelectDate = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    const isTodaySel = d.toDateString() === new Date().toDateString();
    if (isTodaySel) {
      const candidate = getFullDateTime(d, hour, minute, period);
      if (!candidate || candidate < minAllowedNow()) {
        // Hora ya elegida quedo invalida para HOY (ej. quedo en el pasado
        // o dentro del margen) — reajusta a la primera hora valida.
        const snapped = roundUpToQuarterHour(minAllowedNow());
        const h24 = snapped.getHours(); const h12 = h24 % 12 || 12; const p: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
        setSelectedDate(d); setActiveQuickDuration(null);
        setHour(h12); setMinute(snapped.getMinutes()); setPeriod(p);
        updateValue(d, h12, snapped.getMinutes(), p);
        return;
      }
    }
    setSelectedDate(d); setActiveQuickDuration(null);
    updateValue(d, hour, minute, period);
  };
  const handleSelectTime = (slot: string) => {
    const { hour: h, minute: m, period: p } = parseTimeSlot(slot);
    setHour(h); setMinute(m); setPeriod(p); setActiveQuickDuration(null);
    updateValue(selectedDate, h, m, p);
  };
  const handleQuickDuration = (hoursFromNow: number) => {
    const d = new Date();
    d.setTime(d.getTime() + hoursFromNow * 3600000);
    const rounded = roundUpToQuarterHour(d);
    d.setHours(rounded.getHours(), rounded.getMinutes(), 0, 0);
    const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    setSelectedDate(base); setViewMonth(d.getMonth()); setViewYear(d.getFullYear());
    const h24 = d.getHours(); const h12 = h24 % 12 || 12; const p = h24 >= 12 ? 'PM' : 'AM';
    setHour(h12); setMinute(d.getMinutes()); setPeriod(p as 'AM' | 'PM');
    setActiveQuickDuration(hoursFromNow);
    updateValue(base, h12, d.getMinutes(), p);
  };

  useEffect(() => {
    if (timeListRef.current) {
      const el = timeListRef.current.querySelector('[data-selected="true"]');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selectedTimeSlot]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isSelected = (day: number) => selectedDate?.getDate() === day && selectedDate.getMonth() === viewMonth && selectedDate.getFullYear() === viewYear;
  const isPast = (day: number) => { const d = new Date(viewYear, viewMonth, day); d.setHours(0,0,0,0); return d < today; };
  // No se publica hacia atras: sin retroceder antes del mes actual (`invisible` conserva el espacio y lo saca del foco).
  const atCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const isToday = (day: number) => today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
  const selectedIsToday = !!selectedDate && selectedDate.toDateString() === new Date().toDateString();
  const minAllowed = minAllowedNow();

  const QUICK = DEADLINE_QUICK;

  return (
    // max-w-lg mx-auto: en mobile no hace nada (el viewport ya es mas
    // angosto que 512px), en desktop evita que el grid del calendario se
    // estire a lo ancho de toda la columna de detalle y deje celdas
    // gigantes — mismo Card interno (calendario+horas) se mantiene, solo
    // se acota el ancho total del picker. w-full: dentro de un Dialog (grid) el mx-auto solo lo encogeria a su
    // contenido y dejaria huecos a los lados.
    <div className="mx-auto w-full max-w-lg space-y-4">
      {/* border-0: el Card lleva borde gris en movil/tablet (fondo de pagina blanco); dentro del dialogo no debe enmarcar el calendario. */}
      <Card className="overflow-hidden border-0">
        <div className="flex">
          <div className="min-w-0 flex-1 py-3 pl-0 pr-3 border-r border-field">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }} aria-label="Mes anterior" disabled={atCurrentMonth} className={`${atCurrentMonth ? "invisible " : ""}flex size-touch items-center justify-center rounded-row hover:bg-gray-50 text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}><ChevronLeft className="size-icon-md" /></button>
              <span className="whitespace-nowrap text-label font-semibold text-gray-900">{MONTHS_ES[viewMonth]} {viewYear}</span>
              <button type="button" onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }} aria-label="Mes siguiente" className="flex size-touch items-center justify-center rounded-row hover:bg-gray-50 text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><ChevronRight className="size-icon-md" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS_ES.map((d) => <div key={d} className="text-center text-caption font-semibold text-gray-700 uppercase py-1">{d.substring(0, 2)}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1; const past = isPast(day); const sel = isSelected(day); const tod = isToday(day);
                return (
                  <button key={day} type="button" aria-pressed={sel} disabled={past} onClick={() => handleSelectDate(day)}
                    className={`${past ? 'line-through ' : ''}aspect-square rounded-row border text-label font-medium flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${sel ? 'border-green-600 bg-white text-gray-900' : tod ? 'border-field bg-gray-100 text-gray-900' : past ? 'border-transparent text-gray-700 opacity-40 cursor-not-allowed' : 'border-transparent text-gray-700 hover:bg-gray-50'}`}>
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-24 flex flex-col sm:w-28">
            <div className="text-center py-2 border-b border-field"><span className="text-body font-semibold text-gray-900">Hora</span></div>
            {/* La lista de horas ocupa todo el alto del calendario (absolute + inset-0) y hace scroll dentro. */}
            <div className="relative min-h-48 flex-1">
            <div ref={timeListRef} className="absolute inset-0 overflow-y-auto">
              {TIME_SLOTS.map((slot) => {
                const active = slot === selectedTimeSlot;
                const { hour: sh, minute: sm, period: sp } = parseTimeSlot(slot);
                const slotDate = selectedIsToday ? getFullDateTime(selectedDate, sh, sm, sp) : null;
                const disabled = selectedIsToday && !!slotDate && slotDate < minAllowed;
                return (
                  <button key={slot} type="button" aria-pressed={active} disabled={disabled} data-selected={active} onClick={() => handleSelectTime(slot)}
                    className={`w-full h-10 px-2 rounded-row border text-label text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${disabled ? 'border-transparent text-gray-700 opacity-40 cursor-not-allowed' : active ? 'border-green-600 bg-white text-gray-900 font-semibold' : 'border-transparent text-gray-700 hover:bg-gray-50 font-medium'}`}>
                    {slot}
                  </button>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-3 gap-x-1 gap-y-3">
        {QUICK.map((qd) => (
          <Chip compact key={qd.hours} active={activeQuickDuration === qd.hours} onClick={() => handleQuickDuration(qd.hours)}>
            {qd.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

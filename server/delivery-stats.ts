// Estadisticas de entrega por tutor (panel de admin > Tutores). Funcion pura: la consulta vive en storage.getDeliveryRows.
// Pruebas: npx tsx --test tests/delivery-stats.test.ts

export interface DeliveryRow {
  tutorId: string;
  deadline: Date;
  /** Cuando el pago se aprobo (el tutor ya podia empezar); si no hay, la creacion del pedido. */
  assignedAt: Date;
  deliveredAt: Date;
}

export interface TutorDeliveryStats {
  tutorId: string;
  delivered: number;
  onTime: number;
  late: number;
  /** 0-100, un decimal. */
  onTimePct: number;
  avgHours: number;
  medianHours: number;
}

const HOUR_MS = 3_600_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeDeliveries(rows: DeliveryRow[]): TutorDeliveryStats[] {
  const byTutor = new Map<string, DeliveryRow[]>();
  for (const r of rows) {
    const list = byTutor.get(r.tutorId);
    if (list) list.push(r);
    else byTutor.set(r.tutorId, [r]);
  }
  return Array.from(byTutor, ([tutorId, list]) => {
    // Un pedido entregado antes de asignarse (datos viejos) cuenta 0 h, no negativo.
    const hours = list.map((r) => Math.max(0, (r.deliveredAt.getTime() - r.assignedAt.getTime()) / HOUR_MS)).sort((a, b) => a - b);
    const onTime = list.filter((r) => r.deliveredAt.getTime() <= r.deadline.getTime()).length;
    const mid = Math.floor(hours.length / 2);
    const median = hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
    return {
      tutorId,
      delivered: list.length,
      onTime,
      late: list.length - onTime,
      onTimePct: round1((onTime / list.length) * 100),
      avgHours: round1(hours.reduce((a, b) => a + b, 0) / hours.length),
      medianHours: round1(median),
    };
  });
}

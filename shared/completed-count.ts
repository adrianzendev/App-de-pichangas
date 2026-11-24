// Cantidad de pedidos completados para mostrar en el perfil del tutor: el numero exacto mientras es chico y, desde 10, "Más de N"
// con N = el escalon mas alto ya alcanzado (10, 25, 50, 100, 250, 500, 1000…). Asi el dato crece con lo que el tutor entrega
// sin cambiar a cada pedido. Pruebas: npx tsx --test tests/completed-count.test.ts

const STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export function formatCompletedCount(count: number): string {
  const n = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  if (n < STEPS[0]) return String(n);
  const step = [...STEPS].reverse().find((s) => n >= s) ?? STEPS[0];
  return `Más de ${step}`;
}

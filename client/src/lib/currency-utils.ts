export const DEFAULT_CURRENCY = "PEN";

// "150 PEN" / "150.50 PEN". Sin separador de miles; es el formato de la app.
export function formatPrice(amount: string | number, currencyCode?: string | null): string {
  const code = currencyCode || DEFAULT_CURRENCY;
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0 ${code}`;
  const formatted = num === Math.floor(num) ? String(Math.floor(num)) : num.toFixed(2);
  return `${formatted} ${code}`;
}

// "1,234.50 PEN": siempre 2 decimales y miles agrupados (tasas de cambio, vistas admin).
export function formatPriceGrouped(amount: number, currencyCode: string): string {
  return `${amount.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
}

// Convierte un monto a su equivalente aproximado en USD usando las tasas
// vigentes. Retorna null cuando no aplica (ya es USD, sin tasa, monto
// invalido o el equivalente es demasiado chico para ser util al usuario).
export function calcUsdEquivalent(
  amountStr: string | number | undefined | null,
  currency: string | undefined | null,
  rates: Record<string, number> | undefined | null
): string | null {
  const cur = currency || DEFAULT_CURRENCY;
  if (cur === "USD") return null;
  if (!rates || !rates[cur]) return null;
  const amount = parseFloat(String(amountStr ?? "0"));
  if (isNaN(amount) || amount <= 0) return null;
  const usd = amount / rates[cur];
  if (usd < 0.5) return null;
  return usd < 10 ? usd.toFixed(2) : Math.round(usd).toString();
}

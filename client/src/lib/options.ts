// Listas fijas de opciones para <EnumSelect>. Un solo lugar para valores y etiquetas.
export interface EnumOption {
  value: string;
  label: string;
}

export const PAYMENT_METHODS: EnumOption[] = [
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "transferencia", label: "Transferencia" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe/Tarjeta" },
  { value: "manual", label: "Manual (admin)" },
  { value: "efectivo", label: "Efectivo" },
];

export const BANK_ACCOUNT_TYPES: EnumOption[] = [
  { value: "ahorro", label: "Ahorro" },
  { value: "corriente", label: "Corriente" },
  { value: "cci", label: "CCI" },
];

export const BANK_CURRENCIES: EnumOption[] = [
  { value: "PEN", label: "PEN" },
  { value: "USD", label: "USD" },
  { value: "MXN", label: "MXN" },
];

export const ACCOUNT_STATUSES: EnumOption[] = [
  { value: "active", label: "Activo" },
  { value: "paused", label: "Inactivo" },
  { value: "suspended", label: "Suspendido" },
];

// Alertas del admin: rango del reescaneo de mensajes (dias) y tipo de regla del filtro de contacto.
export const ALERT_SCAN_RANGES: EnumOption[] = [
  { value: "1", label: "Hoy" },
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
];

export const FILTER_RULE_TYPES: EnumOption[] = [
  { value: "blacklist", label: "Lista negra" },
  { value: "whitelist", label: "Lista blanca" },
];

// Pestanas de la vista Alertas del admin (una sola fuente para el tipo y los botones).
export const ALERT_TABS = [
  { value: "contact", label: "Contacto privado" },
  { value: "general", label: "Generales" },
  { value: "filters", label: "Filtros" },
] as const;
export type AlertTab = (typeof ALERT_TABS)[number]["value"];

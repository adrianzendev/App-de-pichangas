/** Ilustracion de un chat sin mensajes todavia (mano que saluda + globo + cancha). */
export function NoMessagesIcon() {
  return <img src="/brand/sin-mensajes.webp" alt="" width={140} height={120} className="h-28 w-auto" loading="lazy" decoding="async" />;
}

// Ilustracion del estado vacio "no hay partidos programados" (balon + calendario tachado). Un solo origen para el feed y Mis pichangas.
export function NoMatchesIcon() {
  return <img src="/brand/sin-partidos.webp" alt="" width={160} height={129} className="h-32 w-auto" loading="lazy" decoding="async" />;
}

// Correo (Resend), push (VAPID/Firebase), jobs de fondo y keepWarm solo corren en PRODUCCION.
// En local la base suele ser una copia de usuarios reales: un `npm run dev` con las claves del .env
// escribiria a personas de verdad. No hay forma de encenderlo fuera de produccion; en produccion viene
// encendido sin configurar nada, y `DISABLE_SIDE_EFFECTS=1` solo sirve para APAGARlo (p. ej. un staging).
export function sideEffectsEnabledFor(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production" && env.DISABLE_SIDE_EFFECTS !== "1";
}

export const sideEffectsEnabled = sideEffectsEnabledFor(process.env);

// Una linea al arrancar: si produccion arranca mal (p. ej. sin NODE_ENV), se ve de inmediato en los logs.
export function logSideEffectsStatus(): void {
  if (sideEffectsEnabled) return;
  const { NODE_ENV, DISABLE_SIDE_EFFECTS } = process.env;
  console.log(`[SIDE EFFECTS] OFF (NODE_ENV=${NODE_ENV ?? "sin definir"}${DISABLE_SIDE_EFFECTS === "1" ? ", DISABLE_SIDE_EFFECTS=1" : ""}) — correos, push y jobs desactivados`);
}

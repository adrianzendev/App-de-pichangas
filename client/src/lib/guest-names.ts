// Nombres de los acompañantes de una inscripcion. Se piden DESPUES de pagar (en el pase) y se guardan en el servidor.
export const GUEST_NAME_MAX = 60;

/** Nombres limpios y con el largo maximo. */
export const cleanGuestNames = (names: string[]) => names.map((n) => n.trim().slice(0, GUEST_NAME_MAX));

/** Estan completos los nombres de `count` acompañantes (ninguno vacio). */
export const guestNamesComplete = (names: string[] | undefined | null, count: number): names is string[] =>
  !!names && names.length === count && names.every((n) => n.trim() !== "");

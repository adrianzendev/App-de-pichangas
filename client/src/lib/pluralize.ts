/** "1 alerta nueva" / "3 alertas nuevas": concuerda sustantivo y adjetivo con el conteo. */
export function pluralizeEs(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

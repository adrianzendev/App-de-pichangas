/**
 * Breakpoints en JS. El valor sale de `--bp-*` en index.css (vite.config.ts lo inyecta en build),
 * el mismo origen que `sm:`/`md:`/`lg:`/`tablet:` en tailwind.config.ts.
 */
declare const __BP__: { sm: number; md: number; lg: number; xl: number; tabletMinHeight: number };

export const BP = __BP__;

export const MQ = {
  /** >= lg (escritorio) */
  lg: `(min-width: ${BP.lg}px)`,
  /** < md (movil) */
  belowMd: `(max-width: ${BP.md - 1}px)`,
  /** tablet vertical: 768-1023px de ancho y >= alto minimo */
  tablet: `(min-width: ${BP.md}px) and (min-height: ${BP.tabletMinHeight}px)`,
} as const;

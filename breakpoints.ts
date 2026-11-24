// Lee los breakpoints de client/src/index.css (--bp-*) para que tailwind.config.ts y vite.config.ts
// los consuman de ahi. Los media queries no aceptan var(), asi que se resuelven en build.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./client/src/index.css", import.meta.url), "utf8");
const px = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(\\d+)px`));
  if (!m) throw new Error(`index.css no define --${name}`);
  return Number(m[1]);
};

export const bp = {
  sm: px("bp-sm"),
  md: px("bp-md"),
  lg: px("bp-lg"),
  xl: px("bp-xl"),
  tabletMinHeight: px("bp-tablet-min-height"),
};

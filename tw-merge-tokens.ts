// Nombres de tokens de tailwind.config.ts (ya resueltos) para que `cn()` (tailwind-merge) los conozca.
// Sin esto, `cn("w-full", "w-dropdown-sm")` conserva las dos clases y gana la que va ultima en el CSS.
import resolveConfig from "tailwindcss/resolveConfig";
import loadConfig from "tailwindcss/loadConfig";
import { fileURLToPath } from "node:url";

const theme = resolveConfig(loadConfig(fileURLToPath(new URL("./tailwind.config.ts", import.meta.url)))).theme as unknown as Record<string, Record<string, unknown> | undefined>;
const keys = (name: string) => Object.keys(theme[name] ?? {}).filter((k) => k !== "DEFAULT");

export const twTokens = {
  spacing: keys("spacing"),
  w: keys("width"),
  h: keys("height"),
  "min-w": keys("minWidth"),
  "max-w": keys("maxWidth"),
  "min-h": keys("minHeight"),
  "max-h": keys("maxHeight"),
  "font-size": keys("fontSize"),
  rounded: keys("borderRadius"),
  shadow: keys("boxShadow"),
  z: keys("zIndex"),
  "border-w": keys("borderWidth"),
  duration: keys("transitionDuration"),
  tracking: keys("letterSpacing"),
  leading: keys("lineHeight"),
};

// Prepara las fuentes que `@capacitor/assets` necesita a partir del icono maestro:
//   assets/icon-master.png  (cuadrado, minimo 1024x1024; o assets/icon-master.svg)
//   assets/icon-foreground-master.png  (opcional: solo la marca con fondo transparente, para el icono adaptativo de Android)
// Genera en assets/: icon-only.png, icon-foreground.png, icon-background.png, splash.png.
// Despues: npx @capacitor/assets generate --iconBackgroundColor "#8B2FE0" --splashBackgroundColor "#F5F5F5"
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve("assets");
const BRAND_GREEN = "#8B2FE0"; // theme_color de la app (solo si el icono maestro tiene transparencia en la esquina)
const SPLASH_BG = "#F5F5F5"; // background_color de la app
const ICON = 1024;
const SPLASH = 2732;

const find = (names) => names.map((n) => path.join(dir, n)).find((p) => fs.existsSync(p));
const fail = (message) => {
  console.error(`✖ ${message}\n  Ver assets/README.md`);
  process.exit(1);
};

const master = find(["icon-master.png", "icon-master.svg"]);
if (!master) fail("Falta assets/icon-master.png (o .svg): el icono maestro cuadrado de 1024x1024.");

const meta = await sharp(master, { density: 300 }).metadata();
if (meta.width !== meta.height) fail(`El icono maestro debe ser cuadrado; mide ${meta.width}x${meta.height}.`);
if (master.endsWith(".png") && meta.width < ICON) fail(`El icono maestro mide ${meta.width}x${meta.height}; las tiendas piden 1024x1024. Escalarlo se ve borroso.`);

const square = () => sharp(master, { density: 300 }).resize(ICON, ICON);

// Color de fondo = el de la esquina del icono maestro, para que el fondo del icono adaptativo de Android y el icono se
// mezclen sin costura (el verde del icono real no es exactamente el theme_color).
const [r, g, b, a] = await square().extract({ left: 8, top: 8, width: 1, height: 1 }).ensureAlpha().raw().toBuffer();
const hex = (v) => v.toString(16).padStart(2, "0");
const BACKGROUND = a === 255 ? `#${hex(r)}${hex(g)}${hex(b)}` : BRAND_GREEN;

// iOS rechaza iconos con transparencia: se aplana sobre el verde de marca.
await square().flatten({ background: BACKGROUND }).png().toFile(path.join(dir, "icon-only.png"));

// Android adaptativo: la marca debe caber en el 66 % central (zona segura; el sistema recorta el resto).
const fgSource = find(["icon-foreground-master.png"]) ?? master;
const inner = Math.round(ICON * 0.66);
const fg = await sharp(fgSource, { density: 300 }).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({ create: { width: ICON, height: ICON, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fg, gravity: "center" }])
  .png()
  .toFile(path.join(dir, "icon-foreground.png"));

await sharp({ create: { width: ICON, height: ICON, channels: 3, background: BACKGROUND } }).png().toFile(path.join(dir, "icon-background.png"));

// Splash: icono centrado con esquinas redondeadas sobre el fondo de la app (sin modo oscuro: una sola version).
const logoSize = 640;
const round = Buffer.from(`<svg width="${logoSize}" height="${logoSize}"><rect width="${logoSize}" height="${logoSize}" rx="${Math.round(logoSize * 0.22)}"/></svg>`);
const logo = await sharp(master, { density: 300 }).resize(logoSize, logoSize).composite([{ input: round, blend: "dest-in" }]).png().toBuffer();
await sharp({ create: { width: SPLASH, height: SPLASH, channels: 3, background: SPLASH_BG } })
  .composite([{ input: logo, gravity: "center" }])
  .flatten({ background: SPLASH_BG })
  .png()
  .toFile(path.join(dir, "splash.png"));

console.log("✔ assets/icon-only.png, icon-foreground.png, icon-background.png y splash.png listos.");
console.log(`  Fondo del icono: ${BACKGROUND}`);
console.log(`  Siguiente: npx @capacitor/assets generate --android --iconBackgroundColor "${BACKGROUND}" --splashBackgroundColor "${SPLASH_BG}"`);

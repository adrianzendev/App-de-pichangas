// Genera favicon, iconos de la PWA, logo de la interfaz, logo del correo e icono maestro nativo a partir del logo de la marca.
// Uso: node scripts/generate-brand-assets.mjs <ruta-al-logo.png>
//   El logo debe ser un PNG cuadrado y de preferencia con fondo transparente (se recorta al contenido).
// Escribe en: client/public (favicons, iconos, logo-email), client/src/assets/logo-pichangas.png y assets/icon-master.png.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source || !fs.existsSync(source)) {
  console.error("Uso: node scripts/generate-brand-assets.mjs <ruta-al-logo.png>");
  process.exit(1);
}

const PUBLIC = path.resolve("client/public");
const SRC_ASSETS = path.resolve("client/src/assets");
const NATIVE = path.resolve("assets");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// Recorta el margen transparente: el logo ocupa todo el cuadro y se ve mas grande en iconos pequenos.
const trimmed = await sharp(source).trim().png().toBuffer();

/** Logo centrado en un cuadrado de `size`, con `pad` (0-0.5) de margen por lado y el fondo indicado. */
async function square(size, { pad = 0.06, background = CLEAR } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(trimmed).resize(inner, inner, { fit: "contain", background: CLEAR }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 });
}

const write = async (img, file) => {
  await img.toFile(file);
  console.log("✔", path.relative(process.cwd(), file));
};

// favicon.ico: contenedor ICO con imagenes PNG (16, 32 y 48 px).
async function writeIco(file) {
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map(async (s) => (await square(s, { pad: 0.02 })).toBuffer()));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // tipo: icono
  header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = pngs.map((png, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i], 0);
    e.writeUInt8(sizes[i], 1);
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  fs.writeFileSync(file, Buffer.concat([header, ...entries, ...pngs]));
  console.log("✔", path.relative(process.cwd(), file));
}

await writeIco(path.join(PUBLIC, "favicon.ico"));
await write(await square(16, { pad: 0.02 }), path.join(PUBLIC, "favicon-16.png"));
await write(await square(32, { pad: 0.02 }), path.join(PUBLIC, "favicon-32.png"));
// iOS rellena la transparencia con negro: el icono de pantalla de inicio va sobre blanco.
await write(await square(180, { pad: 0.1, background: WHITE }), path.join(PUBLIC, "apple-touch-icon.png"));
await write(await square(192, { pad: 0.05 }), path.join(PUBLIC, "icon-192.png"));
await write(await square(512, { pad: 0.05 }), path.join(PUBLIC, "icon-512.png"));
// Maskable: el sistema recorta hasta un 20% por lado; el logo va dentro de la zona segura (~70%) sobre fondo solido.
await write(await square(512, { pad: 0.15, background: WHITE }), path.join(PUBLIC, "icon-maskable-512.png"));

// Logo horizontal-ish para la interfaz y el correo: recortado, sin cuadrado.
await write(sharp(trimmed).resize({ width: 640 }).png({ compressionLevel: 9 }), path.join(SRC_ASSETS, "logo-pichangas.png"));
await write(sharp(trimmed).resize({ width: 600 }).png({ compressionLevel: 9 }), path.join(PUBLIC, "logo-email.png"));
await write(sharp(trimmed).resize({ width: 640 }).png({ compressionLevel: 9 }), path.join(PUBLIC, "logo.png"));

// Icono maestro de la app nativa (Capacitor, npm run assets:prepare): 1024x1024 opaco.
fs.mkdirSync(NATIVE, { recursive: true });
await write(await square(1024, { pad: 0.1, background: WHITE }), path.join(NATIVE, "icon-master.png"));

console.log("\nListo. Revisa index.html y manifest.json (nombre, colores) si cambia la marca.");

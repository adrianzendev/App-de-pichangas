// Reglas de campos/banner (CLAUDE.md "Campos de formulario" y "Banner + hoja") para archivos YA migrados.
// El resto del repo aun tiene deuda: al migrar una pantalla, agregarla a SCOPE.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SCOPE = [
  "client/src/components/pichangas",
  "client/src/components/publish",
  "client/src/components/sections/publish-section.tsx",
  "client/src/components/sections/student-home-hero.tsx",
  "client/src/components/ui/tutors-banner.tsx",
  "client/src/components/ui/input.tsx",
  "client/src/components/ui/password-input.tsx",
  "client/src/components/ui/form.tsx",
  "client/src/components/ui/textarea.tsx",
  "client/src/components/ui/select.tsx",
  "client/src/components/sections/account-section.tsx",
  "client/src/components/ui/combobox.tsx",
  "client/src/components/ui/datetime-field.tsx",
  "client/src/pages/change-password.tsx",
  "client/src/components/ui/list-screen.tsx",
  "client/src/components/ui/country-select.tsx",
  "client/src/components/profile",
  "client/src/components/sections/profile-section.tsx",
  "client/src/components/sections/tutor-profile-simple.tsx",
  "client/src/components/sections/orders-section.tsx",
  "client/src/components/ui/task-list.tsx",
  "client/src/components/ui/simple-task-card.tsx",
  "client/src/components/ui/task-detail-view.tsx",
  "client/src/components/ui/tutor-task-card.tsx",
  "client/src/components/auth",
  "client/src/components/chat",
  "client/src/pages/chat-fullscreen.tsx",
  "client/src/components/sections/messages-section.tsx",
  "client/src/components/sections/messages-desktop-split.tsx",
  "client/src/components/ui/unread-badge.tsx",
  "client/src/components/ui/filter-pills.tsx",
  "client/src/components/ui/presence-indicator.tsx",
  "client/src/components/ui/search-field.tsx",
  "client/src/components/ui/page-banner-sheet.tsx",
  "client/src/components/ui/star-rating.tsx",
  "client/src/components/ui/publish-fab.tsx",
  "client/src/components/ui/task-actions-menu.tsx",
  "client/src/pages/login.tsx",
  "client/src/pages/register.tsx",
  "client/src/pages/forgot-password.tsx",
  "client/src/pages/reset-password.tsx",
  "client/src/pages/activate-account.tsx",
  "client/src/components/ui/candidates-list.tsx",
  "client/src/components/ui/empty-state.tsx",
  "client/index.html",
  "client/src/components/sections/chat-section.tsx",
  "client/src/components/sections/profile-section.tsx",
  "client/src/components/sections/tutors-section.tsx",
  "client/src/components/sections/tutor-profile-content.tsx",
  "client/src/components/sections/featured-tutors.tsx",
  "client/src/components/ui/invite-tutor-modal.tsx",
  "client/src/components/ui/candidate-card.tsx",
  "client/src/components/ui/tutor-list-item.tsx",
  "client/src/components/ui/task-quick-view-dialog.tsx",
  "client/src/components/ui/expired-task-modal.tsx",
  "client/src/components/ui/hire-modal.tsx",
  "client/src/components/ui/pwa-install-banner.tsx",
  "client/src/components/onboarding-modal.tsx",
  "client/src/components/modals/push-notification-modal.tsx",
  "client/src/components/layout/header.tsx",
  "client/src/components/layout/bottom-navigation.tsx",
  "client/src/components/layout/sidebar-nav.tsx",
  "client/src/pages/change-password.tsx",
  "client/src/pages/auth-callback.tsx",
  "client/src/pages/home.tsx",
  "client/src/components/ui/rating-stars.tsx",
  "client/src/components/ui/chip.tsx",
  "client/src/components/ui/task-detail-panel.tsx",
  "client/src/components/ui/toast.tsx",
  "client/src/components/ui/toaster.tsx",
  "client/src/components/account",
  "client/src/components/sections/account-section.tsx",
  "client/src/components/layout/profile-menu-button.tsx",
  "client/src/components/ui/user-profile-selector.tsx",
  "client/src/pages/admin-dashboard.tsx",
  "client/src/components/admin",
  "client/src/components/ui/admin-table.tsx",
  "client/src/components/ui/metric-card.tsx",
];
const RULES = [
  [/placeholder:text-gray-\d+/, "placeholder: usar el token (ya viene de input/textarea)"],
  [/(?<![\w-])text-gray-500(?![\w-])/, "text-gray-500: usar text-gray-700 o text-muted"],
  [/coral-\d+/, "coral-*: usar error-bg/error-fg"],
  [/(?<![\w-])text-destructive(?![\w-])/, "text-destructive: usar text-error-fg"],
  [/(?<![\w-])(?:border|bg|text|ring|fill|stroke|from|to|via)-(?:green|emerald|coral|yellow|blue)-\d+/, "color del sistema anterior (verde/coral/amarillo/azul): usar primary-N (morado) o los estados success/warning/error/info"],
  [/(?<![\w-])border-(?:primary|success)(?![\w-])/, "border-primary/success: usar border-field o primary-N"],
  [/(?<![\w-])!(?:rounded|h|min-h|border)-/, "override !rounded/!h/!border: el campo ya trae su estilo"],
  [/mix-blend-multiply/, "mix-blend-multiply: recortar la imagen a alfa"],
  [/modal-overlay/, "modal-overlay: usar Dialog/AlertDialog (focus trap, Escape, role=dialog)"],
  [/px-4 sm:px-6/, "margen suelto px-4 sm:px-6: usar px-page-h"],
  [/user-scalable=no|maximum-scale=1(?![d.])/, "viewport: no bloquear el zoom (WCAG 1.4.4)"],
  [/style={{s*maxWidth/, "style maxWidth: usar max-w-content / max-w-container (o Container)"],
  [/[=!]==? ?1 ? ?['"`]/, "plural a mano: usar pluralizeEs (lib/pluralize.ts)"],
  [/[A-Za-zá-úñÁ-Ú]\.\.\.(?=["'`<}])/, "puntos suspensivos: usar … (un solo caracter)"],
  [/animate-pulse.*bg-gray-\d+|bg-gray-\d+.*animate-pulse/, "skeleton a mano: usar Skeleton (ui/skeleton.tsx)"],
  [/(?<![\w-])(?:bg-white|bg-card)(?![\w/-]).*hover:bg-gray-100|hover:bg-gray-100.*(?<![\w-])(?:bg-white|bg-card)(?![\w/-])/, "hover sobre superficie blanca: usar hover:bg-gray-50"],
];

function* files(p) {
  if (statSync(p).isDirectory()) { for (const f of readdirSync(p)) yield* files(join(p, f)); }
  else if (/\.(tsx?|css)$/.test(p)) yield p;
}
let bad = 0;
// <label> sin htmlFor que no envuelve el campo: el lector de pantalla no lo asocia (WCAG 1.3.1 / 4.1.2).
const CONTROL = /<(?:input|Input|select|textarea|Textarea|Select|Checkbox|Switch|PasswordInput|CountrySelect)\b/;
function unlabeled(src) {
  const lines = [];
  for (const m of src.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g)) {
    if (/htmlFor=/.test(m[1]) || CONTROL.test(m[2])) continue;
    lines.push(src.slice(0, m.index).split("\n").length);
  }
  return lines;
}
// <Button>/<button> con solo un icono y sin aria-label: sin nombre accesible (WCAG 4.1.2). Recorre llaves/comillas porque los atributos traen "=>".
function iconOnlyWithoutLabel(src) {
  const lines = [];
  for (const m of src.matchAll(/<(Button|button)\b/g)) {
    let i = m.index + m[0].length, depth = 0, q = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === "`") { q = c; continue; }
      if (c === "{") depth++; else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    const end = src.indexOf("</" + m[1] + ">", i);
    if (end < 0 || !/^\s*<[A-Z]\w+\b[^>]*\/>\s*$/.test(src.slice(i + 1, end)) || /aria-label/.test(src.slice(m.index, i + 1))) continue;
    lines.push(src.slice(0, m.index).split("\n").length);
  }
  return lines;
}
for (const root of SCOPE) for (const p of files(root)) {
  for (const n of iconOnlyWithoutLabel(readFileSync(p, "utf8"))) { console.error(`${p}:${n}: boton de solo icono sin aria-label`); bad++; }
  for (const n of unlabeled(readFileSync(p, "utf8"))) { console.error(`${p}:${n}: <label> sin htmlFor: asociarlo al campo (htmlFor + id)`); bad++; }
  readFileSync(p, "utf8").split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\{?\/\*|\*)/.test(line)) return; // comentarios
    for (const [re, msg] of RULES) if (re.test(line)) { console.error(`${p}:${i + 1}: ${msg}`); bad++; }
  });
}
// Pantallas de acceso (login, registro, recuperar/nueva/activar contraseña): sus piezas viven en components/auth.
const AUTH_FILES = [
  "client/src/components/auth",
  "client/src/pages/login.tsx",
  "client/src/pages/register.tsx",
  "client/src/pages/forgot-password.tsx",
  "client/src/pages/reset-password.tsx",
  "client/src/pages/activate-account.tsx",
];
const AUTH_RULES = [
  [/bg-green-50/, "caja de ayuda con fondo verde: las pantallas de acceso van sin adornos (AuthNotice: nota sin caja)", []],
  [/(?<![\w-])rounded-(?:md|lg|xl)(?![\w-])/, "radio suelto: usar rounded-control / rounded-full / el del componente", []],
  [/<h1\b/, "titulo a mano: usar AuthHeader (o AuthNotice pageTitle)", ["auth-header.tsx", "auth-notice.tsx"]],
  [/role="alert"/, "aviso de error a mano: usar AuthAlert", ["auth-alert.tsx"]],
];
for (const root of AUTH_FILES) for (const p of files(root)) {
  const name = p.replace(/\\/g, "/");
  readFileSync(p, "utf8").split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\{?\/\*|\*)/.test(line)) return;
    for (const [re, msg, allowed] of AUTH_RULES) if (re.test(line) && !allowed.some((a) => name.endsWith(a))) { console.error(`${p}:${i + 1}: ${msg}`); bad++; }
  });
}
// Pichangas (/play): espacios en la rejilla de 4px. 0.5/1.5/2.5/3.5 (2/6/10/14px) no existen en el sistema; py-0.5 y el desplazamiento
// optico negativo del punto de estado (-bottom-0.5/-right-0.5) son las unicas excepciones.
const GRID_FILES = ["client/src/components/pichangas", "client/src/pages/play.tsx", "client/src/pages/admin-play.tsx"];
const OFF_GRID = /(?<![\w-])(-?)(?:gap-x|gap-y|gap|space-x|space-y|px|py|pt|pb|pl|pr|p|mx|my|mt|mb|ml|mr|m|top|right|bottom|left|inset-x|inset-y|inset|size|h|w)-(?:0\.5|1\.5|2\.5|3\.5)(?![\w.])/g;
for (const root of GRID_FILES) for (const p of files(root)) {
  if (!/\.tsx$/.test(p)) continue;
  readFileSync(p, "utf8").split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\{?\/\*|\*)/.test(line)) return;
    for (const m of line.matchAll(OFF_GRID)) {
      if (/^py-0\.5$/.test(m[0]) || (m[1] === "-" && /-0\.5$/.test(m[0]))) continue;
      console.error(`${p}:${i + 1}: espacio fuera de la rejilla de 4px (${m[0]}): usar 1, 2, 3, 4...`); bad++;
    }
  });
}

// Pichangas (/play): botones y campos SOLO desde los controles del tema (night-controls.tsx, Button) o los archivos base de abajo.
// Escribir <button> o <input> a mano en una pantalla rompe la consistencia (alto, radio, foco, hover): usar NightInput, NightIconButton,
// NightLinkButton, NightTabs, NightNavButton o Button.
const RAW_ALLOWED = ["night-controls.tsx", "night-ui.tsx", "admin-ui.tsx", "venue-gallery.tsx", "match-cover-field.tsx"];
const RAW_CONTROL = /<(?:button|input|textarea|select)(?=[\s>])/;
for (const root of GRID_FILES) for (const p of files(root)) {
  const name = p.replace(/\\/g, "/");
  if (!/\.tsx$/.test(name) || RAW_ALLOWED.some((a) => name.endsWith(a))) continue;
  readFileSync(p, "utf8").split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\{?\/\*|\*)/.test(line)) return;
    if (RAW_CONTROL.test(line)) { console.error(`${p}:${i + 1}: control a mano: usar NightInput, NightIconButton, NightLinkButton, NightTabs, NightNavButton o Button`); bad++; }
  });
}
// Una sola fuente: en todo client/src, no solo en SCOPE (cubre pantallas y tablas nuevas).
for (const p of files("client/src")) {
  if (!/\.tsx$/.test(p)) continue;
  const name = p.replace(/\\/g, "/");
  readFileSync(p, "utf8").split("\n").forEach((line, i) => {
    if (!name.endsWith("ui/delete-button.tsx") && /<Trash2\b/.test(line)) { console.error(`${p}:${i + 1}: papelera a mano: usar DeleteIconButton, DeleteButton o AdminDeleteButton`); bad++; }
    if (!name.endsWith("ui/admin-table.tsx") && /<AdminTh\b[^>]*>\s*Acciones/.test(line)) { console.error(`${p}:${i + 1}: columna Acciones a mano: usar AdminActionsTh y AdminActionsTd`); bad++; }
  });
}

if (bad) { console.error(`\n${bad} violacion(es) de reglas de campos`); process.exit(1); }
console.log("check:field-rules OK");

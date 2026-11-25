// Falla si client/src consume estilo fuera de index.css + tailwind.config.ts.
// Excepcion puntual: comentario `token-ok: motivo` en la misma linea o archivo en ALLOW_FILES.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "client/src";
const ALLOW_FILES = new Set([
  "components/auth/google-auth-button.tsx", // colores de marca de Google
]);

const RULES = [
  [/#[0-9a-fA-F]{3,8}\b(?![^"'`]*\))/, "hex hardcodeado (usar token de index.css)"],
  [/\b(?:rgba?|hsla?)\(/, "rgb()/hsl() hardcodeado (usar var(--token))"],
  [/\b(?:bg|text|border|ring|fill|stroke|from|to|via|shadow)-\[(?:#|rgb|hsl)/, "color arbitrario Tailwind"],
  [/\btext-\[\d+(?:\.\d+)?px\]/, "tamano de texto arbitrario (usar text-heading/body/caption)"],
  // Cualquier utilidad con valor arbitrario `x-[...]` (data-/aria-/group-data-/has-/nth-/supports- son variantes, no valores).
  [/(?<![\w[-])(?!(?:data|aria|group-data|peer-data|group-aria|has|nth|supports)-|(?:group|peer)-\[)[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\[[^\]\s]+\]/, "valor arbitrario `x-[...]` (nombrarlo en tailwind.config.ts + index.css)"],
  [/fontSize:\s*\d/, "fontSize numerico inline"],
  [/style=\{\{[^}]*(?:color|background|backgroundColor)\s*:\s*["'`](?!var\(|inherit|transparent|currentColor)/, "color inline sin var(--token)"],
];

// Tipografia sobre la rejilla de 4pt: estas reglas valen para TODO client/src (no solo las pantallas migradas).
// Jerarquia: text-heading 24/28 (titulo de pantalla y montos destacados), text-subheading 20 (seccion y modal), text-body 16,
// text-label 14 (botones, chips, estados, etiquetas, descripciones de modal), text-caption 12. text-base solo en campos.
const TYPE_EXEMPT = new Set([
  "components/ui/user-avatar.tsx", // iniciales proporcionales al tamano del avatar
  "pages/styleguide.tsx", // muestra la escala fija a proposito
]);
const TYPE_RULES = [
  [/(?<![\w-])(?:[\w[\]&>*:.=-]+:)*text-(?:xs|sm|2xs|lg)(?![\w-])/, "tamano de texto fijo (usar text-caption 12, text-label 14 o text-body 16; text-base solo en campos)"],
  [/(?<![\w-])(?:[\w[\]&>*:.=-]+:)*leading-(?:tight|snug|normal|relaxed|loose)(?![\w-])/, "interlineado por proporcion, no multiplo de 4 (usar el del alias o leading-4..16)"],
  [/<(?:h1|h2|DialogTitle|AlertDialogTitle|SheetTitle)\b[^>]*(?<![\w-])text-(?:lg|xl|2xl|3xl|4xl|5xl)(?![\w-])/, "titulo con tamano display (usar text-heading o text-subheading)"],
];

// Reglas extra solo para las pantallas ya migradas (Inicio del alumno y sus componentes): al migrar otra, agregarla aqui.
const STRICT_SCOPE = new Set([
  "components/ui/admin-table.tsx",
  "components/sections/student-home-hero.tsx",
  "components/sections/featured-tutors.tsx",
  "components/ui/tutors-banner.tsx",
  "components/ui/page-banner-sheet.tsx",
  "components/ui/simple-task-card.tsx",
  "components/ui/task-list.tsx",
  "components/ui/task-actions-menu.tsx",
  "components/ui/tutor-identity.tsx",
  "components/ui/section-link.tsx",
  "components/ui/typing-caret.tsx",
  "components/ui/empty-state.tsx",
  "components/ui/presence-indicator.tsx",
  "components/sections/orders-section.tsx",
  "components/ui/order-summary.tsx",
  "components/ui/candidates-list.tsx",
  "components/ui/task-detail-panel.tsx",
  "components/ui/search-field.tsx",
  "components/ui/filter-pills.tsx",
  "components/ui/back-button.tsx",
  "components/ui/form-dialog.tsx",
  "components/ui/task-quick-view-dialog.tsx",
  "components/ui/tutor-list-item.tsx",
  "components/sections/tutors-section.tsx",
  "components/sections/tutor-profile-content.tsx",
  "components/sections/tutor-profile-simple.tsx",
  "components/ui/specialty-badges.tsx",
  "components/ui/rating-stars.tsx",
  "components/ui/filter-select.tsx",
  "components/ui/invite-tutor-modal.tsx",
  "components/ui/hire-modal.tsx",
  "components/sections/publish-section.tsx",
  "components/publish/campo-fila.tsx",
  "components/publish/file-source-dialog.tsx",
  "components/publish/inline-date-time-picker.tsx",
  "components/publish/success-dialog.tsx",
  "components/ui/combobox.tsx",
  "components/ui/spinner.tsx",
  "components/ui/chip.tsx",
  "components/sections/messages-section.tsx",
  "components/sections/messages-desktop-split.tsx",
  "components/layout/chat-split-layout.tsx",
  "components/chat/attachments/DocumentAttachmentCard.tsx",
  "components/chat/attachments/DocumentViewerModal.tsx",
  "components/chat/attachments/FileBadgeIcon.tsx",
  "components/chat/attachments/ImageAttachmentCard.tsx",
  "components/chat/attachments/MediaViewerHeader.tsx",
  "components/chat/attachments/MessageAttachment.tsx",
  "components/chat/attachments/PdfFloatingToolbar.tsx",
  "components/chat/attachments/PdfPreviewCard.tsx",
  "components/chat/attachments/SelectedFileChip.tsx",
  "components/chat/chat-icon-button.tsx",
  "components/chat/chat-list-row.tsx",
  "components/chat/ChatCanvas.tsx",
  "components/chat/ChatHeader.tsx",
  "components/chat/clickable-media.tsx",
  "components/chat/menu-actions.tsx",
  "components/chat/MessageBubble.tsx",
  "components/chat/MessageComposer.tsx",
  "components/chat/MessageList.tsx",
  "components/chat/MessageMenuActions.tsx",
  "components/chat/MessageMenuTrigger.tsx",
  "components/chat/QuoteCardMenu.tsx",
  "components/chat/ReplyQuote.tsx",
  "components/chat/TypingIndicator.tsx",
  "pages/chat-fullscreen.tsx",
  "components/sections/profile-section.tsx",
  "components/sections/account-section.tsx",
  "components/layout/profile-menu-button.tsx",
  "pages/change-password.tsx",
  "components/auth/auth-shell.tsx",
  "components/auth/role-tabs.tsx",
  "pages/login.tsx",
  "pages/register.tsx",
  "pages/forgot-password.tsx",
  "pages/reset-password.tsx",
  "pages/auth-callback.tsx",
  "pages/admin-dashboard.tsx",
  "components/admin/account-fields.tsx",
  "components/admin/admin-status-badge.tsx",
  "components/admin/agent-form-dialog.tsx",
  "components/admin/alert-card.tsx",
  "components/admin/scan-row.tsx",
  "components/admin/tutor-form-dialog.tsx",
  "components/admin/tutor-form-fields.tsx",
  "components/admin/user-form-dialog.tsx",
]);
const STRICT_RULES = [
  [/\b(?:h|w)-(?:3|3\.5|4|5|6|8|10|12) (?:h|w)-(?:3|3\.5|4|5|6|8|10|12)\b/, "icono con h-N w-N (usar size-icon-* / un token propio)"],
  [/style=\{\{[^}]*zIndex/, "z-index inline (usar la escala z-* o el orden del DOM)"],
  [/\bp-4 (?:sm|lg):p-6\b/, "relleno de tarjeta/hoja suelto (usar p-bento-pad / p-sheet-pad)"],
  [/(?<![\w-])-mt-7\b/, "solape de la hoja suelto (usar -mt-sheet-overlap)"],
  // text-base queda permitido: los campos de formulario van a 16px fijo (iOS no hace zoom al enfocar).
  [/\btext-(?:xs|sm)\b/, "tamano de texto fijo (usar text-body / text-caption)"],
];

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|jsx?)$/.test(f)) yield p;
  }
}

let bad = 0;
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (ALLOW_FILES.has(rel)) continue;
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("token-ok") || /^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const rules = [...RULES, ...(TYPE_EXEMPT.has(rel) ? [] : TYPE_RULES), ...(STRICT_SCOPE.has(rel) ? STRICT_RULES : [])];
    for (const [re, msg] of rules) {
      if (re.test(line)) {
        console.error(`${ROOT}/${rel}:${i + 1}: ${msg}`);
        bad++;
        break;
      }
    }
  });
}
if (bad) {
  console.error(`\n${bad} fuga(s) fuera de index.css/tailwind.config.ts`);
  process.exit(1);
}
console.log("check:tokens OK");

# Mil Tareas — Sistema de diseño

Versión: septiembre 2026. Reemplaza toda versión anterior de este archivo
(la de 2025 quedó obsoleta: Manrope, radios y colores que ya no
coinciden con el código real). Este documento se actualiza cada vez que
se toma una decisión nueva de diseño — es la fuente de verdad, junto
con `tailwind.config.ts` e `client/src/index.css`.

---

## 1. Tipografía

**Manrope** para todo: cuerpo, UI, etiquetas y títulos (tokens `2xs`–`5xl`). Se carga desde
Google Fonts en `client/index.html` (pesos 400 a 800, `display=swap`) y se declara una sola vez
como `--font-family` en `index.css`; `tailwind.config.ts` la lee con `var(--font-family)`.

### Escala (`tailwind.config.ts` → `theme.fontSize`)

| Token | rem / px | Fuente | Peso | Line-height | Letter-spacing |
|---|---|---|---|---|---|
| `2xs` | 0.6875 / 11 | Manrope | — (heredado) | normal | wide |
| `xs` | 0.75 / 12 | Manrope | — | normal | wide |
| `sm` | 0.875 / 14 | Manrope | — | normal | normal |
| `base` | 1 / 16 | Manrope | — | normal | normal |
| `lg` | 1.1875 / 19 | Manrope | — | normal | normal |
| `xl` | 1.4375 / 23 | Manrope | bold | snug | tight |
| `2xl` | 1.75 / 28 | Manrope | bold | snug | tight |
| `3xl` | 2.125 / 34 | Manrope | bold | tight | tighter |
| `4xl` | 2.875 / 46 | Manrope | extrabold | tight | tighter |
| `5xl` | 3.875 / 62 | Manrope | extrabold | tight | tighter |

**Importante:** `2xs`–`lg` (cuerpo/UI) **no** traen peso forzado en el
tamaño — el peso lo decide la clase `font-medium`/`font-semibold`/
`font-bold` de cada componente. (Se probó forzar `font-weight:500` en
`sm`/`xs`/`2xs` y el texto normal de toda la app se veía pesado —
revertido.) Solo los tamaños display (`xl`–`5xl`, títulos) llevan peso
propio, porque son un conjunto chico y siempre son títulos.

### Clases fontFamily (`tailwind.config.ts` → `theme.fontFamily`)

| Clase | Fuente | Uso |
|---|---|---|
| `font-sans` (default, no hace falta escribirla) | Manrope | cuerpo/UI, `2xs`–`lg` |
| `font-display` | Manrope | títulos, `xl`–`5xl` |

`font-sans`/`font-display` solo cambian la tipografía — el tamaño
sigue viniendo de `text-*` y el peso de `font-medium`/`font-bold`/etc.
Aplicar `font-display` explícitamente en cada título `xl`+; el token
de tamaño no lo hace automático.

`font-display` y `font-sans` apuntan a la misma fuente; `font-mono` usa `--font-mono`.

### Tokens atómicos (`index.css`)

```css
--fw-regular: 400;   --fw-medium: 500;   --fw-semibold: 600;
--fw-bold: 700;      --fw-extrabold: 800;

--lh-none: 1;        --lh-tight: 1.1;    --lh-snug: 1.3;
--lh-normal: 1.5;    --lh-relaxed: 1.625;
--lh-caption: 1rem;  --lh-subheading: 1.4;   /* alias de text-caption / text-subheading */

--ls-wide: 0.02em;   --ls-normal: 0;
--ls-tight: -0.01em; --ls-tighter: -0.02em;
```

**Regla:** nunca escribir `font-weight: 700` o `letter-spacing: -0.02em`
sueltos — usar `var(--fw-bold)`, `var(--ls-tighter)`, etc.

---

## 2. Color

Escalas reales en `index.css`, como HSL (no hex sueltos).

- **Marca:** `primary-50`…`primary-900` (hoy apuntan a `green-*`). `bg-primary` = 500;
  botones con texto blanco usan `bg-primary-600` (>=4.5:1), hover `primary-700`.
  Texto verde sobre fondo claro: `text-primary-600`; `text-primary` (500) solo en íconos.
  `green-*` queda para uso decorativo o datos.
- **Éxito y estados:** `success`, `warning`, `error`, `info`, cada uno con `-bg` y `-fg`
  (`bg-success`, `bg-success-bg`, `text-success-fg`).
- **Gris (texto/superficie):** `gray-0`…`gray-900`.
- **Estado:** `blue-*` (info/en progreso), `coral-*` (error/expirado),
  `yellow-*` (pendiente).

**Regla:** siempre tokens (`bg-primary`, `text-gray-700`, `bg-success-bg`) — nunca
`style={{color:'#59BC7A'}}` ni `text-[#hex]`. Las escalas por defecto de Tailwind están cerradas
(`red-*`, `slate-*`, `z-50`, `shadow-2xl` no existen). `bg-primary/10` (opacidad) funciona. Excepción real: logos de
marca de terceros (Google, en login/registro) van con su hex fijo.

`--destructive` (modo claro) = `coral-700` (antes apuntaba a
`gray-900` por error — un mensaje de error se veía negro, no rojo).

---

## 3. Espaciado

Escala base `space-1`(4px)…`space-24`(96px), más tokens estructurales
responsivos (mobile → desktop):

| Token | Mobile | Desktop |
|---|---|---|
| `card-pad` | 12px | 16px |
| `card-gap` | 12px | 16px |
| `page-h` | 16px | 24px |
| `section-gap` | 16px | 24px |
| `nav-h` | 56px | 64px |
| `grid-gap` | = `card-gap` | = `card-gap` |

**Regla:** el padding interno de una `<Card>` siempre es
`p-card-pad`, nunca `p-4`/`p-6` sueltos — así respira más en desktop
automáticamente.

---

## 4. Border radius

```
rounded-xs   2px   — detalles chicos
rounded-sm   8px
rounded-md  12px   — inputs, botones (DEFAULT)
rounded-lg  16px
rounded-xl  24px   — cards, modales (único radio de 24px, ya no hay
                      rounded-2xl duplicado — se eliminó del config)
rounded-card / rounded-sheet / rounded-modal — responsivos, ver index.css
rounded-full — avatares, pills
```

---

## 5. Sombras

`shadow-sm` / `md` / `lg` / `xl` (escala general) + `shadow-float` / `shadow-modal`
(responsivos, para capas flotantes: menús, popovers, modales). Las tarjetas Bento van **sin
sombra**: el componente `<Card>` no la trae.

---

## 6. Anchos de contenido

| Token | Valor | Uso |
|---|---|---|
| `--content-width` | 672px | bloques de lectura/bottom sheets |
| `--modal-width` | 400px | `Dialog`, `AlertDialog` |
| `--form-width` | 512px | formulario centrado (login, cambio de contraseña) |
| `--container-width` | 1080px | **ya no se aplica como límite global** |

**Decisión (septiembre 2026):** la app completa —alumno, tutor y
admin— usa **ancho completo de pantalla** en desktop. El límite de
1080px que existía antes (con admin como única excepción) se sacó por
completo del wrapper global (`home.tsx`, y el `@media` de `index.css`
que lo forzaba a nivel de `#root`). El token `--container-width` queda
definido por compatibilidad pero no se usa como cap de página; sí se
sigue usando puntualmente donde tenga sentido (ej. el ancho del
bottom-nav, que igual nunca llega a 1080px porque solo se ve
`<1024px`).

`Dialog`/`AlertDialog`: el ancho lo fija un `style={{maxWidth:...}}`
en línea — un `className="max-w-lg"` pasado desde afuera **no hace
nada** (el inline style siempre gana). No agregar `max-w-*` a
`DialogContent`/`AlertDialogContent` esperando que cambie el ancho.

---

## 7. Breakpoints

| Nombre | Rango | Prefijo Tailwind |
|---|---|---|
| Mobile | <768px | (sin prefijo, base) |
| Tablet | 768–1023px | `md:` |
| Desktop | ≥1024px | `lg:` |

**Regla:** mobile-first, escalar solo en `md:`/`lg:`. Nada de
`min-width` sueltos inventados al momento — si hace falta un tercer
corte, se agrega acá primero.

---

## 8. Tamaños de avatar y badge

**Avatar** (componente `UserAvatar`, prop `size` en px):
- `24` — chico, avatar inline en una card/lista compacta.
- `40` — mediano, fila de lista (mensajes, candidatos, chat) — el más usado.
- `64` — grande, poco usado por ahora.
- Foto de perfil "hero" (header de perfil propio): caso aparte, **sin
  cerrar todavía** — hoy conviven 80px (`favorites-section.tsx`) y
  100px (`profile-section.tsx`) para el mismo rol. Pendiente elegir uno.

**Badge / pastilla de estado:**
- `badge-sm`: `px-2 py-0.5 text-xs` (chips tipo "Nuevo", "Te invitaron").
- `badge-md`: `px-3 py-1 text-xs` (`StatusBadge`, estado de tarea).

---

## 9. Íconos

Librería: **lucide-react** (única, ~57 archivos). Tamaños en uso:
`16px` (acciones chicas: Check, X, botones) y `20px` (íconos de
card/feature, círculos informativos). Evitar tamaños sueltos tipo 14px
sin motivo — si el ícono cumple el mismo rol que otro ya definido,
usar su mismo tamaño.

---

## 10. Componentes

| Componente | Estado | Notas |
|---|---|---|
| `Card` | ✅ en uso | contenedor estándar, `rounded-xl` sin sombra |
| `Button` | ✅ en use | focus ring (`focus-visible:ring-2`), prop `isLoading` con spinner |
| `Input` | ✅ en uso | `h-11 rounded-lg border-gray-300` |
| `Textarea` | ⚠️ parcial | único textarea real de la app sigue crudo (`orders-section.tsx`) |
| `Select` | ✅ en uso | mismos tokens que `Input` |
| `FilterSelect` | ⚠️ parcial | tokens alineados a `Select`, pero el panel de opciones sigue siendo `<select>` nativo del navegador — para sacarlo del todo hay que reescribirlo sobre Radix |
| `Combobox` | ⚠️ patrón aparte | tercer patrón de "elegir opción" (input + búsqueda + panel propio), no es un bug, es un caso distinto (autocompletar) |
| `Checkbox` | ✅ en uso | conectado en admin-dashboard (antes native) |
| `Switch` real = `ToggleSwitch` | ✅ en uso | 3 pantallas; el primitivo Radix `switch.tsx` se borró (0 usos reales) |
| `RadioGroup` | ❌ sin uso | sigue sin conectar, no se tocó todavía |
| `DateTimePicker` | ✅ en uso | conectado a los `datetime-local` reales (chat, pedidos, admin) |
| Selector de solo fecha | ❌ nativo | 2 filtros de rango en admin siguen con `<input type="date">`, no existe componente de solo-fecha |
| `AdminTable` | ✅ en uso | 28/28 tablas del panel admin |
| `Dialog` / `AlertDialog` | ✅ en uso | mismo ancho (`--modal-width`), sin `max-w-*` muertos |
| `Sheet` (bottom sheet) | ✅ en uso | siempre `side="bottom"` + cap de ancho `--content-width` centrado |
| `components/ui/sidebar.tsx` (primitivo shadcn) | ❌ sin uso | ni admin ni la sidebar nueva lo usan — ambas están hechas a mano, más simples que el primitivo completo (que trae colapsable + cookie de estado, innecesario acá) |

---

## 11. Navegación

- **Mobile / tablet (<1024px):** barra fija abajo, `BottomNavigation`
  (ícono + label apilado, activo en verde).
- **Desktop (≥1024px):** barra lateral izquierda, ancho `256px`
  (`w-64`) — mismo valor en alumno/tutor y en admin (antes admin tenía
  224px, se unificó).
- Ambas vistas salen de la misma lógica de tabs/notificaciones en
  `bottom-navigation.tsx` — no hay lógica duplicada.

### Chat de dos columnas (solo desktop, `lg:`)

Mensajes (`messages-desktop-split.tsx`) e Inicio de alumno
(`chat-section-desktop-split.tsx`) usan el mismo patrón: lista fija a
la izquierda (ancho `--content-width`, 672px) + chat embebido a la
derecha, ambos visibles a la vez — estilo WhatsApp Web/Telegram
Desktop. En mobile/tablet (`<1024px`) se sigue navegando a
`/chat-fullscreen` pantalla completa, como siempre.

- `ChatFullscreenWorking` (en `chat-fullscreen.tsx`) acepta props
  opcionales `overrideParams` (`threadId`/`userId`/`userName`/`taskId`/
  `taskTitle`) y `embedded` — sin ellos se comporta igual que la ruta
  mobile de siempre.
- `MessagesSection` y `ChatSection` aceptan un callback opcional
  (`onSelectThread` / `onOpenChat`) — si viene, abrir una conversación
  selecciona en estado local en vez de navegar.
- **Excepción documentada:** en Inicio de alumno, la vista de
  candidatos de un pedido (varios tutores postulando) sigue siendo un
  overlay `fixed` a pantalla completa, decisión explícita — no se achicó
  a la columna de 672px. Elegir un candidato cierra ese overlay y abre
  el chat ya en la columna derecha.

### Shell de una sola pantalla en desktop (`lg:`)

En desktop, `Header` + sidebar + contenido ocupan exactamente `100vh`
— no hay scroll del documento completo, cada columna scrollea la suya
(`home.tsx`: wrapper raíz `lg:h-screen lg:overflow-hidden lg:flex
lg:flex-col`, el bloque bajo el Header `lg:flex-1 lg:min-h-0`, `main`
`lg:h-full lg:overflow-y-auto`). El sidebar (`bottom-navigation.tsx`) y
los split-view de chat (`messages-desktop-split.tsx`,
`chat-section-desktop-split.tsx`) usan `lg:h-full` para heredar esa
altura — nunca `h-screen` + `sticky` suelto ahí adentro, porque
`h-screen` mide el viewport completo sin descontar el alto del Header,
y el elemento termina más alto que la pantalla (bug real: aparecía un
scrollbar extra del tamaño del Header). En mobile/tablet (`<1024px`) se
mantiene el scroll normal de la página, sin este límite.

---

## 12. Estados de interacción

| Estado | Regla |
|---|---|
| Hover | un tono más oscuro del propio color (`hover:bg-green-700`, etc.) |
| Focus visible | `focus-visible:ring-2 focus-visible:ring-green-500` — nunca `outline-none` sin reemplazo |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` |
| Loading | mismo spinner (`Loader2` + `animate-spin`), vía prop `isLoading` de `Button` |
| Error (inputs) | `FormMessage` cambia a `text-coral-700` solo cuando hay error (antes quedaba gris siempre, error no se distinguía de un hint) |

---

## 13. Reglas rápidas (checklist antes de commitear)

- [ ] Colores: tokens (`bg-green-500`, `text-gray-700`), nunca hex suelto.
- [ ] Anchos: `--content-width` / `--modal-width` / `--form-width`, nunca `max-w-[Npx]` inventado.
- [ ] Tipografía: escala `2xs`–`5xl` ya definida, nunca `text-[13px]`.
- [ ] Radios: `rounded-xl` (24px) para cards/modales, no `rounded-2xl` (no existe más) ni valores sueltos.
- [ ] Card nueva → `<Card>` + `p-card-pad`, no `bg-white rounded-xl p-4` a mano.
- [ ] Badge nuevo → `badge-sm`/`badge-md`, avatar nuevo → 24/40/64.
- [ ] Control de formulario nuevo → `Input`/`Select`/`Checkbox`/`Textarea`/`DateTimePicker` del sistema, nunca `<input>`/`<select>` nativo sin estilo.
- [ ] Focus visible siempre presente en controles interactivos nuevos.

---

## Pendientes conocidos (no ocultar, corregir cuando se toque esa pantalla)

- `FilterSelect`: panel de opciones sigue siendo nativo del navegador.
- 2 filtros de fecha en admin (`type="date"`) sin componente de solo-fecha.
- `RadioGroup`: construido, cero uso real todavía.
- Foto de perfil grande: 80px vs 100px, sin resolver cuál es la oficial.
- `components/ui/sidebar.tsx` (primitivo shadcn): sigue sin usarse en ningún lado — candidato a borrar si nunca se conecta.

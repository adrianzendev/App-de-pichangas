# Mil Tareas

## Maquetacion: layout de 3 columnas en escritorio

Toda pantalla principal de escritorio (lista + detalle: Tutores, Mensajes,
Pedidos, etc.) usa `ThreeColumnLayout`
(`client/src/components/layout/three-column-layout.tsx`): sidebar (columna 1,
opcional) + lista/feed (columna 2) + detalle/accion (columna 3). No armar el
split a mano con flex/grid ad-hoc por pantalla — reusar el componente.

Internamente es un `grid grid-cols-12` (no flex) — sidebar/lista/detalle son
`col-span-N` sobre esas 12 columnas, elegidos por `preset`:
- `"list-heavy"` (default, Tutores): sidebar 2 / lista 7 / detalle 3.
- `"list-detail"` (Inicio, Publicar, Tutores y Pedidos, sin `readingColumn`: la lista usa todo el ancho de su columna): sidebar 2 / lista 6 / detalle 4. Sin sidebar en el grid (el shell ya lo pinta): 6/4 sobre 10 columnas (ver "Shell de escritorio").
- `"chat-heavy"` (Mensajes/Chat): sidebar 160-240px / lista fija 320-380px /
  chat activo `1fr` (plantilla `grid-cols-[...]` en `BP_CHAT_GRID`, sin `col-span`).

Props: `sidebar?`, `list`, `detail`, `showDetailOnMobile?`, `breakpoint?`
("md" default, "lg" para vistas embebidas en el shell de `home.tsx`), `preset?`.

Las clases de `col-span-N` y `{bp}:col-span-N` en el componente estan
escritas literales en una tabla (`BP_COLSPAN`), no armadas con interpolacion
(`` `col-span-${n}` ``) — Tailwind genera CSS escaneando texto estatico del
archivo; una clase interpolada en runtime no aparece en ese escaneo y no
genera nada (grid roto, sin error visible). Agregar un preset nuevo implica
agregar sus entradas completas a esa tabla, no una formula.

Altura fija y scroll interno (`h-dvh overflow-hidden` en la raiz, `h-full overflow-y-auto` en cada columna) existen SOLO desde el
breakpoint (tablas `BP_ROOT`/`BP_SCROLL`). Por debajo la pagina fluye en el documento: un solo scroll. Al pasar `className` a la raiz
usar prefijo (`lg:h-full`), nunca `h-full overflow-x-hidden` suelto: `overflow-x-hidden` fuerza `overflow-y: auto` y reabre el doble scroll.

Omitir `sidebar` cuando la vista ya se renderiza dentro del shell de
`home.tsx` (Header + `BottomNavigation` como sidebar en desktop) — pasar
sidebar ahi duplicaria la columna 1. Pasar `sidebar` solo en paginas
standalone que no pasan por ese shell (ver `dashboard-layout.tsx` para el
caso de `/tutor/:id` via URL directa, que en vez de esto reutiliza
Header+BottomNavigation existentes).

`breakpoint="lg"` es obligatorio para vistas embebidas en `home.tsx`: ese
shell solo se vuelve `flex`/`h-full` a partir de `lg` (1024px). Usar el
default `md` (768px) ahi rompe el rango tablet 768-1024px (mismo problema ya
visto en `profile-menu-button.tsx`: el header movil es `lg:hidden`, no
`md:hidden`).

Ejemplo: `tutors-section.tsx` (vista `/tutors`) — columna 2 es la lista
filtrable de tutores, columna 3 es `TutorProfileContent` del tutor
seleccionado (o estado vacio). Mobile/tablet (`<lg`) no usa
`showDetailOnMobile`: en su lugar navega a `/tutor/:id` (pagina standalone
con boton de regresar), porque esa es la UX que ya usa el resto de la app
para "ver detalle" en mobile.

### Excepcion: paneles CRUD de ancho completo (Admin)

`admin-dashboard.tsx` (`/dashboard/:section?`) NO usa `ThreeColumnLayout`
— es una excepcion deliberada, no deuda pendiente. (La ruta legacy
`/admin`, `admin-page.tsx`, se elimino — `/dashboard` cubre las mismas
secciones con mas funcionalidad.) Sus 13+ tablas de gestion (pagos, tareas, tutores, usuarios,
servicios, cursos, paises, etc., `minWidth` 1200-1400px cada una) son CRUD
de ancho completo sin concepto de "detalle" — no calzan con el split
lista(7/12)+detalle(3/12) del componente. Forzarlas ahi dejaria la columna
3 vacia (`detail={null}`) en las 16 secciones, desperdiciando ~30% del
ancho horizontal en tablas que ya necesitan scroll horizontal a ancho
completo. El shell propio (sidebar fijo `w-64` + `bg-gray-100` +
`AdminTable`/`AdminTableHead`/etc. de `admin-table.tsx`) ya cumple la
paleta y el estilo Bento (`bg-white rounded-xl`, sin sombra) sin necesidad
del componente — la excepcion es solo de estructura de columnas, no de
sistema de diseno visual.

`Container` (`client/src/components/ui/Container.tsx`) centra un ancho de
lectura fijo (`max-w-content`, 672px) por default — correcto para un feed
suelto directo en `<main>`, pero DOBLE-centra si va dentro de una columna de
`ThreeColumnLayout` mas ancha que 672px (crea un padding izquierdo extra que
desalinea el titulo/contenido respecto a otras vistas — bug real ya
encontrado en Inicio y Tutores). Pasar `fullWidth` a `Container` en
cualquier uso dentro de una columna de `ThreeColumnLayout`: sin eso, solo
`px-page-h` (mismo padding en todas las vistas), sin `mx-auto`/`max-w-content`.

### Shell de escritorio: grid real de 12 columnas

Desde `lg` el shell de `home.tsx` (`.shell-grid`) es `grid-cols-12` con `gap-6` y `px-6` dentro de `max-w-shell` (1400px): menu lateral
`col-span-2`, contenido `col-span-10`; en el Inicio del alumno contenido `col-span-7` + Tutores destacados (`HomeRightPanel`) `col-span-3`.
`ThreeColumnLayout` sin sidebar usa `lg:grid-cols-10 lg:gap-6` (list-heavy 7+3, list-detail 6+4, Mensajes lista 3 + chat 7), asi sus columnas caen exactas en las del shell.
Estilo X: sin cabecera de escritorio (logo arriba del menu, Publicar al final del menu, cuenta abajo); la columna central (`main`) lleva `border-x`,
y dentro de `.shell-grid` el margen de pagina (`--spacing-page-horizontal`) es de 24px desde `lg` (= el `gap-6`). El panel derecho son recuadros con borde (`FeaturedTutors`).
Menu lateral en pildoras (`SidebarNav pill`): fila `text-nav` (18px), activa en negrita sin fondo, hover `gray-50`; Publicar con `Button size="xxl"` (56px, 16px negrita).
En desarrollo, el boton "Columnas" (arriba a la derecha, `components/dev/grid-overlay.tsx`) dibuja las 12 columnas en rojo al 10%.

### Margen lateral de pagina: 16 / 24 / 32

El margen horizontal de las vistas es el token `--spacing-page-horizontal` (clase `px-page-h`, `Container`, y
`-mx-page-h` para el sangrado a borde en movil): **16px** en movil, **24px** desde 640px (`sm:`) y **32px** desde
768px (`md:`/`lg:`). No escribir `px-4 sm:px-6 md:px-8` suelto en cada pagina: usar `px-page-h`. Las hojas blancas
(`PageBannerSheet`, `StudentHomeHero`, `SHEET_CARD` de Publicar, `AuthShell`) usan relleno interno `p-4 sm:p-6` y
el titulo del `PageBanner` `left-4 sm:left-6`, para que el texto quede alineado con el contenido en cada tier.
`Container compact` (`px-card-gap`, 12/16px) es la excepcion: listas que deben aprovechar el ancho (Mensajes).

### Cabecera y envoltorio de las pantallas de lista (Inicio, Mensajes, Pedidos, Tutores)

Dos componentes, una sola fuente cada uno; no armar `<h1>` + buscador ni `<Container … py-page-top …>` a mano:
- `ListScreen` (`components/ui/list-screen.tsx`): envoltorio del contenido (`py-page-top`, `px-page-h` o `compact`, `space-y-section-gap`).
  El primer elemento arranca a la misma altura en todas las vistas (movil: x=16, y=24 bajo `h-safe-top`).
- `ListHeader` (`components/ui/list-header.tsx`): titulo + subtitulo + flecha de regreso, lupa que despliega el `SearchField` (en <lg; desde `lg`
  el campo va siempre visible en `PageBannerSheet`) y filtros (`FilterPills`). `PageBannerSheet hideBannerOnMobile` lo usa en <lg sin portada ni relleno propio.
Excepcion: Mensajes usa `ListScreen compact` (12px laterales) para que las filas del chat ganen ancho; su `ListHeader` lleva `px-1 sm:px-0` para
que el titulo caiga en x=16 como en Pedidos y Tutores.

### Tablet vertical (768-1023px): split de Mensajes

El shell de `home.tsx` sigue siendo "movil" por debajo de `lg` (Header + barra inferior), pero en
una tablet vertical (800x1280) Mensajes se ve mejor como lista + chat lado a lado. Para eso hay
una pantalla Tailwind propia, `tablet:` (`tailwind.config.ts`, variante `raw`: 768-1023px de ancho
Y >=600px de alto). El alto excluye celulares en horizontal (844x390), donde el split no cabe, y el
rango no se solapa con `lg:`, asi que `tablet:` y `lg:` nunca compiten por la misma propiedad.

- `ThreeColumnLayout` acepta `breakpoint="tablet"` (clases `tablet:` + `lg:` literales); lo usa
  `ChatSplitLayout`, que en tablet ocupa `100dvh - --safe-top - --spacing-bottom-nav` (el Header movil solo se muestra en Inicio; las demas vistas reservan `h-safe-top`).
- Los guards en JS usan `MESSAGES_SPLIT_QUERY` (`lib/layout-queries.ts`: `>=1024px` O tablet), igual que
  las clases: `messages-section.tsx` (no abrir /chat-fullscreen) y `chat-fullscreen-route.tsx`
  (redirigir /chat-fullscreen a /messages). Si se cambia la condicion, cambiar ambos lados.
- Solo Mensajes usa el split por ahora; el resto de vistas conserva el layout movil por debajo de `lg`.

### Regla de tercera columna

Todas las vistas principales (Inicio, Tutores, Mensajes, Pedidos) deben
mantener una alineacion estricta de 2/3 de ancho para el feed/contenido
principal (60%-65%, `preset="list-heavy"` = lista 7/10 columnas). En vistas
de dashboard sin detalle primario (como Inicio), la tercera columna derecha
permanece libre/reservada para modulos secundarios (ej. Asistente IA,
metricas o widgets) — no rellenar con contenido de relleno; pasar
`detail={null}`. Decision vigente: Inicio del alumno usa `<FeaturedTutors />` en esa
columna (`home.tsx`); es una excepcion deliberada, no relleno.

## Rutas: en ingles, con fuente unica

Las URLs estan en ingles (`/home`, `/orders`, `/jobs`, `/publish`, `/tutors`, `/messages`, `/profile`,
`/student-profile`, `/tutor-profile`, `/change-password`, `/account`); la UI sigue en espanol (las etiquetas viven
en las pestanas). Se definen en `client/src/lib/routes.ts` (`ROUTES`, `TAB`, `ROUTE_PATTERNS`): no escribir
literales de ruta en componentes. El id de pestana de `home.tsx`/`BottomNavigation` es el primer segmento de la URL.

- Las rutas antiguas en espanol (`LEGACY_ROUTES`) siguen como redirecciones del lado del cliente que conservan
  `:taskId`, la query y el hash: correos, push y atajos PWA ya emitidos las contienen. No borrarlas.
- No renombrar `/auth/callback`, `/reset-password` ni `/forgot-password`: estan en la lista de redirecciones de Supabase.
- Una ruta nueva: agregarla a `ROUTES`/`TAB` y a `App.tsx`; si reemplaza una existente, dejar la anterior en `LEGACY_ROUTES`.

## Direccion de diseno vigente: estilo WhatsApp (toda la interfaz, global)

A partir de ahora TODA la interfaz va por el estilo de WhatsApp: sobrio, limpio, con poco
"chrome" decorativo. Aplica a mobile, tablet y escritorio y a todos los roles (alumno, tutor,
admin). Ante cualquier conflicto con las reglas Bento de abajo, manda WhatsApp; Bento queda solo
como base de layout (canvas gris + tarjetas blancas sin sombra).

Reglas ya decididas (extender con el mismo criterio a pantallas nuevas):
- **Perfil / cuenta**: en el sidebar de escritorio el trigger es avatar `sm` + nombre truncado en una linea
  (`UserProfileSelector` con `showName`); en el header movil/tablet (`ProfileMenuButton`) solo el avatar. Sin borde,
  sin chevron, sin hover y sin tooltip. El nombre va tambien en `aria-label`.
  **Que abre**: un solo montaje por tamaño (`useMediaQuery(MQ.lg)` en `ProfileMenuButton`). Movil/tablet: la pantalla `/account`
  (`sections/account-section.tsx`, todo blanco, filas de 56px). Escritorio: popover blanco con `shadow-float` (unica sombra). Las acciones
  (Mi perfil, Cambiar contraseña, Centro de ayuda, Cerrar sesión) salen de `components/account/use-account-actions.ts`: no repetirlas en cada vista.
- **Burbujas del chat**: propia a la derecha en gris neutro (`bg-bubble-own`, token
  `--chat-bubble-own`, sin matiz verde), ajena a la izquierda blanca con borde (`BUBBLE_OTHER_SURFACE`: `--chat-bubble-other` + `border-border`), sobre el fondo blanco de `ChatCanvas`;
  colita arriba (`rounded-tr-xs`/`rounded-tl-xs`); padding `px-4 py-3`; hora (`text-caption`, peso normal) + checks dentro de la burbuja, sin sombra. Botones de solo icono del chat:
  `ChatIconButton` (40px, `aria-label` obligatorio). Un solo origen de estilos:
  `components/chat/chat-bubble-styles.ts` (chat y vistas de solo lectura, ej. admin).
- **Imagen con texto**: la burbuja mide el ancho de la imagen y el texto se ajusta a ese ancho
  (no ensancha la burbuja).
- **Lista de conversaciones**: filas a todo el ancho (sin tarjeta, esquinas ni divisor), avatar `mdl` (48px) + nombre + hora + ultimo mensaje en una linea, contador verde
  (`UnreadBadge`) a la derecha; fila abierta en gris suave (`bg-gray-50`, el mismo color del hover). Alto ~72px.
- **Radio de filas de lista (hover/seleccion)**: `rounded-md` (12px), no `rounded-xl`; no aplica a la lista de conversaciones (filas a ancho completo, sin radio). Una fila baja
  (~70px) con 24px de radio casi se vuelve capsula al resaltarse. El sistema no definia radio para
  filas de lista: este es el valor.
- **Contadores sobre iconos**: `UnreadBadge size="icon"`, siempre arriba a la derecha del icono.
- **Menos adornos**: sin bordes, sombras ni chevrons decorativos donde el color de fondo y el
  espacio ya separan; sin etiquetas redundantes. Iconos simples de una sola linea.
- **Color de marca**: verde solo como acento (acciones, contadores, estados activos), no como
  fondo de grandes superficies.

## Sistema de Diseno: Estilo Bento Grid UI

Toda vista o tarjeta nueva sigue metodologia Bento Grid: modulos
encapsulados independientes sobre canvas neutro, no bloques pegados con
divisores.

- Fondo de pantalla: canvas neutro (`bg-gray-100`, no blanco puro —
  `ThreeColumnLayout` ya lo trae por default).
- Tarjetas/modulos: blancos, flotan sobre ese canvas, bordes `rounded-lg` (16px; `Card`, `Dialog` y los avisos ya lo traen). Hojas con banner e
  imagenes del chat siguen en `rounded-xl` (24px). `tailwind.config.ts` no define `rounded-2xl`/`rounded-3xl`: no usarlos, no generan CSS.
- Separacion entre modulos: color de fondo (tarjeta blanca sobre canvas `bg-gray-100`) +
  espacio (`gap`), SIN sombra en las tarjetas (nada de `shadow-sm`/`shadow-md`/`hover:shadow-*`;
  el componente `Card` ya no la trae) y sin lineas divisorias (`border-b`, `divide-y`) agresivas.
  La sombra queda solo para capas flotantes (menus, popovers, modales, headers sticky).
- Padding interno holgado (`p-6`/`p-8`), no comprimido.
- Cada tarjeta es su propia unidad encapsulada — no un grid con celdas que
  comparten borde interno.

### Tarjetas dentro de modales

El modal ya es `bg-white`, asi que una tarjeta blanca sin borde no se distingue.
Agrupar controles (toggles, bloques de opciones) con
`bg-card rounded-lg border border-border p-card-pad` (tokens semanticos de `index.css`/`tailwind.config.ts`: `--card`, `--border`, `--spacing-card-padding`; no colores sueltos). No usar `bg-gray-100`
para tarjetas (es el color del canvas) ni `border-t`/`divide-y` para separar
bloques. Titulo del modal: `text-subheading font-semibold` y descripcion `text-label text-muted` (ya lo aplican `DialogTitle`, `AlertDialogTitle`, `SheetTitle`, `FormDialog` y `SidePanel`: no pasar tamano/peso por modal).
Ejemplo: modal "Editar tutor" en `admin-dashboard.tsx` ("Verificado", "Acceso General").

### Radios: tarjetas vs miniaturas

- Tarjetas/modulos: `rounded-lg` (16px). Imagenes grandes en burbujas: `rounded-xl` (24px).
- Miniaturas de archivo/imagen chicas (hasta ~100px: preview pre-envio del
  chat, filas de adjuntos, grilla de `/publish`, comprobante en hire-modal):
  `rounded-md` (12px). Un radio de 24px en 96px casi las vuelve un circulo.
- Miniaturas sin borde grueso: `bg-white shadow-sm` (Bento), no `border`.
  Si la imagen es un comprobante/captura, `object-contain` (no `object-cover`)
  para no recortar monto/fecha/operacion.

### Radios: burbujas de chat

- Burbuja de mensaje (texto, cita de cotizacion): `rounded-lg` (16px). No usar
  `rounded-sheet` (20-24px): en burbujas de una linea (~40px de alto) casi iguala
  la mitad de la altura y se ve como pildora, y empuja texto y flecha contra la curva.
- "Colita" en la esquina SUPERIOR: `rounded-tl-xs` (2px) en mensajes
  de la contraparte y `rounded-tr-xs` en los propios.
- Padding interno de texto: `px-4 py-3`. Documento solo e imagen sola van sin padding
  (`p-0 overflow-hidden`): la propia tarjeta/imagen es la burbuja.
- Recordatorio: `rounded-2xl`/`rounded-3xl` no existen en `tailwind.config.ts` (no
  generan CSS); los radios validos son `xs, sm, md, lg, xl, card, sheet, modal, full`.

### Campos de formulario

Reglas unicas para `Input`, `Textarea`, selectores de fecha y cualquier campo nuevo. Los componentes base
(`components/ui/input.tsx`, `textarea.tsx`) ya las traen: no se repiten ni se parchean con `!` en cada pantalla.

- **Etiqueta:** sobre el borde, de una sola fuente (`OUTLINED_LABEL`): `OutlinedControl` para campos sueltos y `OutlinedFormControl` (`ui/form.tsx`) con react-hook-form. Va sobre superficies blancas. Excepciones: controles que no son un campo (foto de perfil, `SpecialtiesPicker`, adjuntar comprobante).
- **Separacion entre campos:** token `field-gap` (32px, en `index.css`), `gap-field-gap` o `space-y-field-gap`, en pantallas y modales (`FormDialog` ya lo trae). Un campo y sus chips: `space-y-2`. No escribir `gap-4`/`space-y-4` sueltos entre campos.
- **Alto:** `h-field` / `min-h-field` (token `--field-height`, 48px). Barra de busqueda, selector de fecha y campos
  de monto usan el mismo alto.
- **Radio de campos:** token `rounded-control` (`--radius-control`, 12px; `Input` y `Textarea` lo traen). Excepcion con `rounded-full`: `SearchField`.
- **Radio de botones:** `rounded-full`, en la base de `Button` (`components/ui/button.tsx`). No pasarlo por `className` ni pisarlo por boton.
- **Otros radios con token:** miniaturas `rounded-thumb`, filas y celdas de lista/calendario `rounded-row`, hojas `rounded-sheet` (todos 12px salvo la hoja): no escribir `rounded-md`/`rounded-xl` sueltos en Publicar.
- **Texto:** `text-base` (16px fijo, tambien en escritorio). Menos de 16px hace que iOS haga zoom al enfocar.
  `text-body`/`text-caption` son para parrafos y metadatos, no para lo que se escribe. La regla base de
  `index.css` ("4. COMPONENTES - INPUTS") fija lo mismo para `<input>`, `<textarea>` y `<select>` sin clases, con
  `:where()` (especificidad cero): las utilidades ganan, por eso **no hacen falta overrides con `!`**.
- **Borde y fondo:** `border border-field bg-white` (gray-300). Sin sombra.
- **Placeholder:** `placeholder:text-muted` (gray-700), 16px; un boton o caja que imita un campo usa `FIELD_PLACEHOLDER` (`ui/input.tsx`). `gray-500` sobre blanco da ~2:1 y no se lee; no usarlo
  en texto (ni en placeholders ni en estados vacios).
- **Foco de campos:** borde `green-600` + halo `ring-2 ring-green-100`. **Foco de botones, chips y enlaces:**
  `focus-visible:ring-2 ring-ring ring-offset-2`. Nunca `outline` del navegador.
- **Hover de superficies clicables blancas**: **todas** (chips, selector de fecha y campos que se abren al tocarlos) `hover:bg-gray-50`: el verde se reserva para estados (seleccionado, campo completo con borde verde). `gray-50` y no `gray-100`, que es el color del canvas.
  `gray-100` solo sobre fondos de color o botones `ghost`.
- **Error:** un solo rojo (coral-700): borde `border-error` y mensaje `text-error-fg`; en Publicar, borde de 2px con `FIELD_ERROR` de `ui/input.tsx`, que manda sobre `FIELD_COMPLETE`. Texto sobre `bg-error-bg`: `text-error-strong`. (tokens `--error` / `--error-fg`), no `coral-*` suelto.
  Se muestran tras el primer intento de envio; el minimo de caracteres puede validarse en vivo.
- **Verde en estados:** `green-600` para texto de acento y borde de campo completo (2px, `FIELD_COMPLETE` de `ui/input.tsx`), `green-50` para fondos
  suaves. No mezclar los alias `primary-*` / `success` con la escala `green-*` dentro de una misma pantalla.
- **Obligatorio / opcional:** los obligatorios llevan asterisco (`<span aria-hidden className="text-error-fg">*</span>`)
  y `aria-required`; los opcionales, "(opcional)" en `text-gray-700 font-normal`.
- **Objetivo tactil:** minimo 40px de alto en acciones secundarias (`h-10`); 44-48px en la accion principal. En Publicar, `Chip compact` se ve
  de 28px, pero su zona tactil (`before:`) mide 40px: sus filas usan `COMPACT_CHIP_ROW` (`gap-y-3`).
- **Chips seleccionables:** `aria-pressed` con el estado. Un boton que parece deshabilitado debe estarlo
  (`disabled`); si debe seguir activo para validar, se mantiene con su estilo normal.
- **Una sola fuente de opciones:** listas repetidas (p. ej. plazos de entrega) viven en una constante compartida.
- **Chequeo automatico:** `scripts/check-field-rules.mjs` (parte de `npm run check:tokens`) prohibe en los archivos ya migrados: `placeholder:text-gray-*`, `text-gray-500`, `coral-*`, alias `primary-N`, `border-primary/success`, overrides `!rounded-/!h-/!border-`, `mix-blend-multiply`, skeleton a mano (`animate-pulse` + `bg-gray-*`) y `hover:bg-gray-100` sobre `bg-white`/`bg-card` en la misma linea. Solo mira la lista `SCOPE` del script (publicar, Inicio del estudiante, banner, input/textarea, `components/auth` y las paginas de auth); al migrar una pantalla, agregarla ahi.

### Banner + hoja (cabecera de pantallas de entrada)

Login, registro, recuperar contrasena, Inicio del estudiante y Publicar abren con un banner de imagen y una
hoja blanca de esquinas redondeadas que sube sobre el: `TutorsBanner` (`components/ui/tutors-banner.tsx`) +
la hoja `-mt-7 rounded-t-xl bg-white shadow-float` (ver `AuthShell`, `StudentHomeHero` y `publish-section.tsx`).

- **Sombra:** la hoja es una capa que se superpone a la imagen, por eso es la unica "tarjeta" con
  `shadow-float` (token de capas flotantes). El resto de tarjetas va sin sombra.
- **Fondo del banner:** degradado `from-white to-green-100` (tokens, sin imagen de fondo). Es la unica excepcion
  a "NO gradients" de `index.css`.
- **Imagen por pagina:** `TutorsBanner` acepta `src`, `alt` e `imageClassName`. `imageClassName` REEMPLAZA la
  posicion/escala por defecto (`origin-bottom object-bottom scale-125 md:scale-110`). El Inicio usa `md:scale-95`
  para que el subtitulo no toque las cabezas.
- **Imagen transparente** (PNG/WebP con alfa, ej. `publish-student-banner.webp`): se apoya abajo y la hoja tapa los pies. Si llega con fondo blanco, recortarlo a alfa (flood-fill desde los bordes con `sharp`) en vez de usar `mix-blend-multiply`, que ensucia las zonas blancas del sujeto.
- **Titulo/saludo:** va dentro del banner (`absolute`). En movil, si la imagen lo tapa, correrla (`translate-x-16`).
- **Margen negativo:** si el contenedor usa `space-y-*`, el `-mt-7` de la hoja se pisa; usar `!-mt-7`
  (`SHEET_CARD` en `publish-section.tsx`).

### Paleta oficial de tokens

La escala `gray-*` es 100% neutra (saturacion 0, sin matiz verdoso): el verde solo vive en `green-*`.

- Canvas / fondo global: `bg-gray-100` (neutro Bento).
- Tarjetas/modulos: `bg-white` + `rounded-lg` (16px), sin sombra.
- Bordes de inputs/selects/textareas: `border-field` (token `--border-field`, = gray-300); no `border-gray-300` suelto.
- Bordes: `border-gray-200` (o `border-slate-200/60` para tarjetas Bento
  con padding holgado, ver tarjetas de campo en `/publish` y `/tutors`).
- Verde marca (primary): `green-500` (base) / `green-600` (primary-dark,
  estados activos/seleccionados).
- Textos: `gray-900` (titulos) / `gray-700` (cuerpo, muted).

Prohibido usar paletas stock de Tailwind ajenas al sistema (`emerald-*`,
`slate-*` como color, no como el uso puntual de borde arriba) en
componentes de marca o estados activos/seleccionados — generan CSS (estan
disponibles porque `colors` esta bajo `extend` en `tailwind.config.ts`,
sin purgar los defaults) pero introducen un segundo verde/gris en paralelo
a la escala `green-*`/`gray-*` ya definida, la inconsistencia visual que
esta regla evita. Usar siempre `gray-*`/`green-*` de la config.

### Tipografia: tokens responsivos para titulos y parrafos

Titulos y texto de parrafo usan los alias responsivos de `tailwind.config.ts`
(`fontSize`, valores desde CSS vars en `index.css`). **Rejilla 4pt: toda altura de linea es multiplo de 4px**
(`--lh-N`, utilidades `leading-4`..`leading-16`; el resto de `leading-*` de Tailwind no existe). Solo el titulo
cambia de tamano (breakpoint 768px):

- `text-heading` — titulo de pagina y montos destacados: 24px / linea 32px en movil, 28px / 36px desde 768px (+ `font-bold`).
- `text-subheading` — titulo de seccion y de modal u hoja (`Dialog`, `AlertDialog`, `Sheet`): 20px / 28px (+ `font-semibold`).
- `text-body` — parrafo e inputs: 16px / 24px.
- `text-caption` — metadata, etiquetas de la barra inferior y notas: 12px / 16px.
- `text-nav` (18px / linea 24px) — SOLO las filas del menu lateral de escritorio (`SidebarNav` con `pill`, estilo X); no usarlo en otra parte.
- `text-label` (14px / linea 20px, `font-medium`) — botones, chips, estados (`Badge`), plazos, etiquetas de campo y descripciones de modal u hoja (son metadatos de apoyo, no lectura larga). Ya lo traen `Button`, `Chip`, `FilterPills` y `Badge`.
- Mensajes de error y ayuda de un campo: `text-caption` (12px), igual en Publicar y en Perfil.
- **Montos destacados** (precio en `hire-modal`, cotizacion en el chat, pedido asignado): `text-heading font-bold`. Un solo token, no `text-xl`/`text-3xl`.

**Cinco niveles en una pantalla** (Inicio del alumno es el ejemplo vivo; no inventar un sexto tamano):

| Nivel | Token | Peso | Ejemplo |
|---|---|---|---|
| Titulo de pagina | `text-heading` | bold | "Hola, Carlos" |
| Titulo de seccion | `text-subheading` | semibold | "Ultimos pedidos", "Tutores destacados" |
| Titulo de item / cuerpo | `text-body` | semibold / normal | titulo del pedido, nombre del tutor (`TutorIdentity`) |
| Accion y estado | `text-label` | medium | `Button`, `Chip`, `Badge` ("Vencido", "Republicar") |
| Metadata | `text-caption` | normal | tiempo restante, profesion (`tutorTypography`) |

Pesos permitidos: bold (titulo de pagina), semibold (secciones, items y enlaces), medium (botones, chips, estados y navegacion), normal. Los enlaces de
cabecera de seccion ("Ver todos") son siempre `SectionLink`. Un componente que ya trae su tamano (`Chip`, `Badge`, `Button`) no se pisa con `text-sm`/`text-xs`/`text-label`.

**Escala fija** (`tailwind.config.ts`, toda en la rejilla): `text-xs` 12, `text-sm` 14, `text-base` 16, `text-xl` 20, `text-2xl` 24,
`text-3xl` 28, `text-4xl` 36, `text-5xl` 48 (sin `clamp()` fluidos). En la interfaz se usan los ALIAS, no estos: `text-sm`, `text-xs`,
`text-2xs` y `text-lg` estan prohibidos (usa `text-label` / `text-caption`; `text-2xs` y `text-lg` ya no existen). `text-base` queda
solo para campos de formulario (16px fijo, iOS no hace zoom). `text-xl`..`text-5xl` son display (emojis, ilustraciones), nunca en
`h1`/`h2`/`DialogTitle`. Interlineado: solo el de los alias o `leading-4`..`leading-16`; `leading-tight/snug/normal/relaxed` estan
prohibidos (no dan multiplos de 4). `check:tokens` lo vigila en TODO `client/src` (excepciones: `user-avatar.tsx`, iniciales
proporcionales al avatar, y `styleguide.tsx`, que muestra la escala). Nunca `text-[Npx]`
ni `fontSize` numerico inline. En graficos recharts (props `tick`/
`contentStyle`, que no aceptan clases) usar `fontSize: "var(--text-caption)"`;
en `<tspan>` usar `className="text-heading"`/`text-caption`. Unicos
`fontSize` calculados permitidos: el proporcional al tamano de
`user-avatar.tsx` (iniciales) y `inherit`.

### Componentes unicos: presencia y pildoras

No armar a mano lo que ya tiene componente (ver ejemplos vivos en `/styleguide`):

- **Estado de conexion** (punto y/o "En línea" / "Hace 5 min"; sobre un avatar, `className={PRESENCE_ON_AVATAR}`): `PresenceIndicator`
  (`client/src/components/ui/presence-indicator.tsx`). Props: `showLabel`, `hideDot`, `size`,
  `isOnline`, `lastSeen`. El calculo del "hace cuanto" es `getTimeAgo` en `lib/connection-utils.ts`.
- **Adjuntar archivos**: `AttachField` (`components/ui/attach-field.tsx`): borde punteado, icono y texto centrados. `onClick` abre el selector de la pantalla; `htmlFor` enlaza un `<input type="file">`.
- **Avatares**: `UserAvatar` (`components/ui/user-avatar.tsx`) con tokens de tamano `size="2xs"` (20, celdas de tabla densas), `"xs"` (24, inline con el nombre), `"sm"` (32), `"md"` (40, default), `"mdl"` (48, filas de tutores), `"lg"` (64), `"xl"` (100). Solo tokens (el tipo no acepta px sueltos); para un tamano nuevo, agregarlo a `AVATAR_SIZES`.
- **Pildoras / chips** (estados, roles, especialidades): `Badge` (`components/ui/badge.tsx`):
  `rounded-full`, `text-label font-medium`, variantes `outline` (blanca con borde, la de las
  especialidades), `success`, `neutral`, `info`, `secondary`, `default`, `destructive`.
  Nada de `<span className="rounded-… px-… py-…">` sueltos ni overrides de tamano/peso.
  Estados con color usan `Badge variant="outline"` + clases de borde/texto (ver `StatusBadge`).
- **Especialidades del tutor**: `SpecialtyBadges` (usa `Badge`; `max` limita a una linea con `+N`).
- **Calificacion (solo lectura)**: `RatingStars` (`components/ui/rating-stars.tsx`): 5 estrellas con media estrella, o `compact` ("★ 4.8") para filas densas.
  Para ELEGIR una nota esta `StarRating` (selector). No repetir el `clipPath` ni usar `fill-primary`: las llenas son `yellow-500`.
- **Chips / atajos**: `Chip` (`components/ui/chip.tsx`, `rounded-full` h-10; `compact` solo en el formulario de Publicar: `rounded-chip` 6px, h-7, `text-caption`). Con `active` es seleccionable (`aria-pressed`); sin `active` es una accion.
  Los filtros de estado son `FilterPills` (chips sueltos con `Chip`; todo `Chip active`, tambien en Publicar, es borde verde y texto en negrita sobre blanco). No armar `<button className="rounded-full border …">` sueltos.
- **Papelera**: `DeleteIconButton` (solo icono) y `DeleteButton` (con texto, modales) en `components/ui/delete-button.tsx`; rojo fijo (`text-error-fg`). `check:field-rules` falla con un `<Trash2>` fuera de ese archivo, en todo `client/src`.
- **Columna País de tablas admin**: `AdminCountryTd` (`admin-table.tsx`). Acepta codigo o nombre y muestra siempre el nombre, sin bandera (Windows las pinta como letras); sin pais, "—".
- **Columna Acciones de tablas admin**: `AdminActionsTh` + `AdminActionsTd` (`admin-table.tsx`), al final y alineada a la derecha; dentro, `AdminRowAction` (icono, `label`, `tone`, siempre con tooltip), `AdminDeleteButton` o `RowActions` (`components/admin/row-actions.tsx`). Si la fila termina en texto o `Badge`: `endsWithIcon={false}`. `check:field-rules` falla con `<AdminTh>Acciones` a mano.
- **Panel de detalle de pedido** (candidatos, vistas): `TaskDetailPanel` (`components/ui/task-detail-panel.tsx`), overlay `fixed` a `max-w-container`; el contenido va en
  `<div className="mx-auto max-w-content">` (no `style={{ maxWidth }}`). `inlineOnDesktop` lo deja en su columna desde `lg:`.
- **Avisos (toast y push)**: un solo componente, `toast()` de `hooks/use-toast.ts` (se pinta en `<Toaster />`; piezas en
  `components/ui/toast.tsx`). No armar tarjetas flotantes propias con `fixed`/`z-toast`. Tarjeta blanca `rounded-lg` con `shadow-modal`
  y circulo de icono segun el estado: `variant` omitido = informativo (`green-50`), `"success"` = exito, `"destructive"` = error.
  `icon` cambia el icono (p. ej. `Bell`). Si el aviso pide una decision: `action` = `<ToastAction altText="…">` (boton verde, `altText`
  obligatorio) y `cancel` = `<ToastCancel>` (secundario, solo cierra). Sin `action` no hay botones: los avisos de "ya paso" solo llevan
  la X. Sale uno a la vez (`TOAST_LIMIT = 1`); un aviso con decision usa `duration: Infinity` para quedarse hasta que el usuario decida
  (ejemplo vivo: `components/modals/push-notification-modal.tsx`). Posicion: movil sobre la barra inferior, escritorio abajo a la derecha.

### Estados de pantalla y componentes unicos (alumno)

No armar a mano lo que ya tiene componente:

- **Vacio**: `EmptyState` (`components/ui/empty-state.tsx`): icono + titulo + descripcion + `action`. Nada de `<p text-center>` sueltos.
- **Carga**: `Skeleton` (`components/ui/skeleton.tsx`) dentro del mismo `Container fullWidth` que el contenido real. Nada de `animate-pulse` + `bg-gray-200` a mano.
- **Error de carga**: si el `useQuery` principal da `isError`, `EmptyState` con `action={<Button onClick={() => refetch()}>Reintentar</Button>}`. Nunca skeleton infinito.
- **Volver**: `BackButton` (`components/ui/back-button.tsx`, 40px, `aria-label="Volver"`). No `<button><ArrowLeft/></button>`.
- **Modales**: `Dialog`/`AlertDialog`, nunca `.modal-overlay` (sin focus trap ni Escape; `check:field-rules` lo prohibe).
- **Un solo montaje por breakpoint**: no renderizar dos vistas y ocultar una con `hidden`/`lg:hidden` (queries y testids duplicados). Usar `useMediaQuery` (`MESSAGES_SPLIT_QUERY`, `MQ.lg`) y montar una.
- **Espacio bajo el contenido en movil**: lo pone `MAIN_BASE` de `home.tsx` (`pb-bottom-nav`). Las secciones NO repiten `pb-bottom-nav` ni `min-h-screen` (si no, doble espacio y scroll con listas vacias).
- **Accesibilidad**: elementos clicables que no son `<button>` llevan `role="button"`, `tabIndex={0}`, Enter/Espacio y anillo de foco (ver `TutorListItem`, `SimpleTaskCard`); filtros/chips con `aria-pressed`; nav con `aria-current="page"`; botones de solo icono con `aria-label`; zoom del viewport nunca bloqueado.
- **Textos**: "pedido" (no "tarea") como termino unico; plurales con `pluralizeEs` (`lib/pluralize.ts`); fechas con `lib/date-format.ts`; puntos suspensivos `…`; rating con un decimal.
- `check:field-rules` vigila la lista `SCOPE` (ya incluye casi todas las pantallas del alumno): al migrar un archivo, agregarlo.

## Modulo de mensajes y adjuntos del chat

Los componentes del chat (burbuja, tarjetas de adjuntos, visores de imagen/PDF, menu de
acciones, responder/citar) viven en `client/src/components/chat/` y se importan desde su
API publica (`@/components/chat`, `@/components/chat/attachments`), nunca desde archivos
internos. Catalogo por fases, props, ejemplos y recetas de reuso:
`client/src/components/chat/README.md`. Para sumar una accion de mensaje o un tipo de
archivo, seguir las recetas de ese README (un solo punto de edicion por cambio).
Tiempo real, Optimistic UI (`setQueryData` antes de `invalidateQueries`, `unreadCount = 0`
al instante) y latencia del backend: seccion "Tiempo real y baja latencia" de ese mismo README.

## Autenticacion y contrasenas

Reglas de seguridad vigentes (`server/auth-security.ts`; pruebas: `npx tsx --test tests/auth-security.test.ts`):
- **No existe contrasena por defecto.** `createUser` sin clave deja `users.password = NULL` (igual que Google) y la columna no tiene
  `DEFAULT` (migrations/024). Antes toda cuenta creada por el admin recibia `123456`: 138 de 190 cuentas la tenian. `/api/auth/login`
  rechaza `123456` aunque coincida con el hash. `passwordProblem()` (minimo 6, lista de claves comunes) se aplica en registro,
  activacion, cambio de contrasena y `PATCH /api/admin/users/:id/password`.
- **Un solo error de login**: "Correo o contraseña incorrectos" para cuenta inexistente, clave incorrecta, cuenta de Google o sin
  activar (no revela que correos existen; siempre se corre un scrypt para igualar tiempos). Los bloqueos de cuenta (403) solo
  aparecen con la clave correcta.
- **Limitacion de intentos** (en memoria: vale con UNA sola instancia; ver "Escalar a varias instancias" abajo): login 8 fallos por IP+correo y
  40 por IP cada 15 min; registro 10/h; pedir enlace 5/h por IP+correo y 20/h por IP; activar 10 y cambiar contrasena 10 cada 15 min.
- **Definir o restablecer contrasena = enlace de un solo uso por correo (Resend)**: `POST /api/auth/request-activation` (respuesta
  siempre igual) y `POST /api/auth/activate`, pagina `/activate-account?token=`. En la base solo se guarda el SHA-256 del token
  (`users.activation_token_hash`), vence a las 24 h y se canjea en un solo UPDATE. Las cuentas que crea el admin (agente, tutor,
  alumno) sin clave reciben ese correo; `/forgot-password` usa el mismo flujo y sirve tambien para cuentas sin cuenta en Supabase.
- **Escalar a varias instancias (pendiente, anotado 2026-10-21)**: los contadores de `server/auth-security.ts` viven en la memoria de cada
  proceso; con N instancias el limite real seria N veces mayor y se reinicia al desplegar. Al escalar: agregar Redis,
  `npm i rate-limit-redis ioredis` y pasar `store: new RedisStore({ sendCommand: (...args) => redis.call(...args) })` a cada
  `rateLimit({...})` (un `prefix` distinto por limitador). Mismo cambio para el dedupe de `error-logger.ts` si importa entre instancias.
- **El registro guarda la contrasena elegida** (antes la ignoraba y quedaba la de por defecto).
- Datos personales: `GET /api/tutors` y `/api/tutors/:key` solo devuelven el perfil publico (`server/tutor-public.ts`); el correo,
  WhatsApp, IP y similares salen unicamente por `/api/admin/*`. `res.json` oculta `password` y los campos de activacion.
- Pendiente de datos: las 138 cuentas con el hash viejo siguen en la base (el login ya las rechaza). `scripts/invalidate-default-passwords.ts`
  las deja en NULL (simulacro por defecto, `--apply` para escribir).

## Impersonacion del super admin ("Ver como")

`server/superadmin.ts` + reglas puras en `server/superadmin-rules.ts` (pruebas: `npx tsx --test tests/impersonation.test.ts` y `npm run test:e2e:impersonation`, que se niega a correr fuera de la rama dev). Decision vigente: **solo ver**.
- Auditoria: `/dashboard/audit` (`GET /api/admin/audit-log`, solo el super admin con su propia sesion; sin rutas para editar ni borrar). Las lecturas de chats y pagos se registran como `read`, una vez cada 10 min por ruta (`shouldAuditRead`).
- Toda escritura se bloquea por defecto (403), tambien perfil y pedidos. Una ruta nueva queda bloqueada sola; si es un POST que no escribe, agregarla a `ALLOWED_WHILE_IMPERSONATING`.
- Efectos de abrir algo (marcar leido, descargado, vistas) van en `SILENT_WHILE_IMPERSONATING`: responden OK sin escribir.
- Iniciar y terminar exigen mismo `Origin` (la cookie es `SameSite=None` en produccion).
- Vence a los 30 min (`IMPERSONATION_MAX_MS`): el servidor vuelve a la cuenta del admin y el banner limpia el estado local. "Cerrar sesión" tambien vuelve al admin. Todo cierre registra `impersonate_end` con `detail.reason`.
- Cambiar de cuenta recarga las demas pestanas (`BroadcastChannel` en `lib/impersonation.ts`). Sin WebSocket: el chat consulta cada 30 s (`chatPollInterval`).
- `registerSuperadmin` debe seguir antes de cualquier otra ruta `/api`.
- Exige la tabla `superadmin_audit_log` (migrations/025): sin ella no inicia ("No se pudo registrar la auditoría"). El servidor la crea al arrancar si falta (`AUDIT_TABLE_DDL`). `npm start` no aplica el resto de migraciones: hay que correrlas a mano tambien en la base de produccion.

## Registro de errores del servidor (panel de admin > Errores)

Tabla `error_logs` (migrations/023) + `server/middleware/error-logger.ts`. Se ve en `/dashboard/errors` (solo administrador;
`GET /api/admin/error-logs` y `PATCH /api/admin/error-logs/:id` responden 401/403 al resto). Captura en tres capas:
- `errorCapture` (middleware, despues de la sesion): registra TODA respuesta 5xx al terminar. Casi todos los endpoints atrapan su
  error y responden 500 sin llamar a `next(err)`, asi que recupera el `Error` real que el endpoint imprimio con `console.error`
  (AsyncLocalStorage) y, si no hay, el mensaje del JSON. Para que el stack llegue al registro, el `catch` debe hacer
  `console.error("[METODO /ruta] error:", error)` (el objeto, no `error.message`) antes de responder 5xx: todos los de
  `server/routes.ts` ya lo hacen y `scripts/check-catch-logging.mjs` (parte de `check:tokens`) falla si aparece uno sin imprimir.
- `errorHandler` (`next(err)`) y `installProcessErrorLogging` (excepciones no capturadas y promesas rechazadas, nivel `critical`).
- `logError({ error, req, level })`: registro manual desde cualquier endpoint. Nunca lanza.
Antes de guardar, `redact()` quita correos, JWT, secretos, cadenas de conexion y numeros de 9+ digitos; la ruta se guarda sin query
string; el mismo error en la misma ruta no se repite durante 1 minuto. 4xx y 404 no se registran. No guardar cuerpos de peticion.
Niveles: `error` (5xx), `warning` (manual), `critical` (proceso).
Adjuntos que fallan en el telefono (archivo vacio de Drive/OneDrive, sin permiso, envio del chat cortado o rechazado con 4xx) nunca
llegan al servidor como error: el cliente los reporta con `reportAttachmentFailure()` (`lib/report-attachment-failure.ts`) a
`POST /api/client-errors/attachment` y quedan como `warning` con metodo `CLIENTE`, nombre/peso del archivo y usuario (columna Usuario
del panel). Motivos y texto en `shared/attachment-failure.ts`. Los 5xx del envio no se reportan desde el cliente (ya los registra el servidor). Pruebas: `npx tsx --test tests/error-logger.test.ts`.

## Despliegue en Vercel

Guia completa y variables: `docs/DESPLIEGUE_VERCEL.md` y `.env.example`. Resumen: `vercel.json` ejecuta `scripts/build-vercel.mjs`, que arma `.vercel/output`
(cliente estatico + el servidor de Express empaquetado con esbuild como funcion, entrada `server/vercel-handler.ts`). Con `VERCEL` definido el servidor
no abre puerto ni WebSockets (sin presencia en linea), las tareas programadas van por `/api/cron/jobs` (exige `CRON_SECRET`), el disco es de solo
lectura (las subidas exigen R2) y las migraciones de arranque solo corren con `RUN_MIGRATIONS=1`. No construir en Windows para `--prebuilt`: sharp trae
binarios nativos de Linux. Nunca versionar cookies, `uploads/` ni `.env`: el repositorio es publico.

## Levantar servidor local (Windows / Git Bash)

`npm run dev` funciona en Windows. El script es
`cross-env NODE_ENV=development tsx --env-file=.env server/index.ts`:
`cross-env` (devDependency) resuelve `VAR=valor cmd` en cmd.exe, y
`--env-file=.env` (loader nativo de Node) carga el `.env` sin pasar por shell.

No cargar `.env` con `source .env` — `DATABASE_URL` contiene
`&channel_binding=require` sin comillas. Bash interpreta ese `&` como
operador de background: corta el valor ahi, la asignacion real queda en un
subshell y no persiste al shell padre. Resultado: `DATABASE_URL must be set`
aunque el archivo tenga el valor correcto.

`NODE_ENV=development` debe ir explicito: `server/routes.ts` compara
`process.env.NODE_ENV === 'development'` literal (`app.get("env")` en
`server/index.ts` si cae a `development` por defecto, pero esa comparacion no).

```bash
npm run dev
```

Sirve en `http://localhost:5000`. Si falla con `EADDRINUSE`, queda un
servidor viejo en el puerto 5000 (matar el proceso que lo escucha:
`netstat -ano | grep :5000` + `taskkill //PID <pid> //F`).

## PWA / service worker en dev

El proyecto registra un `service-worker.js`. Si el navegador muestra pantalla
blanca (root sin hijos) pero no hay error en consola ni en red, probar antes
de asumir bug de codigo:

1. `location.reload()` real desde consola del tab (no solo el tool de
   navegacion del agente — puede quedarse en bfcache de un intento previo,
   p.ej. de un intento previo cuando el server todavia no habia levantado).
2. Si sigue en blanco: `navigator.serviceWorker.getRegistrations()` +
   `unregister()` + `caches.keys()` + `caches.delete()`, despues recargar.

## Testing UI / E2E / IndexedDB

Playwright es herramienta oficial para pruebas de UI, flujos E2E, y
verificacion de IndexedDB (persistencia de cache de React Query, etc).
Instalado como devDependency permanente (`npm install -D playwright` +
`npx playwright install chromium`).

Patron para verificar IndexedDB (no hay `chromium-cli` ni otro driver de
navegador en este entorno):

```js
const { chromium } = require('playwright');
const browser = await chromium.launch();
// viewport movil: header con data-testid="header-profile" solo
// renderiza en mobile (`lg:hidden` en header.tsx) — en desktop el menu
// de perfil vive en el sidebar (`role=complementary`), hay 2 elementos
// con el mismo testid, usar `.first()`.
// Sesion de prueba SIN contrasena: dev-login (solo desarrollo; 404 en produccion). La clave "123456" ya NO inicia sesion.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await ctx.request.post('http://localhost:5000/api/auth/dev-login', { data: { email: 'miltareaslatam@gmail.com' } });
await page.goto('http://localhost:5000/orders', { waitUntil: 'networkidle' });
// leer IndexedDB via page.evaluate() con indexedDB.databases() +
// transaction/getAll — ver historial de conversacion para script completo.
```

Scripts de prueba van con extension `.cjs` (repo tiene `"type": "module"`,
`require()` no funciona en `.js` plano) y se borran despues de usarlos —
no se commitean scripts de verificacion puntual.

Cuentas de prueba: Cliente `miltareaslatam@gmail.com`, Tutor `adrianchoquehuancahuaraya@gmail.com`.
**Su contrasena `123456` ya no inicia sesion** (bloqueada en el servidor desde 2026-10-21, ver "Autenticacion y contrasenas"):
en pruebas se entra con `POST /api/auth/dev-login` `{ email }` (patron de arriba). Los limites de intentos son por IP + correo y se
reinician al reiniciar el servidor.

`al1@miltareas.com` / `al2@miltareas.com` (las que define
`server/seed-data.ts`) NO existen en la base de `.env`: el seed se salta
si ya hay algun usuario (`seedDatabase`, lineas 8-11), y esa base ya esta
poblada. No usarlas en scripts de prueba.

La base de `.env` es una Neon (`neondb`) compartida con datos reales
(~180 usuarios), no una base de desarrollo aislada. No registrar cuentas
nuevas desde pruebas E2E: el registro escribe ahi y ademas llama a
`supabase.signUp`, que deja un usuario en Supabase Auth imposible de borrar
desde el codigo. Si una prueba crea una cuenta, borrarla al terminar.

## Resuelto: rebote intermitente a /login tras autenticar

Sintoma: tras login exitoso (`/api/auth/login` 200), la app navegaba
brevemente fuera de `/login` y rebotaba de vuelta, sin ningun llamado de
red visible entre medio (no era un 401 nuevo).

Causa raiz real (confirmada leyendo `login.tsx` + `queryClient.ts` +
`App.tsx`, reproducida y verificada con Playwright — la sospecha inicial de
"invalidacion de sesion" o "401 sin retry" era secundaria, no la causa
dominante):

`login.tsx` hacia `queryClient.clear()` seguido de un **hard reload**
(`window.location.href = '/'`). El `clear()` dispara una escritura a
IndexedDB via `PersistQueryClientProvider`, pero esa escritura esta
throttled (~1000ms, ver `@tanstack/query-async-storage-persister`). El
reload duro no espera ese flush: la pagina nueva rehidrata desde
IndexedDB la snapshot **anterior al login** (el `/api/user/current` = null
que la propia pagina de `/login` habia cacheado *antes* de autenticar), y
como cae dentro del `staleTime` (5 min), React Query la sirve como "fresca"
sin refetch. `home.tsx`/`admin-dashboard.tsx` ven `currentUser === null` al
instante y redirigen a `/login` — de ahi el rebote sin ninguna llamada de
red visible.

Fix (`client/src/pages/login.tsx`, tanto `loginMutation.onSuccess` como
`handleTestLogin`): sin reload. `queryClient.clear()` +
`queryClient.setQueryData(["/api/user/current"], data.user)` +
`setLocation(...)` (wouter, client-side). Al no recargar, no hay
restauracion desde IndexedDB que pueda pisar el estado recien logueado.

Ademas, se endurecieron dos puntos por las dudas (no eran la causa
dominante, pero son fragiles igual):
- `server/routes.ts` (`/api/auth/login` y `/api/auth/dev-login`): si
  `req.session.save()` falla, ahora responde 500 en vez de 200 silencioso
  (antes solo loggeaba el error y seguia).
- `client/src/lib/queryClient.ts` (`getQueryFn`): un 401 en
  `/api/user/current` hace un reintento con 400ms de espera antes de
  resolver `null` — antes un 401 transitorio era indistinguible de logout
  real y el `retry: 1` global nunca aplicaba (solo reintenta en throw, no
  en resolve).

Verificado con Playwright: 5 logins secuenciales + 8 en paralelo (fresh
`browser.newContext()` cada uno, cuentas reales Cliente/Tutor alternadas),
0/13 rebotes post-fix (antes del fix de `login.tsx`: 5/5 secuenciales
rebotaban).

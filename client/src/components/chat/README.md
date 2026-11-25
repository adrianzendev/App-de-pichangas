# Modulo de mensajes y adjuntos del chat

Catalogo de los componentes del chat, **ordenado por fases** (de lo mas basico a lo mas
compuesto). Cada fase solo depende de las anteriores. Todo se importa desde la API
publica:

```ts
import { MessageAttachment, DocumentViewerModal, buildChatAttachments } from "@/components/chat";
// o solo adjuntos:
import { FileBadgeIcon } from "@/components/chat/attachments";
```

> Regla: no importar archivos internos (`.../attachments/DocumentAttachmentCard`) desde
> fuera del modulo; usar los `index.ts`. Asi se puede reorganizar por dentro sin romper
> a nadie.

## Convenciones

| Tema | Regla |
|---|---|
| Nombres | Componentes en `PascalCase.tsx`; utilidades, hooks y tipos en `kebab-case.ts`. |
| Props | Cada componente exporta su `XxxProps` y lleva JSDoc (`@param`, `@returns`). Sin `any`. |
| Colores | Solo la paleta del proyecto: `green-*` (marca) y `gray-*`. Nada de `emerald-*`/`slate-*`. Excepcion: insignias por tipo de archivo (rojo/azul/verde). |
| Radios | `rounded-md` miniaturas, `rounded-lg` burbujas, `rounded-xl` tarjetas. `rounded-2xl`/`3xl` **no existen** en `tailwind.config.ts`. Ver `CLAUDE.md`. |
| Clases Tailwind | Siempre literales completas (nunca `` `col-${n}` ``): Tailwind solo genera CSS de texto estatico. |
| Tamano de tarjeta | Documento: ancho fijo `w-chat-doc max-w-full` (token `--chat-doc-width`, 320px). Imagen: 300px (280px con texto) y alto maximo 320px, constantes `CHAT_IMAGE_*` de `attachment-utils.ts`. |
| Idioma | UI y comentarios en espanol. |

## Tiempo real y baja latencia

### Flujo de datos (arquitectura hibrida)

- **Envio: HTTP.** `POST /api/chat/send` (multipart). No hay envio por WebSocket, asi que no existe
  una cola de mensajes salientes que se quede esperando una reconexion.
- **Recepcion y presencia: WebSocket.** `useWebSocketFixed` (`hooks/useWebSocketFixed.ts`) es el
  **unico** hook de WS: singleton, un socket por pestana, conectado desde el shell (`home.tsx`).
  Trae `new_message`, `messages_read`, `presence_update`/`presence_bulk` y `typing_*`. El servidor
  (`server/presence-system.ts`) autentica el socket con la cookie de sesion y reenvia cada evento
  solo a los participantes (`sendToUser`).
- **Ping/pong y reconexion.**
  - Servidor: ping WS cada 30 s; el socket que no responde se termina (zombie).
  - Cliente: heartbeat cada 45 s. Al volver a primer plano (`visibilitychange`) manda un heartbeat
    y el servidor responde `{"type":"pong"}`; **sin pong en 2.5 s** el cliente descarta el socket y
    reconecta de inmediato. Cubre el movil que vuelve de segundo plano con un socket "OPEN" ya muerto.
  - Tras reconectar emite `websocket_reconnected`: el chat invalida sus queries para traer lo perdido.
  - No cerrar el socket ni mandar `presence_leaving` al perder foco: tumba la presencia y la entrega.

### Optimistic UI (0 ms) y React Query

REGLA: toda actualizacion de UI a partir de un evento WS o de un envio va por
`queryClient.setQueryData` (sincronico, sin red) **antes** de cualquier `invalidateQueries`. Un
invalidate dispara un GET sin garantia de orden; uno que ya vuela con datos viejos puede pisar al nuevo.

| Dato | Como se actualiza al instante |
|---|---|
| Mensaje propio | Fila `temp-…` al enviar; `onSuccess` la reemplaza por la real. El eco WS del propio mensaje no se agrega (evita duplicado). |
| Mensaje ajeno | `new_message` lo agrega a la lista del chat abierto con el mensaje completo del WS. |
| Preview de la lista | Parche de `["/api/chat/threads"]` (ultimo mensaje, hora, orden). |
| `unreadCount` | Chat abierto y visible = leido: `clearThreadUnread()` en `chat-fullscreen.tsx` pone `unreadCount = 0` en el cache **antes** del POST de mark-read, y hace `cancelQueries` para que un GET en vuelo no lo pise. `messages-section.tsx` no incrementa ni invalida el hilo activo. El badge de la barra de navegacion (`["/api/chat/last-messages"]`, clave `${taskId}-${idA}-${idB}`) se limpia igual en la misma funcion; `bottom-navigation.tsx` hace un solo refetch por `new_message` y chat-fullscreen (que corre despues) lo cancela. |
| Doble check verde | `messages_read` (lo emite el servidor en `mark-read`, antes de responder el HTTP) pinta `readAt` en el cache del emisor. |

Invalidar `["/api/chat/threads"]` (siempre `exact: true`) solo para: hilo aun no cacheado (primer
mensaje a un contacto nuevo), mensaje ajeno en un hilo que NO esta abierto, y **despues** del POST de
mark-read para reconciliar con el server. Invalidar antes del mark-read trae el `unreadCount` viejo y
pega el badge, la negrita y la hora verde unos segundos.

### Backend (`POST /api/chat/send`)

- Lecturas iniciales en un solo `Promise.all`: `getTaskBasic`, `getUserById` y `findThreadByPair`
  (el hilo no depende de quien es alumno/tutor; se omite con `admin-001`, que usa otro par).
- `createChatMessage`: `insert` del mensaje y `update` del preview del hilo en `Promise.all`.
- Respuesta sin esperar trabajo secundario: push, email, escaneo de contacto y `logActivity` son
  fire-and-forget.
- **Presencia: un solo socket.** Todo consumidor usa `useWebSocketFixed` (`onlineUsers`/`isUserOnline`). `PresenceIndicator` sin prop `isOnline` lee ese singleton, asi que `UserAvatar showPresence` funciona sin cablear nada. El hook viejo `usePresence` (segundo socket y `presence_leaving` al desmontar) se elimino: no volver a crearlo.
- `last_seen`: el middleware ya no hace `await updateUserLastSeen` en cada request; escribe en segundo
  plano y a lo sumo 1 vez cada 30 s por usuario. La presencia en vivo sale del WS, no de esa columna.
- Referencia de costo: cada consulta a Neon cuesta un viaje de red (~150 ms desde un equipo de
  desarrollo remoto, mucho menos con servidor y BD cercanos). Menos viajes seriales = menos latencia.

---

## Fase 0 — Contrato de datos (backend y `shared/`)

Todo lo visual depende de estos datos. Una fila de `chat_messages` trae arrays **paralelos**:
el adjunto `i` tiene ruta `attachments[i]`, nombre `attachmentNames[i]` y peso
`attachmentSizes[i]` (bytes; `0` = desconocido).

| Columna (`chat_messages`) | Para que |
|---|---|
| `attachments text[]` | Rutas (`/objects/uploads/<uuid>`). Sin extension. |
| `attachment_names text[]` | Nombre original (`informe.pdf`). Vacio en mensajes antiguos. |
| `attachment_sizes integer[]` | Peso en bytes. |
| `reply_to_id varchar` | FK a otro mensaje (`ON DELETE SET NULL`). |

Las columnas nuevas se crean solas al arrancar el servidor (`server/index.ts`, migraciones
idempotentes `ADD COLUMN IF NOT EXISTS`).

**Endpoints**
- `POST /api/chat/send` (multipart): acepta `files`, `message`, `receiverId`, `taskId`,
  `replyToId`. Valida que el citado sea de la misma conversacion (400 si no). Devuelve el
  mensaje con `replyTo` embebido.
- `GET /api/chat/threads/:id/messages` y `GET /api/chat/messages/:taskId/:otherUserId`:
  devuelven `{ messages, hasMore, tasks }`; cada respuesta lleva `replyTo`.
- `GET /api/chat/threads`: cada hilo trae `lastMessage` (texto ya resuelto) y
  `lastMessageKind` (`image` | `file` | `null`) para el icono.

**Helpers compartidos — `shared/chat-preview.ts`** (usables en cliente y servidor)

| Export | Uso |
|---|---|
| `chatPreviewText(message, attachments, names, kind?)` | Texto de vista previa: el texto del usuario, `"Foto"`, o el nombre del documento. |
| `chatAttachmentKind(attachments, names)` | `"image"` \| `"file"` \| `null` (desconocido). |
| `ReplyPreview` | Forma de la cita embebida: `{ id, message, senderId, senderName, attachments, attachmentNames }`. |
| `ATTACHMENT_PLACEHOLDER` | Texto guardado cuando se envia un adjunto sin mensaje. |

**Tipo de UI — `chat-types.ts`**: `Message` (fila + `status` optimista + `replyTo`).

---

## Fase 1 — Primitivas

Piezas pequenas sin logica de negocio.

### `FileBadgeIcon`
Cuadro de color por tipo de archivo (Excel verde "X", Word azul "W", PowerPoint rojo "P",
PDF rojo "PDF", otros gris con icono).

| Prop | Tipo | Notas |
|---|---|---|
| `extension` | `string` | Con o sin punto, cualquier caso: `"pdf"`, `".XLSX"`. |
| `size` | `"sm" \| "md"` | `sm` 32 px (chips), `md` 48 px (tarjetas). Default `md`. |

```tsx
<FileBadgeIcon extension="xlsx" size="sm" />
```

### `ViewerIconButton`
Boton de icono de la barra de los visores (20 px, blanco tenue). Props: `icon`, `label`, `onClick`.

### Utilidades
- `formatFileSize(bytes)` — `@/lib/file-url-utils`: `< 1 MB` en KB, si no en MB con un decimal.
- `fileExtension(name)` — extension en mayusculas (`"informe.pdf"` → `"PDF"`).

---

## Fase 2 — Tarjetas de adjuntos

Las tarjetas no deciden el tipo: lo decide `buildChatAttachments` y las pinta el selector.

### Resolucion de tipo — `attachment-utils.ts`

| Funcion | Que hace |
|---|---|
| `buildChatAttachments(msg, failedImages, probes?)` | Devuelve **un `ChatAttachment` por ruta** (`path`, `url`, `name`, `size`, `kind`). Todos los adjuntos pasan por aqui. |
| `resolveAttachmentKind(path, name, failed, probe?)` | `image` \| `pdf` \| `document`. Con nombre manda la extension; sin nombre, el `probe`; mientras tanto se intenta como imagen. |
| `probeAttachment(url)` | `HEAD` al adjunto para leer su `Content-Type` (cache por URL). Solo para mensajes sin nombre original. |

`ChatAttachment.kind === "image" \| "pdf" \| "document"`.

### `DocumentAttachmentCard`
Tarjeta de documento: insignia, nombre (2 lineas), `EXT • PESO`, hora en la misma fila,
barra `Abrir | Guardar como...` 50/50.

| Prop | Notas |
|---|---|
| `name`, `size?` | Metadatos (`FileMetaProps`). |
| `isCurrentUser`, `isSending`, `downloaded?` | Estado del mensaje. `isSending` cambia las acciones por "Enviando…". |
| `onOpen`, `onSave` | Callbacks de la barra de acciones. |
| `bare?` | La tarjeta **es** la burbuja (sin fondo/borde/ancho propios). |
| `footer?` | Hora + checks. Con `caption`, van a la derecha de la leyenda. |
| `caption?` | Leyenda: se pinta entre los datos del archivo y las acciones. |
| `header?` | Contenido a todo el ancho arriba (lo usa la portada del PDF). |
| `menuActions?` | Si hay, muestra la flecha de opciones junto al nombre. |

### `PdfPreviewCard`
`DocumentAttachmentCard` + portada (pagina 1, `h-36 object-cover object-top`; token `--chat-pdf-cover-height`). Props = las de la
tarjeta (sin `header`) + `pdfSrc`. Si la portada falla se ve como tarjeta normal.

### `ImageAttachmentCard`
Imagen completa (`object-contain`). Props: `src`, `isCurrentUser`, `isSending`, `downloaded?`,
`fill?`, `footer?`, `dims?`, `onOpen`, `onError`. Con `fill`: borde a borde y la hora flota abajo a
la derecha en un badge `bg-black/40 backdrop-blur-sm`.

Reserva su caja antes de cargar (aspect-ratio + skeleton) para que la fila del chat no cambie de
alto: usa `dims` (`attachment_dims` del mensaje, guardado por el servidor al subir con `sharp`; los
mensajes optimistas lo leen con `readImageSize`). Sin `dims` (archivo corrupto o no decodificable)
cae a 4:3 hasta `onLoad`. La burbuja pide la miniatura `thumbnailUrl(url)` (WebP 640px,
`/objects/...?w=640`); el visor usa el original.

### `MessageAttachment` — **el selector (usar este)**
```tsx
const attachments = buildChatAttachments(msg, failedImages, probes);
attachments.map((att) => (
  <MessageAttachment
    key={att.path}
    attachment={att}
    isCurrentUser={isMine}
    isSending={msg.status === "sending"}
    onOpenImage={openImage}  onOpenPdf={openPdf}  onOpenOther={openOther}
    onDownload={download}    onImageError={markAsNotImage}
  />
));
```
Elige entre las tres tarjetas segun `attachment.kind`. Props opcionales: `fill`, `footer`,
`caption`, `menuActions`, `downloaded`.

### Miniaturas de PDF — `@/lib/pdf-thumbnail`
`generateThumbnail(fileOrUrl)` → `blob:` JPEG o `null`; hook `usePdfThumbnail(fileOrUrl|null)`;
`isPdfName(name)`; `loadPdfjs()` (pdfjs ya con su worker). pdfjs se importa **dinamico**: no
engorda el bundle inicial.

---

## Fase 3 — Visores a pantalla completa

Misma interfaz oscura para imagenes y documentos.

### `MediaViewerHeader`
Barra superior compartida. Nombre a la izquierda; a la derecha, pegado al borde,
`[ ⤓ descargar ][ ✕ cerrar ]`.

| Prop | Notas |
|---|---|
| `title?` | Nombre del archivo (truncado). |
| `onClose` | ✕ en el extremo derecho. |
| `onDownload?` | Si se pasa, aparece a la izquierda de la ✕. |
| `children?` | Controles opcionales entre el titulo y las acciones. |

### `ImagePreviewModal` (`@/components/ui/image-preview-modal`)
Props: `src` (`null` = cerrado), `title?`, `onClose`, `onDownload?`. Cierra con `Escape` y con
clic en el fondo.

### `DocumentViewerModal`
Visor de PDF con **scroll vertical continuo**: todas las paginas en una columna, cada una se
dibuja solo al acercarse a la pantalla. Props: `url` (`null` = cerrado), `name?`, `onClose`,
`onDownload?`. Teclado: `↑/↓`, `PageUp/PageDown`, `Esc`.

### `PdfFloatingToolbar`
Pildora vertical a la derecha del visor: pagina actual / total, flechas ↑↓ y zoom ±. Props:
`page`, `pageCount`, `onPrev`, `onNext`, `onZoomIn`, `onZoomOut`, `zoomInDisabled?`,
`zoomOutDisabled?`. El contenedor padre debe ser `relative`.

**Reuso fuera del chat** (ya en produccion): `components/ui/enhanced-file-display.tsx`
(adjuntos de pedidos) usa `DocumentViewerModal` e `ImagePreviewModal`.

```tsx
const [pdf, setPdf] = useState<{ url: string; name: string } | null>(null);
<button onClick={() => setPdf({ url: fileUrl, name: "Guia.pdf" })}>Ver guia</button>
<DocumentViewerModal url={pdf?.url ?? null} name={pdf?.name} onClose={() => setPdf(null)} />
```

---

## Fase 4 — Menu de acciones de mensaje

Una lista de acciones, **dos activadores**: clic derecho y flecha (+ pulsacion larga en movil).

### `menu-actions.tsx`
- `buildMessageMenuActions({ text, hasAttachment, canDownload, onOpen, onDownload, onReply })`
  → `MenuAction[]`: *Responder*, *Copiar texto* (si hay texto), *Abrir* y *Guardar como...*
  (si hay adjunto). Para agregar una accion nueva se edita **solo aqui**.
- `ActionItems` — pinta la lista con `ContextMenuItem` o `DropdownMenuItem`.

### `MessageMenuTrigger`
La flecha `ChevronDown` (16 px) sobre un `DropdownMenu`. Sin fondos.

| Prop | Notas |
|---|---|
| `actions` | Las mismas del clic derecho. |
| `variant` | `"default"` (gris: texto y documentos) \| `"image-overlay"` (blanca con sombra sobre fotos). |
| `className` | Posicion (`absolute top-1 right-1 z-dropdown`); sin ella va en el flujo (dentro de una tarjeta). |

Visibilidad: oculta por defecto, aparece al pasar el cursor sobre la burbuja (`group-hover`);
**no se muestra en movil** (`hidden md:inline-flex`).

### `MessageMenuActions`
Envuelve una burbuja: `ContextMenu` (clic derecho, sin menu nativo) + flecha + pulsacion larga.

| Prop | Notas |
|---|---|
| `actions` | Sin acciones devuelve la burbuja sin envolver. |
| `hideTrigger?` | No pintar la flecha flotante (los documentos traen la suya). |
| `onImage?` | Flecha blanca sobre la foto. |

### `useLongPress` (`@/hooks/use-long-press`)
Pulsacion larga de ~500 ms; se cancela si el dedo se mueve > 10 px. Devuelve handlers para
esparcir sobre el contenedor. Anti-seleccion por CSS (`select-none`,
`-webkit-touch-callout: none`) solo en tactil.

```tsx
<MessageMenuActions isCurrentUser={false} actions={buildMessageMenuActions({ text, hasAttachment: false, canDownload: true })}>
  <div className="bg-white rounded-lg px-4 py-3">{text}</div>
</MessageMenuActions>
```

---

## Fase 5 — Responder / citar

### `ReplyQuote`
Caja de cita: borde lateral verde, fondo `bg-black/5`, autor en verde (`"Tú"` si eres tu), texto
o `Foto`/nombre del archivo con icono Lucide en la misma linea.

| Prop | Notas |
|---|---|
| `replyTo` | `ReplyPreview`. |
| `meId` | Id del usuario actual. |
| `className?` | Margenes segun el layout. |
| `onCancel?` | Con esto muestra la ✕: es la barra de pre-respuesta sobre el composer. |

**Flujo**: menu *Responder* → `onReply(msg)` → estado `replyingToMessage` en la pantalla →
`ReplyQuote onCancel` sobre el input → al enviar, `replyToId` en el `FormData`, y el mensaje
optimista lleva `replyTo` para pintarse al instante.

---

## Fase 6 — Composicion

### `MessageBubble`
Solo **layout** de la burbuja: separador de fecha, burbuja propia/ajena (`rounded-lg` con
colita arriba; ajena blanca con borde), cotizacion, cita, hora y checks. Delega adjuntos en `MessageAttachment` y
el menu en `MessageMenuActions`. Layouts especiales: *imagen sola* y *documento solo* (la
tarjeta es la burbuja, `p-0`), *adjunto + leyenda* (adjunto primero, texto debajo, hora al
pie). Props clave: `msg`, `prevMessage`, `currentUserId`, `onReply`, `onFileDownload`,
`isTutorViewer`, y los callbacks de cotizacion.

### `MessageList`
Lista virtualizada (`@tanstack/react-virtual`): posee `useVirtualizer`, asi que el scroll solo
re-renderiza la lista y no toda la pagina. Props: `messages`, `scrollElement` (el nodo del `ChatCanvas`, guardado en estado),
`contentRef` (contenedor interno, lo observa el padre) y `bubbleProps` (todo lo de `MessageBubble`
menos `msg`/`prevMessage`). Handle: `scrollToIndex`. El estimado inicial de cada fila sale de
`estimateMessageSize` (por tipo de mensaje).

**Espacio entre burbujas** (`estimate-message-size.ts`, unico punto de edicion): `MESSAGE_ROW_GAP` (4px)
entre mensajes SEGUIDOS del mismo remitente, propios y ajenos por igual; `MESSAGE_TURN_GAP` (12px) cuando
cambia el remitente. `messageRowGap(msg, next)` elige cual; `MessageList` lo aplica como `paddingBottom`
de cada fila. No poner margenes verticales en `MessageBubble`.

### Piezas de la pantalla de chat (`chat-fullscreen.tsx` solo las ensambla)
Cada una es presentacional (todo llega por props) y se importa desde `@/components/chat`:

| Pieza | Responsabilidad |
|---|---|
| `ChatHeader` | Barra superior: volver, avatar + nombre, estado de conexion o "Escribiendo...", y menu de tres puntos ("Ver perfil"). No abre modales ni consulta datos. |
| `MessageList` | Lista virtualizada, scroll al fondo y **unico dueño del espacio vertical entre filas** (`messageRowGap`). |
| `MessageBubble` | Una burbuja: texto, hora/checks, cita de respuesta, adjuntos y cotizacion. Sin margenes verticales externos entre mensajes. |
| `MessageComposer` | Capsula de redaccion: input, adjuntar y enviar. El input nace con `inputMode="none"` (foco sin teclado virtual hasta tocarlo). Avisa cada cambio por `onChange`. |
| `PresenceIndicator` (`@/components/ui/presence-indicator`) | Estado de conexion. Recibe `isOnline` por prop (de `onlineUsers.has(userId)` del WS): si es true muestra "En linea" (y punto verde si no lleva `hideDot`); si no, el tiempo desde `lastSeen`. No escucha eventos propios. |
| `TypingIndicator` | Tres puntos animados. `variant="label"` (cabecera, verde) o `"bubble"` (final del historial). |
| `useTypingIndicator(peerId, sendTyping)` | Logica del "Escribiendo...": emite `typing_start` (latido 2.5 s) / `typing_stop` (3 s sin teclear) y recibe los del otro (expira a 6 s). La pantalla conecta `notifyTyping`/`stopMyTyping` al `onChange` del composer y al enviar. `useTypingPeers()` (mismo archivo) devuelve los ids de TODOS los que escriben ahora; la lista de chats lo usa para cambiar el preview por "Escribiendo...". |

Excepcion conocida: el separador de fecha ("Hoy", "Ayer") lleva su propio `my-3` dentro de `MessageBubble`
porque pertenece a la fila del primer mensaje del dia; no es espacio entre mensajes.

### `SelectedFileChip`
Chip de un archivo no-imagen en "Archivos seleccionados" (antes de enviar): `FileBadgeIcon sm`,
nombre truncado a 180 px, `EXT • PESO` y la papelera `DeleteIconButton`. Props: `file: File`, `onRemove`.


### Utilidades de cotizacion — `chat-quote-utils.ts`
`parseQuoteFromMessage`, `extractQuoteTitle`, `stripQuoteFromMessage`, `formatChatTimestamp`.

---

## Recetas de reuso

**1. Mostrar los adjuntos de otra entidad (pedido, entregable...)**
`buildChatAttachments({ attachments: paths }, new Set())` + `MessageAttachment` por cada uno.
Si no tienes nombres, pasa `probes` (ver `probeAttachment`) para distinguir PDF de imagen.

**2. Agregar el menu a otra lista**
`buildMessageMenuActions({...})` → `<MessageMenuActions actions={...}>fila</MessageMenuActions>`.

**3. Nueva accion de mensaje** (p. ej. *Reenviar*): agregarla **solo** en `buildMessageMenuActions`;
aparece en clic derecho, flecha y pulsacion larga sin tocar mas.

**4. Nuevo tipo de archivo con insignia**: un `case` en `badgeFor` de `FileBadgeIcon.tsx`.

**5. Visor para otro formato (DOCX...)**: seguir el patron de `DocumentViewerModal`
(`MediaViewerHeader` + cuerpo) y agregar la rama en `onOpenOther` de la pantalla.

## Verificacion rapida tras cambiar algo del modulo

1. `npx tsc --noEmit` y `npx vite build`.
2. Chat con una foto, un PDF y un Excel: tarjetas a 320 px, hora inline, portada del PDF.
3. Abrir foto y PDF: misma barra (descarga a la izquierda de la ✕).
4. Clic derecho en un texto: menu; hover: flecha; movil (390 px): flecha oculta, pulsacion
   larga abre el menu.
5. *Responder*: barra sobre el input, y la cita dentro de la burbuja enviada.

## Sistema de diseno (tokens y componentes compartidos)

- **Colores de burbuja:** propia `bg-bubble-own` (gris neutro, `--chat-bubble-own`), ajena `bg-bubble-other`
  (`--chat-bubble-other`). Todo el estilo vive en `chat-bubble-styles.ts`; `MessageBubble`, `TypingIndicator` y la
  vista del admin lo reutilizan. Las burbujas no llevan sombra.
- **Verde de marca:** `green-*`, nunca los alias `primary-N` (el chequeo `check:field-rules` cubre este modulo).
- **Botones de solo icono:** `ChatIconButton` (`chat-icon-button.tsx`): `aria-label` obligatorio, 40px (`size-touch`),
  foco visible. No armar `<button className="w-8 h-8 ...">` sueltos.
- **Fila de la lista de conversaciones:** `ChatListRow` (`chat-list-row.tsx`).
- **Tipos de archivo:** `FileBadgeIcon` usa `bg-file-pdf|word|excel|ppt|default` (texto blanco >=4.5:1).
- **Escala de texto:** `text-body` / `text-caption` / `text-subheading`; `text-2xs` solo para la hora. Sin `style` inline para
  `overflow-wrap` (clase `break-anywhere`) ni para retardos de animacion (`delay-typing-*`).
- **Escritura:** el campo del `MessageComposer` va a 16px (`text-base`) y el foco lo dibuja la capsula (`focus-within`, borde verde de 2px sin halo);
  el input interno usa `focus-visible:outline-none` porque `:focus-visible` de `index.css` no es una capa y ganaria
  a un `outline-none` simple.

# Session State — 2026-09-17

## Cambios aplicados hoy

### 1. Fix Vite HMR (`ws://localhost:undefined`)
- `server/index.ts`: calculo de `port` movido ANTES de `setupVite()` (antes
  corria despues de `server.listen()`, dejando a Vite sin puerto real para
  inferir el socket de HMR).
- `server/vite.ts`: `setupVite(app, server, port)` ahora recibe `port` y lo
  pasa como `hmr: { server, clientPort: port }`.
- Resultado: ya no aparece `SyntaxError: Failed to construct 'WebSocket'...
  ws://localhost:undefined` en consola del navegador.

### 2. Fix cascada de hard-reload en flujo admin/agente
Causa raiz del bug "login admin se cuelga y rebota a /login": varios puntos
usaban `window.location.href` / `window.location.replace` para navegar
dentro de la misma SPA. Cada hard reload reinicia
`PersistQueryClientProvider` y puede perder la carrera contra el write
throttled del persister hacia IndexedDB (mismo bug ya documentado en
`CLAUDE.md` para `login.tsx`, nunca extendido a estos otros puntos).
Migrados todos a `setLocation` de wouter (client-side, sin reload):
- `client/src/pages/home.tsx` (3 puntos: redirect a `/login` si no hay
  user, boton "Ir al Dashboard" -> `/admin`, redirect automatico
  admin/agent -> `/dashboard`, este ultimo movido a `useEffect`)
- `client/src/pages/admin-dashboard.tsx` (guard de ruta, movido a
  `useEffect`)
- `client/src/pages/admin-page.tsx` (redirect agente -> `/agente`, se
  agrego import de `useLocation` de wouter, no estaba)
- `client/src/App.tsx` (ruta `/agente`, extraida a componente
  `AgenteRedirect` con `useEffect`)

Verificado con Playwright (cuenta admin real, boton dev-login): 7/7 logins
consecutivos llegaron a `/dashboard` sin rebotar, una vez corregido el click
del propio script de prueba (no del bug de la app).

`tsc --noEmit`: sin errores nuevos introducidos por ninguno de los dos
fixes (mismos 3 errores preexistentes de siempre, en otras lineas no
tocadas).

### 3. Fix real de "[vite] server connection lost. Polling for restart..." en loop infinito

**CORRECCION**: la nota anterior en esta seccion decia que era solo el
asistente reiniciando el proceso manualmente, y que ya no se veia. Estaba
MAL — el usuario lo siguio viendo EN VIVO despues, sin que nadie tocara el
server. Documentado aca con detalle completo porque el mecanismo es sutil
y puede reaparecer si alguien vuelve a tocar `presence-system.ts` sin saber
esto.

#### Sintoma

Consola del navegador en loop constante, cada pocos ms:
```
[vite] connecting...
WebSocket connection to 'ws://localhost:5000/?token=XXXX' failed:
  Error during WebSocket handshake: Unexpected response code: 400
[vite] server connection lost. Polling for restart...
```
Pantalla parpadeando en blanco, imposible navegar. Persistia sin importar
cuantas veces se reiniciara el proceso de Node — descartaba de plano que
fuera un crash del proceso (los logs del proceso no mostraban ningun error,
13+ minutos corridos sin un solo stack trace).

#### Metodologia de diagnostico (en orden, cada paso descarto una hipotesis)

1. **`tasklist` + `wmic process where ... get CommandLine`** sobre los 3
   `node.exe` vivos: confirmo que eran la MISMA cadena logica
   `bash -> npx -> tsx-cli -> node(loader)` de una unica instancia, no
   servidores duplicados peleando el puerto. Descarta "procesos zombie".

2. **Playwright, pestana fresca recien abierta despues de un restart limpio,
   observada 30s en idle**: el error SE SEGUIA REPRODUCIENDO igual. Esto
   descarta la teoria de "token de HMR viejo por pestana abierta antes de
   un restart" — una pestana 100% nueva, cargando el bundle actual, con el
   token actual, fallaba igual.

3. **`curl` manual con headers de handshake WebSocket crudos**
   (`Connection: Upgrade`, `Upgrade: websocket`, `Sec-WebSocket-Version: 13`,
   `Sec-WebSocket-Key`, `Sec-WebSocket-Protocol: vite-hmr`) contra `/`:
   reproduce el 400 fuera del navegador, confirmando que no es un artefacto
   del cliente. El MISMO curl contra `/ws` (el endpoint de presencia) dio
   `101 Switching Protocols` sin problema — la falla es especifica de
   cualquier path que NO sea `/ws`.

4. **Lectura del codigo fuente de Vite instalado**
   (`node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js`, funcion
   `createWebSocketServer`): identifica que Vite valida el WS de HMR via
   una funcion `shouldHandle(req)` que chequea Host header y un token
   (`?token=...` contra `config.webSocketToken`, generado una vez por
   proceso). Hipotesis inicial: token viejo. **Descartada en el paso
   siguiente.**

5. **Prueba decisiva — debug runtime temporal**: se inyecto un
   `console.log` DENTRO de `node_modules/vite/.../dep-BK3b2jBa.js`, en la
   funcion `shouldHandle` de Vite, imprimiendo host, token recibido, token
   esperado (`config.webSocketToken`) y el resultado. Se reinicio el
   server, se reprodujo el fallo con curl y con Playwright, y el log
   mostro, SIEMPRE: `hostHeader=localhost:5000 isHostAllowed=true
   token=<X> webSocketToken=<X> valid=true`. **El propio codigo de Vite
   aprobaba la conexion.** El 400 se estaba generando en otro lado, antes
   de que el request llegara al handler de Vite. (El patch de debug se
   revirtio inmediatamente despues de esta prueba — `node_modules` no se
   toca en el repo real.)

6. **Lectura del codigo de la libreria `ws`** (misma funcion `handleUpgrade`
   / `completeUpgrade`, mismo archivo bundleado): reveló el mecanismo real.
   Cuando un `WebSocketServer` se crea como
   `new WebSocketServer({ server: httpServer, path: '/ws' })`, la libreria
   engancha SU PROPIO listener en el evento `'upgrade'` del `httpServer`
   COMPLETO — no solo en requests a `/ws`. Ese listener llama
   `this.handleUpgrade(req, socket, head, cb)` para TODA request de
   upgrade que llegue al servidor, sin importar el path. El filtro por
   `path` se aplica RECIEN ADENTRO, via el metodo `shouldHandle(req)` (el
   default interno de `ws`, no el de Vite — cada `WebSocketServer` tiene
   el suyo): si el pathname no matchea, `shouldHandle` devuelve `false`, y
   `handleUpgrade` responde `abortHandshake(socket, 400)` — un 400 real,
   escrito directo sobre el socket compartido, ANTES de que cualquier otro
   listener registrado en el mismo evento (como el de Vite) llegue a
   procesar esa misma request. Dos `WebSocketServer` distintos colgados
   del mismo `httpServer` via la opcion `{ server, path }` NO son
   mutuamente transparentes: el primero en rechazar por path gana y mata
   el socket para todos.

#### Causa raiz confirmada

`server/presence-system.ts`, metodo `initialize()`, linea original:
```ts
this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });
```
Con el HMR de Vite (`server/vite.ts`, `hmr: { server, clientPort: port }`)
compartiendo el MISMO `httpServer` en modo dev, cualquier upgrade que no
fuera a `/ws` exacto — incluido `ws://localhost:5000/?token=...` de
Vite — quedaba interceptado y respondido con 400 por el WebSocketServer de
presencia, sin que Vite llegara siquiera a ver la request. Esto no
dependia de tokens viejos, de crashes, ni de cuantos restarts se hicieran:
era 100% determinista, pasaba SIEMPRE que ambos WebSocketServer convivieran
en el mismo `httpServer`.

#### Fix aplicado

`server/presence-system.ts`:
```ts
// ANTES:
this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// DESPUES:
this.wss = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url || '', 'http://localhost');
  if (pathname === '/ws') {
    this.wss!.handleUpgrade(req, socket, head, (ws) => {
      this.wss!.emit('connection', ws, req);
    });
  }
});
```
Con `noServer: true`, `ws` NO engancha ningun listener automatico —
nosotros controlamos manualmente el evento `'upgrade'` del `httpServer` y
solo invocamos `handleUpgrade` (que completa el handshake y emite
`'connection'`) cuando el pathname es exactamente `/ws`. Cualquier otro
upgrade (el de Vite) nunca es tocado por este codigo, queda libre para que
el listener de Vite lo procese normal.

**Leccion general para este codebase**: si en el futuro se agrega OTRO
WebSocketServer (ademas de presencia y el HMR de Vite) sobre el mismo
`httpServer`, debe seguir el mismo patron — `noServer: true` + un `if` de
pathname dentro de un UNICO handler de `'upgrade'` (o al menos, nunca usar
`{ server, path }` mientras otro consumidor de upgrades viva en el mismo
servidor HTTP).

Verificado: pestana nueva, 30s idle, consola solo muestra
`[vite] connecting... [vite] connected.` (antes: loop infinito de 400).
`/ws` (presencia) sigue respondiendo 101 normal via curl manual.
`tsc --noEmit`: sin errores nuevos (el unico error en este archivo,
`TS2802` sobre iterar un `Set`, es preexistente — confirmado comparando
contra el archivo sin este cambio via `git stash`).

### 4. Fix: sidebar de /mensajes no actualizaba lastMessage/hora en vivo

#### Sintoma

En `/mensajes` (vista split desktop: `messages-desktop-split.tsx`, lista
+ chat embebido lado a lado), el chat principal mostraba los mensajes
nuevos al instante, pero la tarjeta del contacto en la lista lateral
(`messages-section.tsx`) se quedaba con el texto (`lastMessage`) y la hora
(`lastMessageAt`) viejos — no reordenaba ni actualizaba, ni en vivo ni
volviendo a montar el componente (navegar afuera y volver sin hard
reload).

#### Diagnostico (reproducido en vivo con Playwright, no solo lectura de codigo)

- `server/storage.ts:1434-1436` (`sendMessage`) SI actualiza
  `chatThreads.lastMessage`/`lastMessageAt` en la DB de inmediato — backend
  correcto, descartado como causa.
- Capturando las respuestas reales de red (`GET /api/chat/threads`) con
  Playwright: el fetch se disparaba y el body SI traia el `lastMessage`
  correcto y actualizado. El problema no era ausencia de datos ni falta de
  invalidacion.
- Causa real: `chat-fullscreen.tsx` disparaba
  `queryClient.invalidateQueries({queryKey:["/api/chat/threads"], exact:true})`
  desde DOS lugares casi al mismo tiempo por cada mensaje — el handler de
  WS del eco que el servidor manda al propio remitente
  (`sendToUser(user.id,...)` en `routes.ts`) Y `sendMessageMutation.onSuccess`.
  Dos invalidaciones casi simultaneas disparan dos fetches independientes
  a la misma query key; sin garantia de orden de llegada, la respuesta mas
  vieja podia resolver DESPUES que la mas nueva y pisarla en el cache —
  carrera de red clasica, mismo patron de bug que ya se habia resuelto una
  vez para la lista de MENSAJES dentro del chat (ver comentario historico
  en el propio archivo, linea ~872) pero nunca se aplico al preview del
  sidebar.

#### Fix aplicado

`client/src/pages/chat-fullscreen.tsx`, en los dos puntos que invalidaban
`["/api/chat/threads"]`: agregado un `queryClient.setQueryData(...)`
ANTES del invalidate, que parchea el thread exacto (matcheado por
`threadId`, siempre presente en el mensaje guardado —
`server/storage.ts` `createChatMessage` lo setea via `getOrCreateThread`)
con el `lastMessage`/`lastMessageAt` reales, y lo mueve al tope del
array (mismo orden que ya aplica el backend,
`.orderBy(desc(chatThreads.lastMessageAt))`). Cero espera de red, cero
carrera. El `invalidateQueries` se mantiene DESPUES, sin quitar, como
respaldo para hilos todavia no cacheados y para sincronizar campos que
solo el servidor calcula (`unreadCount`, `sendableTaskId`).

Aplicado en:
1. Handler de WS `'new_message'`/`'message_sent'` (mensajes del otro
   usuario, y el eco del propio).
2. `sendMessageMutation.onSuccess` (la respuesta del POST `/api/chat/send`).

Verificado con Playwright, vista split desktop real: tras enviar un
mensaje, la tarjeta del sidebar muestra el texto y la hora nuevos de
inmediato, sin reload — confirmado leyendo el texto de la tarjeta en el
DOM, no solo la red. `tsc --noEmit`: sin errores nuevos (mismos 3
preexistentes de siempre).

### 5. Fix: receptor no recibia mensajes en tiempo real (solo tras refresh)

**Estado: COMPLETADO y PROBADO** (2 causas raiz, ambas corregidas y
verificadas con Playwright real — ver seccion "Verificacion" abajo).

#### Sintoma

Prueba manual con 2 navegadores en paralelo (Estudiante y Tutor,
`/mensajes`): el emisor veia su mensaje al instante (update local, no
depende del WS). El receptor no veia nada nuevo — ni en el chat abierto ni
en el sidebar — hasta refrescar la pagina. El backend
(`server/routes.ts:3846-3847`) ya llamaba `sendToUser(receiverId, ...)` con
el payload completo; no era un bug de backend.

#### Causa raiz 1 (critica): hook de WS viejo mataba TODAS las conexiones del usuario al perder foco

Coexistian dos implementaciones de cliente WebSocket:
`client/src/hooks/useWebSocket.ts` (vieja, usada en `home.tsx` — el shell
SPA, montado siempre — ademas de `tutor-work-section.tsx` y
`tutors-section.tsx`) y `client/src/hooks/useWebSocketFixed.ts` (nueva,
singleton, ya creada en una sesion anterior para resolver un bug de churn
de sockets, usada en `chat-fullscreen.tsx` y `messages-section.tsx`).

La vieja, en su handler de `visibilitychange`, cuando la pestaña/ventana
dejaba de estar en foreground (cambiar de ventana, alt-tab, minimizar —
justo lo que pasa al probar con 2 navegadores en paralelo), mandaba
`{type:'presence_leaving'}` y cerraba su propio socket. El servidor
(`server/presence-system.ts`, `setUserOffline`) responde a
`presence_leaving` **terminando TODOS los sockets de ese userId** (no solo
el que lo mando) y marcandolo offline. Esto tumbaba tambien el socket sano
del otro hook (`useWebSocketFixed`, el que realmente usan
`chat-fullscreen.tsx`/`messages-section.tsx`). Mientras el usuario queda
marcado offline, `sendToUser()` devuelve `false` sin cola ni reintento — el
mensaje del otro usuario se pierde, solo aparece con el siguiente fetch REST
(refresh). `useWebSocketFixed.ts` nunca tuvo esta rama agresiva; quedo sin
alinear cuando se creo como reemplazo.

**Fix**: migrados los 4 usos de `useWebSocket` (`home.tsx`,
`tutor-work-section.tsx`, `tutors-section.tsx`, `WebSocketDebug.tsx`) a
`useWebSocketFixed` (API compatible). Borrado
`client/src/hooks/useWebSocket.ts` (sin uso). Una sola implementacion de
socket en toda la app.

#### Causa raiz 2 (confirmada): sidebar sin handler de `new_message`

`client/src/components/sections/messages-section.tsx` solo escuchaba
`'messages_read'` en su listener de `websocket_message` — ninguna rama para
`'new_message'`. Si el receptor esta viendo la lista de `/mensajes` sin
tener ese chat especifico abierto en `chat-fullscreen.tsx`, nada actualiza
el sidebar aunque la conexion este sana. `chat-fullscreen.tsx` ya tenia el
patron correcto (parche optimista de `["/api/chat/threads"]` + invalidate
de respaldo, fix #4 de la sesion anterior) pero nunca se replico en
`messages-section.tsx` — mismo patron de "se arreglo en un lado, no en el
otro" que ya habia pasado una vez con este mismo cache.

**Fix**: agregada la misma rama en `messages-section.tsx` (parche de
`lastMessage`/`lastMessageAt`/reordenar al tope + `unreadCount +1` cuando
`msg.senderId !== currentUser.id`, con invalidate de respaldo para que el
server corrija el conteo real).

#### Causa raiz 3 (confirmada): badge del nav lateral sin handler de `new_message`

Mismo hueco que la Causa 2, pero en un TERCER lugar que consume un
CUARTO... en realidad un SEGUNDO modelo de datos distinto:
`client/src/components/layout/bottom-navigation.tsx` (icono "Mensajes" del
menu, mobile bottom-nav y desktop `aside` lateral) no lee
`["/api/chat/threads"]` sino `["/api/chat/last-messages"]`
(`server/routes.ts:3273`, backend
`storage.getLastMessagesForAllConversations`, `server/storage.ts:1681`) —
un modelo task-centric mas viejo, keyado por
`` `${taskId}-${sorted(userId,otroUserId)[0]}-${sorted[1]}` ``. Su listener
de WS solo reaccionaba a `'messages_read'` (para bajar el contador);
ninguna rama para `'new_message'` que lo suba — el badge del menu principal
solo se actualizaba con el poll de 2 minutos o al refrescar, aunque la
tarjeta del sidebar (ya arreglada en la Causa 2) subiera al instante.

**Fix**: agregada la rama `new_message` en el mismo listener de
`bottom-navigation.tsx`. El payload del WS (`taskId`, `senderId`,
`receiverId`) alcanza para reconstruir la MISMA `conversationKey` que arma
el backend sin ir a red; se parchea `unreadCount +1` sobre esa key si ya
existe en cache (conversacion nueva sin entrada previa: se deja que el
`invalidateQueries` de respaldo la traiga, no hay forma de armar el objeto
completo — `fromCurrentUser`/`isDelivered` reales — solo con el payload del
WS). Mismo orden setQueryData-antes-que-invalidate que las Causas 1 y 2.

Es la 3ra vez que aparece este mismo patron (chat abierto -> sidebar ->
nav) porque hay 2 modelos de datos de chat distintos
(`/api/chat/threads` user-centric vs `/api/chat/last-messages`
task-centric) consumidos por vistas separadas, cada una con su propio
listener de WS duplicado a mano. Ver "Pendiente" abajo.

#### Causa raiz 4 (confirmada): unreadCount +2 en vez de +1 en la tarjeta

Tras las causas 1-3, el badge de la tarjeta del hilo mostraba "2" con un
solo mensaje nuevo, mientras el nav (correcto) mostraba "1". Hipotesis
inicial del usuario: doble suma optimista dentro del mismo handler.
Descartada al leer el codigo — la causa real es mas de fondo:
`client/src/pages/home.tsx` monta `MessagesSection` en **2 lugares
simultaneos** para el rol estudiante (bloque `lg:hidden` mobile +
`MessagesDesktopSplit` desktop, que a su vez renderiza `MessagesSection`
de nuevo). Es responsive por CSS (`lg:hidden` / `hidden lg:block`), NO por
mount condicional — ambas instancias del componente estan montadas en el
DOM al mismo tiempo sin importar el viewport, cada una con su propio
`useEffect` registrando su propio listener de `'websocket_message'`.

Un `new_message` llega UNA vez por WS pero `window.dispatchEvent` lo
entrega a AMBOS listeners, sincronicamente; cada uno llama
`queryClient.setQueryData(["/api/chat/threads"], ...)` sobre la MISMA
cache global de react-query (no hay cache por instancia) — el segundo
listener en ejecutar ya lee el `unreadCount` que el primero acaba de subir,
y vuelve a sumar 1 -> +2 total. `bottom-navigation.tsx` no tiene este
problema porque se renderiza una sola vez (es layout, no una vista
duplicada), de ahi que mostrara el numero correcto.

**Fix** (`client/src/components/sections/messages-section.tsx`): `Set`
`processedNewMessageIds` a nivel de MODULO (fuera del componente, mismo
patron que ya usa `useWebSocketFixed.ts` para compartir estado entre
instancias) — dedupe por `msg.message.id` antes de aplicar el incremento,
sin importar cuantas instancias de `MessagesSection` esten montadas. Cap
de tamaño simple (`size > 500 -> clear()`) para no crecer sin limite en
una sesion larga.

De paso, aprovechando que la rama ya recibe `selectedThreadId` como prop:
si el hilo del mensaje entrante es el que ya esta abierto/activo en el
split-view (`msg.message.threadId === selectedThreadId`), el preview
(`lastMessage`/`lastMessageAt`) se sigue actualizando pero `unreadCount`
NO sube — el usuario esta leyendo esa conversacion en vivo en el panel de
al lado, no deberia contar como no-leido.

#### Ajuste de estilo: tarjeta de hilo seleccionado

`messages-section.tsx`: el hilo activo/seleccionado en el sidebar usaba
`ring-2 ring-green-500` (borde verde marcado, fuera del estandar de
diseño). Reemplazado por `bg-green-50 border-green-100` (fondo suave +
borde apenas visible) cuando esta seleccionado, `border-transparent`
cuando no — mismo layout (no salta el tamaño de la tarjeta al
seleccionar/deseleccionar), `hover:shadow-md`/`active:scale-[0.98]`
intactos. Verificado visualmente con screenshot de Playwright.

#### Pendiente sin tocar (fuera de scope de estos fixes)

`tutor-work-section.tsx` tiene su propio `handleNewMessage` para
`new_message` que invalida `['/api/chat/last-messages']` sin patch previo
(sigue dependiendo del poll para ese caso puntual, no del WS) — no se toco
porque esa pagina no renderiza sidebar/nav de mensajes, no era la causa de
ningun bug reportado. Mas de fondo: unificar `/api/chat/threads` y
`/api/chat/last-messages` en un solo modelo, Y evitar el doble-montaje de
`MessagesSection` en `home.tsx` (renderizar una sola instancia y
mostrar/ocultar con CSS en vez de duplicar el componente), eliminaria de
raiz esta familia de bugs en vez de parchearla cada vez que aparece en un
lugar nuevo — refactor mas grande, deliberadamente fuera de scope de estos
fixes puntuales.

**Idea de migracion futura — `ChatProvider` centralizado**: las 4 causas
de este fix #5 (1: hook de WS duplicado, 2: sidebar sin handler, 3: nav
sin handler, 4: doble-montaje sin dedupe) tienen la misma raiz de fondo:
no existe un UNICO punto en la app que reciba `new_message`/`messages_read`
por WS y sea la fuente de verdad para TODAS las vistas que muestran datos
de chat (sidebar, chat abierto, badge de nav). Hoy cada vista escucha
`window.addEventListener('websocket_message', ...)` por su cuenta y
parchea su propia query key a mano — cada vista nueva que toque chat tiene
que reimplementar el mismo patron (setQueryData-antes-que-invalidate,
dedupe, chequeo de hilo activo) o reintroduce uno de estos mismos bugs.

Propuesta: un `ChatProvider` (React Context) montado UNA sola vez en
`App.tsx` (nivel raiz, no dentro de `home.tsx` — evita el problema de
doble-montaje de Causa 4 de raiz) que:
- Sea el UNICO listener de `'websocket_message'` para eventos de chat
  (`new_message`, `messages_read`).
- Centralice el dedupe por id de mensaje (reemplaza el `Set` a nivel de
  modulo de `messages-section.tsx`, que es un parche funcional pero no un
  diseño definitivo).
- Aplique el patch determinista a AMBAS query keys (`/api/chat/threads` y
  `/api/chat/last-messages`) desde un solo lugar, hasta que se unifiquen
  en un solo modelo (ver parrafo anterior).
- Exponga el `threadId`/`taskId` actualmente activo (via el propio
  Context, no por prop-drilling de `selectedThreadId` como hoy) para que
  cualquier vista futura pueda saber si debe contar un mensaje como
  no-leido sin reimplementar la comparacion.

No se implementa en esta sesion — queda anotado para cuando se justifique
el costo del refactor (por ejemplo, si aparece una 5ta vista con el mismo
bug, o al momento de unificar los 2 modelos de datos de arriba).

#### Verificacion

`npx tsc --noEmit`: sin errores nuevos en ningun archivo tocado (los
errores preexistentes en `server/storage.ts`/`server/seed-data.ts` ya
estaban en el commit base, confirmado con `git stash`).

Playwright, 2 `browser.newContext()` reales (cuentas seed
`miltareaslatam@gmail.com` / Tutor `adrianchoquehuancahuaraya@gmail.com`):

- Viewport movil en ambos: se simulo el ciclo `visibilitychange`
  hidden→visible en el receptor justo antes de que el emisor mandara el
  mensaje (reproduce la Causa 1). Confirmado sin refresh: mensaje visible
  en el emisor inmediatamente, Y visible en el receptor tanto en el
  sidebar (sin el chat abierto) como dentro del chat (con el chat
  abierto).
- Emisor en viewport movil, receptor en viewport desktop (para que
  renderice el `aside` — `hidden lg:flex`, solo ≥1024px, que es ademas la
  condicion que dispara el doble-montaje de Causa 4): tras enviar el
  mensaje, confirmado sin refresh que SUBEN AL MISMO TIEMPO tanto el badge
  de la tarjeta del hilo como el badge del icono "Mensajes" del nav
  lateral (Causa 3), y que el badge de la tarjeta queda en exactamente
  "1" (no "2") tras un solo mensaje (Causa 4).
- Screenshot de Playwright confirmando el fondo verde suave en la tarjeta
  seleccionada (ajuste de estilo), sin el borde marcado anterior.

Pendiente de verificacion manual (no reproducido por el asistente): el
caso "hilo ya abierto en el split -> unreadCount se mantiene en 0" esta
verificado por lectura de codigo (logica clara y directa) pero no por
Playwright — el intento choco con la misma limitacion de visibilidad de
elementos ya documentada al probar interacciones en viewport desktop con
split-view (ver notas de esta sesion sobre viewport movil vs desktop en
las pruebas anteriores).

Scripts `.cjs` borrados despues de usarlos, por convencion del proyecto.

### 6. Fix: layout shift / parpadeo en la barra de cotizacion activa del chat

**Estado: COMPLETADO y PROBADO.**

#### Sintoma

Al abrir un chat (`chat-fullscreen.tsx`), la barra fija de cotizacion
activa (titulo del pedido + precio + boton "Contratar"/"Pago
enviado"/"Precio acordado", debajo del header) aparecia de golpe un
instante despues de que la conversacion ya se veia cargada, empujando los
mensajes hacia abajo — layout shift/parpadeo visible en cada apertura.

#### Causa raiz

La query de `taskInfo` (linea ~573) usa `staleTime: 0, gcTime: 0` a
proposito ("no cache for real-time accuracy", necesita el estado de
expiracion del pedido siempre fresco) — con `gcTime: 0` el resultado se
descarta apenas nadie lo esta usando, asi que CADA vez que se monta el
chat vuelve a pedirlo a la red desde cero, sin importar si ya se habia
visitado antes en la misma sesion. La barra se renderizaba con la
condicion `{taskInfo && !chatState.isReadonly && (...)}` — mientras
`taskInfo` es `undefined` (ventana de red en cada mount), la condicion es
falsa y el bloque entero esta AUSENTE del DOM; en el instante que el fetch
resuelve, el bloque completo aparece de una vez, corriendo todo lo de
abajo. `chatState.isReadonly` (linea 616) ya devuelve `false` por defecto
mientras `taskInfo` no cargo, asi que no era la causa — el hueco era
directamente la ausencia de `taskInfo`.

#### Fix

`client/src/pages/chat-fullscreen.tsx`: condicion cambiada de
`taskInfo && !chatState.isReadonly` a `taskId && !chatState.isReadonly`
(`taskId` viene sincronico de la URL, no de un fetch). Mientras `taskId`
existe pero `taskInfo` todavia no resuelve, se renderiza un ESQUELETO con
el mismo alto/padding exacto que la barra real (`animate-pulse`, mismo
patron ya usado en otros loaders de la app) en vez de nada — el bloque
ocupa su espacio desde el primer paint, solo cambia el CONTENIDO cuando
`taskInfo` llega. No se toco `staleTime`/`gcTime` de la query (la
necesidad de expiracion siempre fresca sigue intacta); el fix es
puramente de layout, no de caching.

Excepcion aceptada: si el pedido resulta CANCELLED/expirado, `taskInfo`
ya cargado hace que `chatState.isReadonly` pase a `true` y la barra
colapsa (un solo shift, caso minoritario) — se prefirio esto a intentar
adivinar `isReadonly` antes de tener `taskInfo`, que hubiera arriesgado
mostrar contenido incorrecto brevemente.

#### Verificacion

`npx tsc --noEmit`: sin errores nuevos (mismos 3 preexistentes de
siempre, en lineas no tocadas). Playwright con throttling de red
(`Network.emulateNetworkConditions`, latencia 400ms) para agrandar la
ventana de carga y hacer el bug facil de observar: confirmado por
screenshot que el esqueleto ocupa el espacio primero y la barra real
(con los datos correctos del pedido) aparece despues, sin hueco vacio
intermedio. Script `.cjs` borrado despues de usarlo.

### 7. Rediseño: tarjeta de cotización/propuesta dentro del chat

**Estado: COMPLETADO y PROBADO.**

#### Pedido

Homologar la tarjeta de cotización (`MessageBubble` en
`chat-fullscreen.tsx`, la burbuja que renderiza cuando un mensaje matchea
`parseQuoteFromMessage`) con la estructura visual de la Card de Pedidos
(`simple-task-card.tsx` / `tutor-task-card.tsx`): mismo contenedor, header
con titulo+menu, tiempo restante, footer con precio+accion — sin badge de
estado ni seccion de tutor.

#### Cambios (`client/src/pages/chat-fullscreen.tsx`, componente `MessageBubble`)

- Contenedor: `border-2 border-dotted border-green-400` eliminado, queda
  `bg-white rounded-xl p-4` (mismo patron que `simple-task-card.tsx`/
  `tutor-task-card.tsx`: `bg-white rounded-xl shadow-sm p-4` — el
  `shadow-sm` ya venia de una clase compartida con la burbuja normal).
- Header: la eyebrow "PROPUESTA DE COTIZACIÓN" se reemplazo por un `<h3>`
  con el titulo real del pedido (`quoteTitle`, misma variable de antes,
  logica de fallback sin tocar) + el menu de 3 puntos (mismo
  `DropdownMenu`, mismas 3 acciones, solo reposicionado a esta fila).
- Nuevo: indicador de tiempo restante (`quoteTimeRemaining`, via
  `getTimeRemaining` de `@/utils/task-utils` — reuso de la MISMA funcion
  que ya usa `simple-task-card.tsx`, no una reimplementacion como la que
  tiene `tutor-task-card.tsx` con su propio `calculateTimeRemaining`
  local). Requirio agregar `taskInfoDeadline` como prop nueva de
  `MessageBubbleProps` (mismo patron que `taskInfoTitle`/
  `taskInfoDescription`/`taskInfoCurrency`, pasada desde `taskInfo?.deadline`
  en el `.map()` del padre). Solo se muestra para cotizaciones del pedido
  ANCLA (`isAnchorTaskQuote`) — igual que `quoteTaskDescription`, no hay
  forma de saber el deadline de un pedido historico distinto sin otro
  fetch.
- Precio: bajo de `text-3xl` centrado a `text-xl font-bold` alineado a la
  izquierda del footer (sigue "destacado": mas grande que el precio de
  una Card de Pedidos normal, pero ya no ocupa una fila entera).
- Boton "Contratar": de ancho completo arriba del footer a
  `px-5 py-2 rounded-full` alineado a la derecha, en la MISMA fila que el
  precio (`flex items-center justify-between`) — mismo patron que ya usa
  la barra de cotizacion fija (fix #6, arriba del todo del chat).
- Badge de estado: nunca existio en esta tarjeta — no hubo nada que
  quitar, se confirma que el rediseño no agrega uno.
- Seccion "Tutor: X": tampoco existia aca (es un elemento propio de
  `simple-task-card.tsx`/`tutor-task-card.tsx`, no de la tarjeta de
  cotizacion) — se confirma que no se copio al adoptar el resto de la
  estructura.

#### Layout shift

El titulo/descripcion/tiempo restante de esta tarjeta dependen de
`taskInfo` (fix #6, `gcTime:0`, se refetchea en cada mount del chat). A
diferencia de la barra fija (fix #6, primer elemento visible al abrir el
chat, con skeleton dedicado), estas burbujas viven mas abajo en el
historial de mensajes — para cuando el usuario scrollea hasta verlas,
`taskInfo` casi siempre ya resolvio. Se documento como limitacion
aceptada (comentario `ponytail:` en el codigo) en vez de agregar un
skeleton por burbuja de cotizacion: si en la practica se ve el
"parpadeo" en este caso especifico, agregar el mismo patron de skeleton
que ya tiene la barra fija.

#### Verificacion

`npx tsc --noEmit`: sin errores nuevos (mismos 3 preexistentes de
siempre). Playwright, viewport movil, cuentas seed reales: confirmado por
screenshot que la tarjeta muestra titulo real del pedido + 3 puntos en el
header, descripcion, tiempo restante ("Quedan 3h 45min"), y precio en el
footer con el divisor `border-t`. El boton "Contratar" no se pudo
verificar visualmente en esta sesion porque el pedido de prueba disponible
ya tenia pago enviado/tutor contratado (`canHireAnchorTask` correctamente
`false` en ese estado) — el codigo reutiliza el mismo patron
`flex justify-between` + mismas clases de boton que la barra fija (fix #6,
ya verificada con boton real), riesgo de regresion bajo. Scripts `.cjs` y
screenshots de prueba borrados despues de usarlos.

### 8. Rediseño: composer del chat, estilo WhatsApp con tokens del tema

**Estado: COMPLETADO y PROBADO.**

#### Pedido

Rediseñar la barra de escritura de `chat-fullscreen.tsx` (input + boton
adjuntar + boton enviar) a un estilo tipo WhatsApp: bordes 100%
circulares, sin `bg-white`/`border-gray-200` hardcodeados (usar tokens
semanticos de `index.css`), espaciado mas compacto, sin tocar handlers ni
logica de React/WS.

#### Cambios (`client/src/pages/chat-fullscreen.tsx`, area del composer)

- Wrapper exterior: `bg-white border-t border-gray-200` →
  `bg-background border-t border-border` (`--background`/`--border` en
  `index.css`, cambian solos en dark mode — en light mode son visualmente
  identicos a los hardcodeados de antes, `--background: var(--gray-0)`,
  `--border: var(--gray-200)`).
- Padding del contenedor: `px-4 py-3` → `px-3 py-2` (mas compacto).
- Input + adjuntar: antes el input tenia su propio
  `bg-white border border-gray-200 rounded-lg` y el boton de adjuntar iba
  `absolute` encima, superpuesto en el padding derecho del input. Ahora
  ambos viven DENTRO de un mismo pill (`bg-muted rounded-full`, flex
  layout real, sin `absolute`) — el input queda `bg-transparent` sin
  borde propio, `flex-1 min-w-0` para ocupar todo el ancho disponible; el
  boton de adjuntar es un hijo flex normal al final del pill, ya no
  superpuesto.
- Boton de enviar: `rounded-lg` → `rounded-full` (circular), sin cambios
  de color/estado (verde activo / gris inactivo, igual que antes).
- Handlers, estado de React (`message`, `setMessage`,
  `sendMessageMutation`, `setShowFileMenu`, `handleSendMessage`) y el
  listener de teclado (`Enter` sin `Shift` envia) sin tocar — solo
  clases CSS y estructura del JSX del contenedor.
- Fuera de alcance a proposito: los banners de reseña arriba del input
  (`bg-gray-100 border-b border-gray-200`, lineas ~1913/1925/1935) no se
  tocaron — el pedido era sobre "el input del composer", no sobre esos
  banners de una feature distinta (reseñas).

#### Verificacion

`npx tsc --noEmit`: sin errores nuevos (mismos 3 preexistentes de
siempre). Playwright, viewport movil: confirmado por screenshot que el
pill queda 100% redondeado con input+adjuntar fusionados y el boton de
enviar circular verde. Enviado un mensaje real y abierto el menu de
adjuntar durante la prueba — ambos siguen funcionando igual que antes
(sin cambios de handlers). Scripts `.cjs` y screenshots borrados despues
de usarlos.

### 9. Fix: borde verde de foco en el composer + capsula real bg-card

**Estado: COMPLETADO y PROBADO.**

#### Sintoma

Tras el rediseño del fix #8, el usuario reporto: al enfocar/escribir en
el input del composer seguia apareciendo un borde/anillo verde, y la
capsula no se veia como una sola pieza unificada bg-white/bg-card con
altura suficiente.

#### Causa raiz (borde verde)

`client/src/index.css` (lineas ~410-432) define un estilo BASE global
para TODO `<input>` (excepto checkbox/radio/file) de la app:
```css
input:not([type="checkbox"]):not([type="radio"]):not([type="file"]) {
  border: 1px solid var(--color-border-strong);
  ...
}
input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus {
  outline: none;
  border-color: var(--color-primary); /* = var(--green-500), linea 236 */
  box-shadow: none;
}
```
El composer usa un `<input>` HTML plano (no el componente compartido
`Input` de `ui/input.tsx`, que si tiene su propio manejo de foco). Los 3
`:not([type=...])` de la regla base cuentan como selectores de atributo
para especificidad CSS: `input:not(a):not(b):not(c):focus` da
especificidad (0,4,1) — mas alta que cualquier utilidad Tailwind normal
como `focus:border-0` (especificidad (0,2,0) o menos), sin importar el
orden en el bundle. Por eso los intentos con clases Tailwind normales
(fix #8) no alcanzaban a anular el borde verde de foco.

**Fix**: `!border-transparent` en el `<input>` del composer — el
modificador `!` de Tailwind 3.4 (`important`) gana sobre CUALQUIER regla
no-important sin importar la especificidad de esta, por regla de cascada
CSS (no hizo falta tocar el CSS global, que sigue aplicando normal al
resto de inputs de la app).

#### Ajustes de capsula (mismo commit)

- `bg-muted` → `bg-card` (blanco real en light mode, pedido explicito:
  "bg-white o bg-card"), con `border border-border/40` suave.
- Altura fija `h-11` en el contenedor de la capsula + `h-full` en el
  input (antes dependia solo de padding vertical, quedaba "aplanado").
  `items-center` (antes `items-end`, causaba mal alineado vertical).
  `gap-2` explicito entre input y boton de adjuntar dentro de la capsula.
- Boton de enviar: `w-10 h-10` → `w-11 h-11` (parejo con la altura de la
  capsula), sigue con `gap-2` respecto a la capsula (ya estaba en el fix
  #8, confirmado sin cambios).
- Paperclip: se mantiene DENTRO de la capsula, al final (derecha) — ya
  cumplia esto desde el fix #8, se confirma sin moverlo.

#### Verificacion

`npx tsc --noEmit`: sin errores nuevos (mismos 3 preexistentes).
Playwright: `getComputedStyle` del input enfocado confirma
`border: 1px solid rgba(0,0,0,0)` (transparente, sin verde) y
`box-shadow` sin anillo visible. Screenshot confirma capsula blanca
unificada, altura correcta, sin borde de foco. Mensaje de prueba enviado
y visible en pantalla con el estilo nuevo (handlers sin tocar). Scripts
`.cjs` y screenshots borrados despues de usarlos.

### 10. Ajuste: composer un poco mas alto

`h-11`/`w-11` (44px, fix #9) → `h-12`/`w-12` (48px) en la capsula y el
boton de enviar del composer (`chat-fullscreen.tsx`). `h-12` no es un
valor arbitrario: es el mismo escalon que ya usa el sistema de diseño
para inputs/botones grandes (`button.tsx` variante `lg`: `h-12 px-6 py-3`;
`combobox.tsx` input de busqueda: `h-12`). Verificado con Playwright
(`boundingBox().height === 48`) y screenshot.

### 11. Fix: auto-scroll del chat "salta" hacia arriba tras abrir conversacion

**Estado: COMPLETADO y PROBADO.**

#### Sintoma

Al abrir un chat, el scroll llegaba al fondo y milisegundos despues subia
un poco, dejando el ultimo mensaje parcialmente tapado por el composer.

#### Causa raiz

`chat-fullscreen.tsx` usa `@tanstack/react-virtual` con
`estimateSize: () => 80` fijo y medicion real por fila via
`rowVirtualizer.measureElement` (ResizeObserver). El scroll inicial
(`useLayoutEffect`) llama `scrollToIndex(ultimoMensaje, {align:'end'})`
de forma sincronica en el primer paint — en ese momento el "fondo" se
calcula con el ESTIMADO de 80px por burbuja, no con el alto real. Las
burbujas reales rara vez miden 80px (texto multi-linea y, sobre todo, la
tarjeta de cotizacion rediseñada en el fix #7 — bastante mas alta).
Apenas la medicion real corre (1-2 frames despues), el alto total crece
y el `scrollTop` ya fijado queda corto respecto al nuevo fondo — el chat
"sube" sin que nadie lo mueva. Mismo mecanismo en el auto-scroll de
mensajes nuevos.

Patron de correccion YA EXISTENTE en el mismo archivo:
`loadOlderMessages` restaura `container.scrollTop = container.scrollHeight
- prevScrollHeight` en un `requestAnimationFrame` tras prependear
mensajes viejos — se reutilizo el mismo enfoque (scrollTop directo, sin
depender de estimados) para el resto de los casos.

#### Fix

`client/src/pages/chat-fullscreen.tsx`: agregados `snapToRealBottom()`
(fija `scrollTop = scrollHeight` directo, sin pasar por el virtualizer)
e `isNearBottom()` (umbral 150px). Aplicados en 3 puntos, sin tocar
`scrollToIndex`/`scrollToBottom` existentes (siguen siendo el primer
intento, con su animacion):

1. Scroll inicial, SOLO en la rama "ir al fondo" (no en "ir al primer
   no-leido", que debe quedarse ahi) — correccion via doble
   `requestAnimationFrame` anidado + `setTimeout(..., 50)` de respaldo.
2. Mensajes nuevos (enviados o recibidos por WS) — misma correccion,
   no cambia CUANDO se auto-scrollea, solo garantiza que el destino sea
   el fondo real.
3. Nuevo `useEffect` con deps `[reviewLoading, existingReview]` (las
   queries que controlan los banners de reseña del composer, que pueden
   resolver despues del scroll inicial y cambiar el alto disponible del
   contenedor de mensajes `flex-1`): corrige solo si
   `initialScrollDone.current && isNearBottom()` — no le pisa el scroll
   a quien subio a proposito a leer historial.

No se toco `estimateSize` ni la logica de "primer no-leido".

#### Verificacion

`npx tsc --noEmit`: sin errores nuevos (mismos 3 preexistentes).
Playwright: midiendo `scrollHeight - scrollTop - clientHeight` del
contenedor de mensajes en un hilo con tarjetas de cotizacion cerca del
fondo, `gap=0` tanto al abrir el chat como despues de enviar un mensaje
nuevo (sin refresh). Script `.cjs` borrado despues de usarlo.

### 12. Fix: microsalto residual de scroll (contenido creciendo tarde, sin corregirse)

**Estado: COMPLETADO y PROBADO.**

#### Diagnostico de la hipotesis del usuario

Se pidio diagnosticar 3 disparadores nombrados (`markAsRead`,
`price-sync.ts`/`PRICE_UPDATE`, resolucion tardia de URLs en
`file-url-utils.ts`). Verificado leyendo codigo antes de programar nada:

- `getFileUrl` (`file-url-utils.ts`) es 100% sincronica — solo arma un
  string, sin `fetch`/`Promise`. No hay "resolucion tardia de URL". Lo
  tardio real es el tiempo de CARGA de la imagen en si
  (`<img src=...>`), no un bug de esa funcion.
- `chat-fullscreen.tsx` no importa ni escucha `PRICE_UPDATE`/
  `priceUpdate` en ningun lado (`grep` sin resultados) — no puede estar
  re-renderizando este componente.
- `markAsRead` si esta conectado, pero solo invalida
  `["/api/chat/threads"]`/`["/api/chat/last-messages"]` — ninguna de las
  2 es `messages` ni `taskInfo`, no deberia cambiar el alto del
  contenido.

Diagnostico real (medido con Playwright, no supuesto): el
`scrollHeight` del contenedor de mensajes seguia creciendo cientos de ms
despues de abrir el chat (ej. 1671px -> 2177px) mientras `scrollTop`
quedaba clavado en su valor viejo — contenido genuino creciendo tarde
(no necesariamente por los 3 disparadores nombrados; puede ser
cualquier cosa que remida una fila del virtualizer tarde: imagenes,
revalidaciones, etc.), sin que nada lo corrigiera.

#### Intento fallido (documentado para no repetirlo)

Primer intento: `useEffect(() => {...}, [rowVirtualizer.getTotalSize()])`
— en teoria deberia dispararse cuando el virtualizer remide una fila,
pero medido con Playwright NUNCA se disparo pese a que el `scrollHeight`
real crecia 130px+ entre snapshots. No se investigo la causa exacta
(posible desacople entre el re-render de React y cuando exactamente
`getTotalSize()` refleja la medicion nueva) — se descarto en favor de
la alternativa de abajo, mas confiable y mas simple.

#### Fix

`client/src/pages/chat-fullscreen.tsx`: `ResizeObserver` nativo sobre
los elementos REALES del DOM en vez de depender de que React decida
re-renderizar por un cambio de tamaño puntual — el browser notifica
directo, sin intermediarios:

- Nuevo ref `virtualContentRef` en el div interno del virtualizer
  (`style={{height: rowVirtualizer.getTotalSize()}}`) — detecta que el
  CONTENIDO crecio.
- `messagesContainerRef` (ya existia) — detecta que el CONTENEDOR se
  achico porque algo de afuera crecio.
- Un solo `ResizeObserver` observa ambos elementos; su callback llama
  `snapToRealBottom()` si `initialScrollDone.current` y (dentro de una
  ventana de gracia de 3s tras un scroll intencional al fondo, corrige
  SIEMPRE — fuera de ella, solo si `isNearBottom()`).
- Nuevo ref `scrollGraceUntilRef`: se arma en los 2 puntos donde el fix
  #11 ya scrollea al fondo a proposito (apertura sin no-leidos, mensaje
  nuevo) — DELIBERADAMENTE NO se arma en la rama "primer no-leido" del
  scroll inicial, para no pisar el punto de lectura que se le esta
  mostrando al usuario ahi.
- El `useEffect` que crea el observer depende de `[messages]` (no `[]`)
  porque `virtualContentRef.current` es `null` mientras
  `messages.length === 0` (se renderiza "Inicia la conversación" en su
  lugar) — sin esto, el observer nunca se engancharia al div real una
  vez que los mensajes cargan.

#### Verificacion

`npx tsc --noEmit`: sin errores nuevos (mismos 3 preexistentes).
Playwright, midiendo `scrollTop`/`scrollHeight`/`gap` del contenedor
real (`div.overflow-y-auto.bg-gray-100`, confirmado que es
`messagesContainerRef`) cada pocos cientos de ms durante 3s tras abrir
un hilo: `gap=0` en TODAS las muestras, con `scrollTop` subiendo en
vivo a la par de `scrollHeight` (1015→1344→1521 siguiendo
1671→2000→2177) — confirma que el `ResizeObserver` corrige en tiempo
real cada vez que el contenido crece, no solo una vez al abrir. Rama
"primer no-leido" revisada por codigo: no arma la ventana de gracia, no
se ve afectada. Scripts `.cjs` borrados despues de usarlos.

### 13. Ajuste: selector de perfil muestra nombre en desktop/tablet

**Estado: COMPLETADO y PROBADO.**

`client/src/components/layout/profile-menu-button.tsx` — componente
compartido usado en 2 lugares: `header.tsx` (mobile, `lg:hidden` a nivel
padre) y `bottom-navigation.tsx` (esquina superior del `aside` desktop,
`hidden lg:flex`). Antes: solo avatar + chevron en ambos, sin importar
el ancho de pantalla.

- Extraido `firstName` (`(currentUser?.name || "Usuario").split(' ')[0]`).
- Nombre + `ChevronDown` (antes `ChevronUp` con logica de rotacion
  invertida) envueltos en `hidden md:inline`/`md:inline-block` — solo
  avatar en mobile, avatar+nombre+chevron desde `md:` en adelante. Como
  la instancia de `header.tsx` solo renderiza en mobile (nunca llega a
  `md:`) y la de `bottom-navigation.tsx` solo en `lg:` (siempre por
  encima de `md:`), una sola implementacion responsiva sirve para ambos
  sitios sin duplicar logica.
- Clases del boton actualizadas al estilo pedido:
  `flex items-center gap-2 font-medium text-sm text-foreground
  hover:bg-accent/50 px-2 py-1.5 rounded-lg transition-colors`
  (`text-foreground`/`bg-accent` son tokens semanticos ya definidos en
  `tailwind.config.ts`/`index.css`, no inventados).
- `truncate`+`min-w-0` en el span del nombre y `flex-shrink-0` en
  avatar/chevron — nombres largos no desbordan la barra lateral.

Verificado con Playwright + screenshot en ambos viewports: mobile
(390px) solo avatar, desktop (1280px) avatar + "Mil" (primer nombre) +
chevron, sin overflow horizontal visible. Scripts `.cjs` y screenshots
borrados despues de usarlos.

## Estado actual de la aplicacion (cierre de esta sesion)

- **WebSocket de presencia**: estable. `server/presence-system.ts` usa
  `noServer:true` + routing manual por pathname (fix #3) — ya no colisiona
  con el HMR de Vite ni con ningun otro WebSocket futuro que se agregue al
  mismo `httpServer`, siempre que siga el mismo patron (ver "Leccion
  general" en la seccion #3 arriba).
- **Chat en tiempo real**: mensajes nuevos (propios y del otro usuario)
  aparecen al instante en la ventana principal del chat (ya funcionaba
  antes de esta sesion) Y ahora tambien en la tarjeta de preview del
  sidebar de `/mensajes` (fix #4, nuevo esta sesion) — sincronizacion en
  vivo completa en ambos paneles de la vista split desktop.
- **Login/navegacion admin-agente**: sin cascada de hard-reload (fix #2),
  verificado 7/7 en pruebas repetidas.
- **Dev server**: corriendo, PID activo en `:5000`, arrancado con
  `npm run dev` (ver `CLAUDE.md`). HMR de Vite conectando limpio, sin loop (fix #1 + #3
  combinados).

## Proximos pasos / pendientes para la proxima sesion

Nada roto conocido al cierre de esta sesion. Pendiente de verificacion
manual por el usuario (no reproducido por el asistente, o reproducido
solo parcialmente):

1. **Fix #4 (sidebar) solo se probo con el ENVIO propio** en un flujo
   automatizado (Playwright, una sola cuenta). Falta confirmar en vivo el
   caso de mensaje ENTRANTE real (dos personas distintas chateando al
   mismo tiempo, cada una viendo actualizarse el sidebar de la otra) — el
   codigo cubre ese caso (handler de WS, no solo `onSuccess` del propio
   POST) pero no se verifico con dos sesiones reales simultaneas.
2. **Vista mobile de /mensajes** (`<div className="lg:hidden">` en
   `home.tsx`, sin split view): el fix #4 toca el mismo cache
   (`["/api/chat/threads"]"`) que usa esa vista tambien, deberia
   funcionar igual, pero no se probo especificamente en viewport mobile.
3. **Vite HMR (fix #1 y #3)**: si en algun momento se vuelve a ver
   `[vite] server connection lost. Polling for restart...` en loop, LEER
   PRIMERO la seccion #3 completa de este archivo antes de investigar de
   nuevo — el diagnostico y el fix ya estan documentados en detalle, muy
   probablemente no hace falta repetir el proceso.
4. Sin tests automatizados agregados al repo (todos los scripts de
   verificacion de esta sesion fueron `.cjs` sueltos, borrados despues de
   usarlos, por convencion del proyecto — ver `CLAUDE.md`). Si se quiere
   cobertura permanente de estos fixes, evaluar agregar un test de
   Playwright real al repo (hoy no existe ninguno persistido).

## Como levantar el server (recordatorio operativo)

Dev server arrancado y verificado con:
```bash
npm run dev
```
(ver `CLAUDE.md` — usa `cross-env` + `--env-file=.env`, funciona en Windows).

Si el server se reinicia (crash real o restart manual) mientras hay una
pestana del navegador YA ABIERTA: esa pestana necesita hard refresh (o
cerrar/reabrir) para tomar el `@vite/client` fresco — el reinicio del
proceso por si solo no le llega a una pestana que ya estaba cargada.

Ningun script de prueba (`.cjs`) queda en el repo al cierre — todos
borrados despues de usarlos, por convencion del proyecto (ver seccion
"Testing UI / E2E" de `CLAUDE.md`).

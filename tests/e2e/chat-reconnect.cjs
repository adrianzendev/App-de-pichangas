// E2E: tras caerse el WebSocket, el contador de mensajes y el chat abierto se ponen al dia SIN recargar.
// Cubre `websocket_reconnected` en bottom-navigation.tsx (contador) y chat-fullscreen.tsx (hilo abierto).
//
//   node tests/e2e/chat-reconnect.cjs
//
// SEGURIDAD: levanta SU PROPIO servidor (puerto 5055) y se niega a correr si DATABASE_URL no es la base de
// DESARROLLO (E2E_DEV_DB_HOST, por defecto ep-proud-cherry-ahmesebc) o es la de produccion. El servidor arranca
// con correo (Resend), push web (VAPID) y push nativo (Firebase) vaciados: la rama dev es copia de usuarios reales.
// Escribe mensajes de prueba en la rama dev entre las cuentas de prueba del CLAUDE.md.
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const PORT = process.env.E2E_PORT ?? "5055";
const BASE = `http://localhost:${PORT}`;
const PROD_HOST = "ep-round-leaf-ah6opu4p";
const DEV_HOST = process.env.E2E_DEV_DB_HOST ?? "ep-proud-cherry-ahmesebc";
const STUDENT_EMAIL = "miltareaslatam@gmail.com";
const TUTOR_EMAIL = "adrianchoquehuancahuaraya@gmail.com";
const NEUTRAL_ENV = { RESEND_API_KEY: "", VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", FIREBASE_SERVICE_ACCOUNT_JSON: "" };
const LIMIT_MS = 15_000;

function fail(msg) { console.error(`\nFAIL: ${msg}`); process.exitCode = 1; throw new Error(msg); }
function check(cond, msg) { if (!cond) fail(msg); console.log(`  ok  ${msg}`); }

// --- Proteccion: nunca contra produccion -----------------------------------------------------------------------
function dbHost() {
  const line = fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!line) fail("no hay DATABASE_URL en .env");
  const raw = line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
  return new URL(raw).hostname;
}
function assertSafeEnvironment() {
  if (process.env.NODE_ENV === "production") fail("NODE_ENV=production");
  if (process.env.DATABASE_URL) fail("DATABASE_URL ya esta en el entorno del shell: el test solo lee .env para poder verificarla");
  const host = dbHost();
  if (host.includes(PROD_HOST)) fail(`DATABASE_URL apunta a PRODUCCION (${PROD_HOST}). Cambia .env a la rama dev.`);
  if (!host.startsWith(DEV_HOST)) fail(`host ${host.split(".")[0]} no es la rama dev esperada (${DEV_HOST}). Ajusta E2E_DEV_DB_HOST si cambio.`);
  console.log(`  ok  base de desarrollo: ${host.split(".")[0]}`);
  // El servidor hereda NEUTRAL_ENV; --env-file no pisa variables ya definidas: se comprueba con un proceso hijo identico.
  const out = execFileSync(process.execPath, ["--env-file=.env", "-e",
    "console.log(JSON.stringify(Object.keys(" + JSON.stringify(NEUTRAL_ENV) + ").map(k=>!!process.env[k])))"],
    { cwd: ROOT, env: { ...process.env, ...NEUTRAL_ENV }, encoding: "utf8" });
  check(out.trim() === "[false,false,false,false]", "correo y push (web y nativo) desactivados en el servidor de prueba");
}

// --- Servidor propio -------------------------------------------------------------------------------------------
async function startServer() {
  const proc = spawn("npx", ["tsx", "--env-file=.env", "server/index.ts"], {
    cwd: ROOT, shell: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "development", PORT, ...NEUTRAL_ENV },
  });
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  const stop = () => { try { execFileSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); } catch {} };
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${BASE}/api/user/current`)).status < 500) return { stop, log: () => log }; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  stop();
  fail(`el servidor no arranco en 90 s\n${log.slice(-1500)}`);
}

// --- Utilidades de pagina --------------------------------------------------------------------------------------
async function newUser(browser, email, label) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 } });
  const res = await ctx.request.post("/api/auth/dev-login", { data: { email } });
  check(res.ok(), `dev-login ${label}`);
  const me = (await (await ctx.request.get("/api/user/current")).json());
  return { ctx, me };
}

// Contador de la pestaña Mensajes (conversaciones sin leer, estilo WhatsApp): el span aria-hidden de UnreadBadge.
async function navBadge(page) {
  const badge = page.getByTestId("nav-messages").locator("span[aria-hidden]");
  if ((await badge.count()) === 0) return 0;
  return parseInt((await badge.first().innerText()).replace(/\D/g, ""), 10) || 0;
}

// Corta de verdad: cierra el WebSocket desde el lado de la pagina, deja el contexto offline y confirma que la app lo vio.
async function dropConnection(page, ctx, sockets) {
  await Promise.all(sockets.filter((s) => !s.closed).map((s) => s.route.close({ code: 1006, reason: "e2e: corte" })));
  await ctx.setOffline(true);
  await page.waitForFunction(() => !navigator.onLine, null, { timeout: 5000 });
  const t0 = Date.now();
  while (sockets.some((s) => !s.closed)) {
    if (Date.now() - t0 > 5000) fail("el WebSocket no se cerro tras el corte");
    await page.waitForTimeout(100);
  }
  check(true, "app detecto la caida: WebSocket cerrado y navegador offline");
}

async function openTutorPage(tutor, url) {
  const page = await tutor.ctx.newPage();
  const sockets = [];
  await page.routeWebSocket(/\/ws$/, (route) => {
    const entry = { route, closed: false };
    sockets.push(entry);
    route.connectToServer(); // reenvia todo al servidor real
    route.onClose(() => { entry.closed = true; });
  });
  const reqs = []; // peticiones a last-messages con su respuesta
  page.on("response", async (r) => {
    if (r.url().includes("/api/chat/last-messages")) {
      try { reqs.push({ at: Date.now(), body: await r.json() }); } catch {}
    }
  });
  await page.goto(url, { waitUntil: "networkidle" });
  const t0 = Date.now();
  while (!sockets.some((s) => !s.closed)) {
    if (Date.now() - t0 > 10_000) fail("el WebSocket del tutor no conecto");
    await page.waitForTimeout(100);
  }
  return { page, sockets, reqs };
}

async function sendFromStudent(student, tutorId, text) {
  const res = await student.ctx.request.post("/api/chat/send", { multipart: { receiverId: tutorId, message: text, clientMsgId: `e2e-${Date.now()}-${Math.random()}` } });
  if (!res.ok()) fail(`el alumno no pudo enviar (${res.status()}): ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function markThreadRead(tutor, threadId) {
  await tutor.ctx.request.post(`/api/chat/threads/${threadId}/mark-read`);
}

// ---------------------------------------------------------------------------------------------------------------
(async () => {
  console.log("Chat: recuperacion tras reconectar el WebSocket");
  assertSafeEnvironment();
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const student = await newUser(browser, STUDENT_EMAIL, "alumno");
    const tutor = await newUser(browser, TUTOR_EMAIL, "tutor");
    // base36, no digitos largos: el filtro de contactos del servidor censura numeros de 9+ digitos.
    const tag = `e2e${Date.now().toString(36)}`;

    // Hilo de partida y baseline limpio: el tutor lo deja leido.
    const first = await sendFromStudent(student, tutor.me.id, `${tag} inicio`);
    const threadId = first.threadId;
    check(!!threadId, `hilo creado (${threadId ?? "sin threadId en la respuesta de /api/chat/send"})`);
    await markThreadRead(tutor, threadId);

    // ---- Parte A: tutor en la pantalla de inicio (contador de la barra) ----
    console.log("\nA) Tutor en inicio, contador de la barra");
    const a = await openTutorPage(tutor, "/home");
    await a.page.getByTestId("nav-messages").waitFor();
    await a.page.waitForTimeout(1500); // badgeReady (500 ms) + primer last-messages
    const before = await navBadge(a.page);
    console.log(`  contador antes: ${before}`);

    await dropConnection(a.page, tutor.ctx, a.sockets);
    for (let i = 1; i <= 3; i++) await sendFromStudent(student, tutor.me.id, `${tag} A${i}`);
    const reconnectedAt = Date.now();
    a.reqs.length = 0;
    const socketsBefore = a.sockets.length;
    await tutor.ctx.setOffline(false);

    const t0 = Date.now();
    let after = before;
    while (Date.now() - t0 < LIMIT_MS) {
      after = await navBadge(a.page);
      if (after === before + 1) break;
      await a.page.waitForTimeout(250);
    }
    const elapsed = Date.now() - reconnectedAt;
    check(a.sockets.length > socketsBefore, "la app abrio un WebSocket nuevo (reconexion real)");
    const refetch = a.reqs.find((r) => r.at >= reconnectedAt);
    check(!!refetch, "hubo una peticion a /api/chat/last-messages despues de reconectar");
    const unread = Object.values(refetch?.body ?? {}).map((c) => c.unreadCount);
    check(unread.includes(3), `el servidor reporta 3 mensajes sin leer en la conversacion (valores: ${unread.join(",")})`);
    check(after === before + 1, `el contador subio de ${before} a ${after} (1 conversacion nueva sin leer) sin recargar, en ${elapsed} ms (< ${LIMIT_MS} ms)`);
    await a.page.close();

    // ---- Parte B: tutor dentro del chat abierto ----
    console.log("\nB) Tutor con el chat abierto");
    await markThreadRead(tutor, threadId);
    const b = await openTutorPage(tutor, `/chat-fullscreen?threadId=${threadId}`);
    await b.page.getByText(`${tag} A3`).waitFor({ timeout: 10_000 }).catch(async () => {
      fail(`el chat no mostro los mensajes previos. URL: ${b.page.url()}\n${(await b.page.locator("body").innerText()).slice(0, 600)}`);
    });

    await dropConnection(b.page, tutor.ctx, b.sockets);
    const texts = [1, 2, 3].map((i) => `${tag} B${i}`);
    for (const t of texts) await sendFromStudent(student, tutor.me.id, t);
    const bAt = Date.now();
    await tutor.ctx.setOffline(false);
    for (const t of texts) await b.page.getByText(t).waitFor({ timeout: LIMIT_MS });
    check(true, `los 3 mensajes aparecieron solos en ${Date.now() - bAt} ms (< ${LIMIT_MS} ms), sin recargar`);

    console.log("\nOK");
  } finally {
    await browser.close();
    server.stop();
  }
})().catch((e) => { process.exitCode = 1; console.error(e.message ?? e); });

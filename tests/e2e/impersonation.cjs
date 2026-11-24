// E2E de "Ver como": confirmacion, solo lectura, varias pestanas, sin WebSocket, salir, cerrar sesion, vencimiento y auditoria.
//
//   npm run test:e2e:impersonation
//
// SEGURIDAD: levanta SU PROPIO servidor (puerto 5056) y se niega a correr si DATABASE_URL no es la base de DESARROLLO
// (E2E_DEV_DB_HOST, por defecto ep-proud-cherry-ahmesebc) o es la de produccion. Correo y push van vaciados.
// Escribe en la rama dev solo filas de auditoria y la sesion de esta prueba. Tarda unos 2 minutos.
const { chromium } = require("playwright");
const { Pool } = require("pg");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const PORT = process.env.E2E_PORT ?? "5056";
const BASE = `http://localhost:${PORT}`;
const PROD_HOST = "ep-round-leaf-ah6opu4p";
const DEV_HOST = process.env.E2E_DEV_DB_HOST ?? "ep-proud-cherry-ahmesebc";
const ADMIN_EMAIL = "admin@miltareas.com";
const TARGET_EMAIL = "miltareaslatam@gmail.com";
const NEUTRAL_ENV = { RESEND_API_KEY: "", VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", FIREBASE_SERVICE_ACCOUNT_JSON: "" };
const SESSION_CACHE_MS = 16_000; // la cache de CachedPgStore dura 15 s

function fail(msg) { console.error(`\nFAIL: ${msg}`); process.exitCode = 1; throw new Error(msg); }
function check(cond, msg) { if (!cond) fail(msg); console.log(`  ok  ${msg}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function databaseUrl() {
  const line = fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!line) fail("no hay DATABASE_URL en .env");
  return line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
}

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === "production") fail("NODE_ENV=production");
  if (process.env.DATABASE_URL) fail("DATABASE_URL ya esta en el entorno del shell: el test solo lee .env para poder verificarla");
  const host = new URL(databaseUrl()).hostname;
  if (host.includes(PROD_HOST)) fail(`DATABASE_URL apunta a PRODUCCION (${PROD_HOST}). Cambia .env a la rama dev.`);
  if (!host.startsWith(DEV_HOST)) fail(`host ${host.split(".")[0]} no es la rama dev esperada (${DEV_HOST}). Ajusta E2E_DEV_DB_HOST si cambio.`);
  console.log(`  ok  base de desarrollo: ${host.split(".")[0]}`);
}

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
    try { if ((await fetch(`${BASE}/api/user/current`)).status < 500) return { stop }; } catch {}
    await sleep(1000);
  }
  stop();
  fail(`el servidor no arranco en 90 s\n${log.slice(-1500)}`);
}

(async () => {
  console.log("Entorno");
  assertSafeEnvironment();
  const pool = new Pool({ connectionString: databaseUrl() });
  const server = await startServer();
  const browser = await chromium.launch();
  const startedAt = new Date();

  try {
    const { rows } = await pool.query(`SELECT id, name FROM users WHERE email=$1`, [TARGET_EMAIL]);
    if (!rows[0]) fail("no existe la cuenta de prueba");
    const target = rows[0];
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1366, height: 800 } });
    check((await ctx.request.post("/api/auth/dev-login", { data: { email: ADMIN_EMAIL } })).ok(), "dev-login admin");
    const me = () => ctx.request.get("/api/user/current").then((r) => r.json());
    const stopUrl = "/api/admin/impersonate/stop";
    const startUrl = `/api/admin/impersonate/${target.id}`;
    const originHeader = { headers: { Origin: BASE } };

    console.log("\nA) CSRF");
    check((await ctx.request.post(startUrl, { headers: { Origin: "https://evil.example" } })).status() === 403, "origen ajeno rechazado");
    check((await ctx.request.post(startUrl)).status() === 403, "sin origen rechazado");

    const errors = [];
    const a = await ctx.newPage();
    a.on("pageerror", (e) => errors.push(e.message));
    let socketAttempts = 0;
    a.on("websocket", (ws) => { if (new URL(ws.url()).pathname === "/ws") socketAttempts++; });
    const banner = (p = a) => p.getByTestId("impersonation-banner");

    const openEye = async () => {
      await a.goto("/dashboard/users", { waitUntil: "domcontentloaded" });
      const search = a.getByPlaceholder(/Buscar/).first();
      await search.waitFor({ timeout: 30_000 });
      await search.fill(TARGET_EMAIL);
      await a.getByTestId(`button-impersonate-user-${target.id}`).click({ timeout: 30_000 });
      return a.getByRole("alertdialog");
    };
    const startUi = async () => {
      const dialog = await openEye();
      await dialog.getByRole("button", { name: "Ver cuenta" }).click();
    };

    console.log("\nB) Confirmacion y varias pestanas");
    const dialog = await openEye();
    check((await dialog.innerText()).includes("solo lectura"), "la confirmacion avisa que es solo lectura");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    check(!(await me()).impersonating, "cancelar no inicia");

    const b = await ctx.newPage();
    b.on("pageerror", (e) => errors.push(e.message));
    await b.goto("/dashboard/tasks", { waitUntil: "domcontentloaded" });
    await b.waitForTimeout(3000);
    let reloads = 0;
    b.on("load", () => reloads++);

    await startUi();
    await banner().waitFor({ timeout: 30_000 });
    check((await banner().innerText()).includes("Solo lectura"), "el banner dice solo lectura");
    await sleep(4000);
    check(reloads >= 1, "la otra pestana recargo");
    check(await banner(b).isVisible(), "la otra pestana tambien muestra el banner");

    console.log("\nC) Sin WebSocket y con consulta periodica");
    socketAttempts = 0;
    await a.goto("/messages", { waitUntil: "domcontentloaded" });
    await banner().waitFor({ timeout: 30_000 });
    let threadCalls = 0;
    a.on("request", (r) => { if (new URL(r.url()).pathname === "/api/chat/threads") threadCalls++; });
    await sleep(33_000);
    check(socketAttempts === 0, "sin intentos de WebSocket");
    check(threadCalls >= 1, `la lista de conversaciones consulta sola (${threadCalls} en 33 s)`);

    console.log("\nD) Solo lectura");
    const call = (method, url, data) => a.evaluate(async ([m, u, d]) => {
      const r = await fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: d ? JSON.stringify(d) : undefined });
      return { status: r.status, body: await r.text() };
    }, [method, url, data]);
    for (const [m, u] of [
      ["POST", "/api/chat/send"], ["PUT", "/api/user/current"], ["POST", "/api/USER/change-password"],
      ["POST", "/api/uploads/request-url"], ["POST", "/api/push/subscribe"], ["POST", "/api/tasks"],
    ]) check((await call(m, u, { name: "E2E-NO-CAMBIAR" })).status === 403, `bloqueado ${m} ${u}`);
    const noop = await call("POST", "/api/chat/threads/no-existe/mark-read");
    check(noop.status === 200 && JSON.parse(noop.body).updatedCount === 0, "mark-read responde OK sin escribir");
    check((await call("GET", "/api/admin/audit-log")).status === 403, "la auditoria no se ve con la sesion suplantada");
    const cur = JSON.parse((await call("GET", "/api/user/current")).body);
    check(cur.impersonating && Math.abs(cur.impersonationExpiresAt - Date.now() - 30 * 60_000) < 3 * 60_000, "vence en unos 30 min");

    console.log("\nE) Salir");
    await a.getByTestId("button-stop-impersonation").click();
    await a.waitForURL("**/dashboard/users", { timeout: 30_000 });
    await sleep(4000);
    check(!(await banner().isVisible()) && !(await banner(b).isVisible()), "sin banner en ninguna pestana");
    const back = await me();
    check(back.userType === "admin" && !back.impersonating, "sesion de admin otra vez");
    check((await ctx.request.post(stopUrl, originHeader)).ok(), "salir dos veces no falla");
    await b.close();

    console.log("\nF) Cerrar sesion");
    await startUi();
    await banner().waitFor({ timeout: 30_000 });
    await a.getByTestId("header-profile").first().click({ timeout: 8000 });
    await a.getByText("Cerrar sesión").first().click({ timeout: 8000 });
    await a.waitForURL("**/dashboard/users", { timeout: 30_000 });
    check((await me()).userType === "admin", "desde la interfaz vuelve al admin");
    check((await ctx.request.post(startUrl, originHeader)).ok(), "inicia por API (cliente antiguo)");
    check((await ctx.request.post("/api/auth/logout", { data: {} })).ok() && (await me()).userType === "admin", "el servidor tambien vuelve al admin");

    console.log("\nG) Vencimiento");
    await a.route("**/api/user/current", async (route) => {
      try {
        const res = await route.fetch();
        const json = await res.json();
        if (json?.impersonating) json.impersonationExpiresAt = Date.now() + 3000;
        await route.fulfill({ response: res, json });
      } catch { /* peticion cancelada al navegar */ }
    });
    await startUi();
    await banner().waitFor({ timeout: 30_000 });
    await a.waitForURL("**/dashboard/users", { timeout: 40_000 });
    await a.unroute("**/api/user/current");
    check((await me()).userType === "admin", "el banner sale solo al llegar la hora");

    check((await ctx.request.post(startUrl, originHeader)).ok(), "inicia para probar el servidor");
    await a.goto("about:blank");
    const cookie = (await ctx.cookies()).find((c) => c.name === "miltareas.session");
    const sid = decodeURIComponent(cookie.value).slice(2).split(".")[0];
    const aged = await pool.query(
      `UPDATE user_sessions SET sess = jsonb_set(sess::jsonb,'{impersonationStartedAt}',to_jsonb($2::bigint))::json WHERE sid=$1 AND sess::jsonb ? 'impersonatorId'`,
      [sid, Date.now() - 31 * 60_000],
    );
    check(aged.rowCount === 1, "se envejecio solo la sesion de esta prueba");
    await sleep(SESSION_CACHE_MS);
    const parallel = await Promise.all(["/api/user/current", "/api/tutors", "/api/countries", "/api/user/current"].map((p) => ctx.request.get(p)));
    check(parallel.every((r) => r.status() < 500), "las peticiones simultaneas al vencer responden");
    const expired = await me();
    check(expired.userType === "admin" && !expired.impersonating, "el servidor volvio al admin");

    console.log("\nH) Auditoria");
    await sleep(1500);
    const log = await pool.query(
      `SELECT action, detail->>'reason' reason, detail->>'route' route, detail->>'status' status, ip FROM superadmin_audit_log WHERE created_at >= $1`,
      [startedAt],
    );
    const count = (fn) => log.rows.filter(fn).length;
    check(count((r) => r.action === "impersonate_end" && r.reason === "expired") === 1, "un solo cierre por vencimiento");
    check(count((r) => r.action === "impersonate_end" && r.reason === "logout") === 1, "el cierre desde el servidor registra su motivo");
    check(count((r) => r.action === "impersonate_end" && r.reason === "stop") >= 2, "Salir y Cerrar sesion en la interfaz registran stop");
    check(count((r) => r.action === "read" && r.route === "/api/chat/threads") === 1, "leer el chat se registra, una sola vez pese a las consultas");
    check(count((r) => r.action === "request" && r.route === "/api/chat/send" && r.status === "403") === 1, "el intento bloqueado queda registrado");
    check(log.rows.every((r) => r.ip), "todas las filas tienen IP");
    const name = (await pool.query(`SELECT name FROM users WHERE id=$1`, [target.id])).rows[0].name;
    check(name !== "E2E-NO-CAMBIAR", "la cuenta suplantada no cambio");

    await a.goto("/dashboard/audit", { waitUntil: "domcontentloaded" });
    await a.getByTestId("table-audit-log").getByText(TARGET_EMAIL).first().waitFor({ timeout: 30_000 });
    check(true, "la seccion Auditoria muestra los registros");
    await a.screenshot({ path: path.join(process.env.E2E_SHOTS ?? require("node:os").tmpdir(), "audit-section.png") });

    const student = await browser.newContext({ baseURL: BASE });
    await student.request.post("/api/auth/dev-login", { data: { email: TARGET_EMAIL } });
    check((await student.request.get("/api/admin/audit-log")).status() === 403, "otro usuario no puede leer la auditoria");
    await student.close();

    check(errors.length === 0, `sin errores de JavaScript ${errors.slice(0, 3).join(" | ")}`);
    console.log("\nOK");
  } finally {
    await browser.close();
    server.stop();
    await pool.end();
  }
})().catch((e) => { process.exitCode = 1; console.error(e.message ?? e); });

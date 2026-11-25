import { test, expect, type Page } from "@playwright/test";

// Presupuesto por flujo critico (ms). Ajustable: PERF_BUDGET_MS=3000 npm run test:e2e:perf
const BUDGET_MS = Number(process.env.PERF_BUDGET_MS ?? 2000);
const USER = {
  email: process.env.PERF_EMAIL ?? "miltareaslatam@gmail.com",
  // Mide el login POR FORMULARIO, asi que necesita una clave real: la 123456 ya no inicia sesion (ver CLAUDE.md).
  password: process.env.PERF_PASSWORD ?? "",
};

const results: Record<string, number> = {};

async function measure(label: string, fn: () => Promise<void>) {
  const t0 = performance.now();
  await fn();
  const ms = Math.round(performance.now() - t0);
  results[label] = ms;
  console.log(`[PERF] ${label}: ${ms} ms`);
  return ms;
}

// Listo = hay hilos o el estado vacio (no el skeleton).
async function messagesReady(page: Page) {
  await page
    .locator('[data-testid^="message-thread-"]:visible, :text("Sin conversaciones aún")')
    .first()
    .waitFor({ timeout: 15_000 });
}

test.describe.configure({ mode: "serial", retries: 0 }); // sin reintentos: ocultarian lentitud

test("rendimiento: login, dashboard y mensajes", async ({ page }) => {
  test.skip(!USER.password, "Define PERF_PASSWORD (clave real de PERF_EMAIL): el login por formulario no admite 123456.");
  // Registra latencia de las APIs para el informe (no entra en las aserciones).
  const api: { url: string; ms: number }[] = [];
  page.on("requestfinished", async (req) => {
    if (!req.url().includes("/api/")) return;
    const t = req.timing();
    if (t.responseEnd > 0) api.push({ url: new URL(req.url()).pathname, ms: Math.round(t.responseEnd) });
  });

  // a) Carga inicial de /login
  await measure("Carga Login", async () => {
    await page.goto("/login", { waitUntil: "commit" });
    await page.getByTestId("input-email").waitFor();
    await page.getByTestId("input-password").waitFor();
    await page.getByTestId("button-submit").waitFor();
  });

  // b) Login + render del dashboard (desde el submit hasta header/nav visible)
  await page.getByTestId("input-email").fill(USER.email);
  await page.getByTestId("input-password").fill(USER.password);
  await measure("Login + Render Dashboard", async () => {
    await page.getByTestId("button-submit").click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 });
    await page.getByRole("button", { name: /Mensajes/ }).first().waitFor();
    await page.locator("main").first().waitFor();
  });

  // Quitar el modal de bienvenida (bloquea clicks) fuera de la medicion.
  await page.getByRole("button", { name: "Ahora no", exact: true }).click({ timeout: 4_000 }).catch(() => {});

  // c) Navegacion SPA a Mensajes
  await measure("Carga de Mensajes", async () => {
    await page.getByRole("button", { name: /Mensajes/ }).locator("visible=true").first().click();
    await page.waitForURL(/\/messages/);
    await messagesReady(page);
  });

  // d) Referencia: carga en frio de /messages (documento + bundle + sesion + datos)
  await measure("Mensajes en frio (reload)", async () => {
    await page.reload({ waitUntil: "commit" });
    await messagesReady(page);
  });

  const slow = api.filter((a) => a.ms > 500).sort((x, y) => y.ms - x.ms).slice(0, 8);
  if (slow.length) console.log("[PERF] APIs >500ms:", slow.map((a) => `${a.url} ${a.ms}ms`).join(" | "));

  for (const label of ["Carga Login", "Login + Render Dashboard", "Carga de Mensajes"]) {
    expect(results[label], `${label} supera ${BUDGET_MS} ms`).toBeLessThanOrEqual(BUDGET_MS);
  }
});

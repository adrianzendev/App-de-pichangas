import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";

const STUDENT = { email: "carlosadrianchoquehuanca@gmail.com" };
const TUTOR = { email: "adrianchoquehuancahuaraya@gmail.com" };
const TEXT = "Prueba E2E mensaje automático";
const REPLY = "Respuesta E2E del tutor";

// Sesion con POST /api/auth/dev-login (solo desarrollo): la clave 123456 ya no inicia sesion (ver CLAUDE.md
// "Autenticacion y contrasenas"). Cada usuario va en su propio contexto (cookies separadas).
async function login(browser: Browser, u: typeof STUDENT): Promise<Page> {
  const context = await browser.newContext();
  const res = await context.request.post("/api/auth/dev-login", { data: { email: u.email } });
  expect(res.ok(), `dev-login de ${u.email}`).toBeTruthy();
  return context.newPage();
}

// El aviso "Activa las notificaciones" (toast con "Ahora no") aparece tarde y puede tapar el campo de mensaje.
async function dismissWelcome(page: Page) {
  const later = page.getByRole("button", { name: "Ahora no", exact: true });
  await later.click({ timeout: 4_000 }).catch(() => {});
}

// Abre el chat con la contraparte: primer hilo de /messages (o el que contenga `name`).
async function openChat(page: Page, name?: string) {
  await page.goto("/messages");
  const threads = page.locator('[data-testid^="message-thread-"]:visible');
  await threads.first().waitFor({ timeout: 15_000 });
  await dismissWelcome(page);
  await (name ? threads.filter({ hasText: name }).first() : threads.first()).click();
  await expect(page.getByPlaceholder("Escribe un mensaje")).toBeVisible();
}

const alias = (id: string) => `Alumno ${String(parseInt(id.replace(/-/g, "").slice(0, 8), 16) % 100000).padStart(5, "0")}`;
// Contador de no leidos de la navegacion (UnreadBadge: bg-green-600; el numero va en el <span aria-hidden>, el otro es sr-only).
const navBadge = (page: Page) => page.getByRole("button", { name: /Mensajes/ }).locator("span.bg-green-600:visible");
const badgeCount = async (badge: Locator) => Number(await badge.first().locator("span[aria-hidden]").innerText());

test("chat en tiempo real estudiante <-> tutor", async ({ browser }) => {
  const student = await login(browser, STUDENT);
  const tutor = await login(browser, TUTOR);
  await openChat(student, "Adrian Choquehuanca");
  const me = await (await student.request.get("/api/user/current")).json();
  await openChat(tutor, alias(me.id));

  const input = student.getByPlaceholder("Escribe un mensaje");

  // 2. typing indicator en el tutor
  await input.pressSequentially("Prueba", { delay: 100 });
  await expect(tutor.getByText("Escribiendo", { exact: false }).locator("visible=true").first()).toBeVisible({ timeout: 10_000 });

  // 3-4. enviar y recibir sin recargar
  await input.fill(TEXT);
  await input.press("Enter");
  await expect(tutor.locator("div.break-words", { hasText: TEXT }).last()).toBeVisible({ timeout: 10_000 });

  // 5. hora + doble check en la burbuja del estudiante (alineados en la misma fila)
  const bubble = student.locator("div.break-words", { hasText: TEXT }).last().locator("xpath=ancestor::*[.//*[local-name()='svg']][1]");
  const time = bubble.getByText(/\d{1,2}:\d{2}/).last();
  const check = bubble.locator("svg[class*=\"lucide-check-check\"].text-green-600").last();
  await expect(time).toBeVisible();
  await expect(check).toBeVisible({ timeout: 10_000 });
  const [t, c] = [await time.boundingBox(), await check.boundingBox()];
  expect(Math.abs(t!.y + t!.height / 2 - (c!.y + c!.height / 2))).toBeLessThan(8);
  expect(c!.x).toBeGreaterThan(t!.x);

  // 6. el estudiante sale del chat; el tutor responde; sube el badge
  await student.goto("/tutors");
  const before = (await navBadge(student).count()) ? await badgeCount(navBadge(student)) : 0;
  const tutorInput = tutor.getByPlaceholder("Escribe un mensaje");
  await dismissWelcome(tutor);
  await tutorInput.click();
  await tutorInput.pressSequentially(REPLY, { delay: 20 });
  await tutorInput.press("Enter");
  await expect(tutor.locator("div.break-words", { hasText: REPLY }).last()).toBeVisible();
  await expect(navBadge(student).first()).toBeVisible({ timeout: 10_000 });
  expect(await badgeCount(navBadge(student))).toBeGreaterThanOrEqual(before + (before ? 0 : 1));
});

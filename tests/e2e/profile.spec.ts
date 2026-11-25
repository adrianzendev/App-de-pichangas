import { test, expect, type Page } from "@playwright/test";

// Mi perfil (alumno y tutor). Solo lectura: NUNCA se guarda nada (la base de .env es compartida);
// la validacion se prueba comprobando que NO sale ningun PUT /api/user/current.
// Cuentas: PROFILE_STUDENT_EMAIL / PROFILE_TUTOR_EMAIL (+ _PASSWORD) las sobreescriben.
const STUDENT = { email: process.env.PROFILE_STUDENT_EMAIL ?? "miltareaslatam@gmail.com", password: process.env.PROFILE_PASSWORD ?? "123456" };
const TUTOR = { email: process.env.PROFILE_TUTOR_EMAIL ?? "adrianchoquehuancahuaraya@gmail.com", password: process.env.PROFILE_PASSWORD ?? "123456" };

const VIEWPORTS = [
  { name: "escritorio", size: { width: 1440, height: 900 } },
  { name: "movil", size: { width: 390, height: 844 } },
];

test.describe.configure({ retries: 0 });

// Sesion con POST /api/auth/dev-login (solo desarrollo): la clave 123456 ya no inicia sesion (ver CLAUDE.md
// "Autenticacion y contrasenas"). Va por la API, antes de abrir ninguna pagina: sin snapshot previo de React Query
// que rehidrate un /api/user/current = null y rebote a /login.
async function login(page: Page, user: { email: string; password?: string }) {
  const res = await page.context().request.post("/api/auth/dev-login", { data: { email: user.email } });
  expect(res.ok(), `dev-login de ${user.email}`).toBeTruthy();
}

async function openProfile(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.locator("#profile-name").waitFor({ timeout: 15_000 });
}

// Donde arranca el flujo del primer bloque de la pantalla: debe coincidir con /orders (mismo layout). Se resta su margen
// superior: en movil la hoja del perfil sube a sangre con -mt-page-top y su caja empieza 12px mas arriba a proposito.
const firstBlockTop = (page: Page) =>
  page.evaluate(() => {
    const first = document.querySelector('main [class*="py-page-top"]')!.firstElementChild!;
    return Math.round(first.getBoundingClientRect().top - (parseFloat(getComputedStyle(first).marginTop) || 0));
  });

for (const vp of VIEWPORTS) {
  test.describe(`Mi perfil alumno · ${vp.name}`, () => {
    test.use({ viewport: vp.size });

    test("estructura, accesibilidad y alineacion", async ({ page }) => {
      await login(page, STUDENT);
      await openProfile(page, "/student-profile");

      await expect(page.getByRole("heading", { level: 1, name: "Mi perfil" })).toBeAttached();
      // email de solo lectura (campo deshabilitado) + enlace a soporte
      await expect(page.locator("#profile-email")).toBeDisabled();
      await expect(page.getByRole("link", { name: "escribe a soporte" })).toHaveAttribute("href", /wa\.me/);
      // cada campo tiene su label asociado (incluido Pais)
      for (const label of [/^Nombre/, /^Universidad/, /^Email/, /^WhatsApp/, /^País/]) {
        await expect(page.getByLabel(label).first()).toBeVisible();
      }
      // el switch tiene nombre accesible; el boton de foto es el avatar completo (64px)
      await expect(page.getByRole("switch", { name: "Notificaciones" })).toBeVisible();
      const photo = await page.getByRole("button", { name: "Cambiar foto de perfil" }).boundingBox();
      expect(photo!.width).toBeGreaterThanOrEqual(64);
      // sin boton flotante Publicar
      await expect(page.getByTestId("fab-publish")).toHaveCount(0);
      // mismo top que /orders y sin scroll horizontal
      const top = await firstBlockTop(page);
      await page.goto("/orders", { waitUntil: "networkidle" });
      await page.locator('main [class*="py-page-top"]').first().waitFor({ timeout: 15_000 });
      expect(top, "el primer bloque del perfil arranca a la misma altura que /orders").toBe(await firstBlockTop(page));
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    });

    test("Guardar: deshabilitado al abrir, se habilita al editar y valida sin enviar", async ({ page }) => {
      let puts = 0;
      await page.route("**/api/user/current", (route) => {
        if (route.request().method() === "PUT") { puts++; return route.abort(); }
        return route.continue();
      });
      await login(page, STUDENT);
      await openProfile(page, "/student-profile");

      const save = page.getByRole("button", { name: "Guardar cambios" });
      await expect(save).toBeDisabled();

      await page.locator("#profile-whatsapp").fill("+51 900 000 000");
      await expect(save).toBeEnabled();

      // nombre vacio: error visible, aria-invalid y ningun PUT
      await page.locator("#profile-name").fill("");
      await save.click();
      await expect(page.getByText("Ingresa tu nombre")).toBeVisible();
      await expect(page.locator("#profile-name")).toHaveAttribute("aria-invalid", "true");
      expect(puts).toBe(0);
    });
  });
}

test.describe("Mi perfil tutor", () => {
  test.use({ viewport: VIEWPORTS[0].size });

  test("mismo formulario + perfil profesional, en /tutor-profile y /profile", async ({ page }) => {
    await login(page, TUTOR);
    for (const route of ["/tutor-profile", "/profile"]) {
      await openProfile(page, route);
      await expect(page.locator("#profile-email")).toBeDisabled();
      await expect(page.locator("#profile-bio")).toBeVisible();
      await expect(page.getByTestId("profile-specialties")).toBeVisible();
      await expect(page.getByRole("switch")).toHaveCount(2);
    }
  });
});

test.describe("Falla la sesion", () => {
  test("el shell muestra Reintentar en vez de un spinner infinito", async ({ page, browser }) => {
    await login(page, STUDENT);
    // contexto nuevo: mismas cookies, sin cache de IndexedDB, para que no haya usuario previo
    const ctx = await browser.newContext({ storageState: await page.context().storageState() });
    const p = await ctx.newPage();
    await p.route("**/api/user/current", (route) => route.fulfill({ status: 500, body: "{}" }));
    await p.goto("/student-profile");
    await expect(p.getByText("No pudimos cargar tu cuenta")).toBeVisible({ timeout: 15_000 });
    await expect(p.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await ctx.close();
  });
});

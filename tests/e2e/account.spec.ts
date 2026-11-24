import { test, expect, type Page } from "@playwright/test";

// Menu de cuenta (tocar el avatar): pantalla /account en movil, popover en escritorio. Un solo trigger por tamaño.
// Cuenta: PROFILE_STUDENT_EMAIL la sobreescribe.
const STUDENT = { email: process.env.PROFILE_STUDENT_EMAIL ?? "miltareaslatam@gmail.com" };

test.describe.configure({ retries: 0 });

// Sesion con POST /api/auth/dev-login (solo desarrollo): la clave 123456 ya no inicia sesion (ver CLAUDE.md
// "Autenticacion y contrasenas"). Va por la API antes de abrir ninguna pagina, asi no hay snapshot previo de React Query
// que rehidrate un /api/user/current = null y rebote a /login.
async function login(page: Page) {
  const res = await page.context().request.post("/api/auth/dev-login", { data: { email: STUDENT.email } });
  expect(res.ok(), `dev-login de ${STUDENT.email}`).toBeTruthy();
  await page.goto("/home", { waitUntil: "networkidle" });
}

test.describe("Cuenta · movil", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("el avatar abre /account, sin menu desplegable", async ({ page }) => {
    await login(page);
    // En movil no hay cabecera: la cuenta es el ultimo item "Perfil" (avatar) de la barra inferior, un solo trigger y sin popover.
    await expect(page.getByTestId("nav-account")).toHaveCount(1);
    await expect(page.locator('[data-testid="header-profile"]:visible')).toHaveCount(0);
    await page.getByTestId("nav-account").click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
    for (const name of ["Mi perfil", "Cambiar contraseña", "Centro de ayuda", "Cerrar sesión"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
    // alineado con el resto de hojas (sin scroll horizontal ni boton flotante)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await expect(page.getByTestId("fab-publish")).toHaveCount(0);

    await page.getByRole("button", { name: "Mi perfil" }).click();
    await expect(page).toHaveURL(/\/student-profile$/);
    await page.goBack();
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page).not.toHaveURL(/\/account/);
  });
});

test.describe("Cuenta · escritorio", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("el avatar abre un popover con las mismas acciones; Escape y clic fuera lo cierran", async ({ page }) => {
    await login(page);
    const trigger = page.locator('[data-testid="header-profile"]:visible');
    await expect(trigger).toHaveCount(1);
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Cuenta" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveCount(4);
    await expect(page).not.toHaveURL(/\/account/);

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await trigger.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(900, 300); // fuera del popover
    await expect(menu).toBeHidden();

    await trigger.click();
    await menu.getByRole("menuitem", { name: "Cambiar contraseña" }).click();
    await expect(page).toHaveURL(/\/change-password$/);
  });

  test("Cerrar sesion lleva a /login", async ({ page }) => {
    await login(page);
    await page.locator('[data-testid="header-profile"]:visible').click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

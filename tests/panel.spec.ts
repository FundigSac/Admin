import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Inicia sesión con el flujo real: correo → código de un solo uso leído de la bandeja de demostración.
async function signIn(page: Page, next = "/panel") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("button", { name: "Probar con código" }).click();
  await page.getByRole("button", { name: "Enviar código" }).click();
  const subject = await page.locator(".auth-demo__mail").innerText();
  const code = subject.match(/\d{6}/)?.[0];
  expect(code).toBeTruthy();
  await page.getByLabel("Código de verificación").fill(code!);
  await page.waitForURL(`**${next}`);
}

test("sin sesión, el panel redirige al acceso y conserva la ruta", async ({ page }) => {
  await page.goto("/usuarios");
  await expect(page).toHaveURL(/\/login\?next=%2Fusuarios/);
  await expect(page.getByRole("heading", { name: "Inicia sesión" })).toBeVisible();
});

test("un código incorrecto descuenta intentos y no da acceso", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Probar con código" }).click();
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de verificación").fill("000000");
  await expect(page.locator("#code-error")).toContainText("Te quedan 4 intentos");
  await expect(page).toHaveURL(/\/login/);
});

test("entra a la demo con un clic", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar a la demo" }).click();
  await page.waitForURL("**/panel");
  await expect(page.getByRole("heading", { level: 1, name: "Resumen" })).toBeVisible();
});

test("ingresa con el código y ve el resumen con lo pendiente", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1, name: "Resumen" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Para hoy" })).toBeVisible();
  await expect(page.getByText("Plazos legales que vencen pronto")).toBeVisible();
});

const SCREENS = ["/panel", "/usuarios", "/actividad", "/cotizaciones", "/consultas", "/reclamaciones", "/privacidad", "/roles", "/configuracion"];

for (const path of SCREENS) {
  test(`${path} carga sin errores y sin fallas de accesibilidad graves`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await signIn(page, path);
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const axe = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}

test("crea un cliente y luego lo elimina con confirmación escrita", async ({ page, isMobile }) => {
  test.skip(isMobile, "El flujo de tabla se prueba en escritorio");
  await signIn(page, "/usuarios");
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  await page.getByLabel("Nombres y apellidos").fill("Prueba Automática Quispe");
  await page.getByLabel("Correo electrónico").fill("prueba.e2e@obras-test.pe");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Prueba Automática Quispe ya está en el gestor.")).toBeVisible();
  await page.getByRole("button", { name: "Acciones para Prueba Automática Quispe" }).first().click();
  await page.getByRole("menuitem", { name: "Eliminar cuenta" }).click();
  const confirm = page.getByRole("button", { name: "Sí, eliminar" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
  await confirm.click();
  await expect(page.getByText("Cuenta eliminada.")).toBeVisible();
});

test("responde una hoja de reclamación y queda como respondida", async ({ page }) => {
  await signIn(page, "/reclamaciones/r-0002");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hoja de reclamación");
  await page.getByRole("textbox", { name: "Respuesta del proveedor" }).fill("Hemos revisado su caso y asignamos un ejecutivo que le responderá el mismo día.");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByText("Respuesta registrada y enviada al consumidor.")).toBeVisible();
  await expect(page.locator(".case-head").getByText("Respondida")).toBeVisible();
});

test("cambia a inglés y se mantiene al navegar", async ({ page, isMobile }) => {
  test.skip(isMobile, "El selector de idioma del teléfono está en el menú");
  await signIn(page);
  await page.getByRole("group", { name: "Idioma" }).getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await page.goto("/usuarios");
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
});

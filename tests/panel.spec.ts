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

// Diseño del 2026-10-20: estas pruebas fijan lo que el dueño pidió recuperar del panel.
test("el resumen muestra todas sus partes", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("navigation", { name: "Para hoy" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Resumen" }).first()).toBeVisible();
  for (const name of [/De registro a cotización/, /Cómo llegan/, /Últimos registros/, /Por verificar/, /Plazos legales que vencen pronto/]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
});

test("el menú tiene nueve entradas en tres grupos y las colas muestran su contador", async ({ page, isMobile }) => {
  await signIn(page, "/cotizaciones");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  const nav = page.getByRole("complementary", { name: "Navegación principal" });
  await expect(nav.getByRole("link", { name: /^(Resumen|Usuarios|Actividad|Cotizaciones|Consultas|Reclamaciones|Privacidad|Roles y permisos|Configuración)/ })).toHaveCount(9);
  for (const group of ["General", "Atención", "Administración"]) await expect(nav.getByText(group, { exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: /^Cotizaciones/ })).toHaveAttribute("aria-current", "page");
  await expect(nav.locator(".nav-count").first()).toHaveText(/^\d+$/);
  await nav.getByRole("link", { name: /^Reclamaciones/ }).click();
  await page.waitForURL("**/reclamaciones");
  if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("complementary", { name: "Navegación principal" }).getByRole("link", { name: /^Reclamaciones/ })).toHaveAttribute("aria-current", "page");
});

test("Ctrl K abre la búsqueda y encuentra a una persona", async ({ page, isMobile }) => {
  test.skip(isMobile, "El atajo de teclado es de computadora");
  await signIn(page);
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox");
  await expect(box).toBeFocused();
  await box.fill("Karina Lozano");
  const option = page.getByRole("option", { name: /Karina Lozano Paz/ });
  await expect(option).toBeVisible();
  await option.click();
  await page.waitForURL(/\/usuarios\/.+/);
});

test("la barra superior cambia el tema", async ({ page, isMobile }) => {
  test.skip(isMobile, "En el teléfono el tema está en el menú");
  await signIn(page);
  const bar = page.locator(".topbar");
  await expect(bar.getByRole("group", { name: "Idioma" })).toBeVisible();
  const toggle = bar.getByRole("button", { name: /modo (oscuro|claro)/i });
  const before = await page.locator("html").getAttribute("data-theme");
  await toggle.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "");
});

test("Configuración permite filas compactas", async ({ page }) => {
  await signIn(page, "/configuracion?tab=preferences");
  await page.getByRole("group", { name: /Densidad de la tabla/ }).getByRole("button", { name: "Compacta" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
});

test("la actividad filtra por tipo de evento", async ({ page }) => {
  await signIn(page, "/actividad");
  await page.getByLabel("Tipo de evento").selectOption({ label: "Inicio de sesión" });
  const rows = page.locator(".feed__row");
  await expect(rows.first()).toContainText("Inicio de sesión");
  await expect(rows.filter({ hasNotText: "Inicio de sesión" })).toHaveCount(0);
});

test("el resumen lista las cuentas por verificar y permite reenviar", async ({ page }) => {
  await signIn(page);
  const section = page.getByRole("region", { name: /Por verificar/ });
  const first = section.getByRole("button", { name: /^Reenviar verificación a / }).first();
  await first.click();
  await expect(first).toHaveText("Enviado");
  await expect(first).toBeDisabled();
});

test("la entrada Regla de tinta se ve una vez por sesión y no bloquea el panel", async ({ page }) => {
  await signIn(page);
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.*/, { timeout: 2500 });
  expect(await page.evaluate(() => sessionStorage.getItem("fx-intro-admin"))).toBe("1");
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.*/);
  await expect(page.locator(".shell-intro")).toBeHidden();
});

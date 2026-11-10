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
  await page.getByLabel("Código de 6 números").fill(code!);
  await page.waitForURL(`**${next}`);
}

test("sin sesión, el panel redirige al acceso y conserva la ruta", async ({ page }) => {
  await page.goto("/usuarios");
  await expect(page).toHaveURL(/\/login\?next=%2Fusuarios/);
  await expect(page.getByRole("heading", { level: 1, name: "Entra al panel" })).toBeVisible();
});

test("un código incorrecto descuenta intentos y no da acceso", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Probar con código" }).click();
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código de 6 números").fill("000000");
  await expect(page.locator("#code-error")).toContainText("Te quedan 4 intentos");
  await expect(page).toHaveURL(/\/login/);
});

test("entra a la demo con un clic", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar a la demo" }).click();
  await page.waitForURL("**/panel");
  await expect(page.getByRole("heading", { level: 1, name: "Para hoy" })).toBeVisible();
});

// Inicio responde "qué tengo que hacer ahora" (brief de diseño §6.4): una frase, un botón principal y la lista.
test("ingresa con el código y ve lo que tiene que atender hoy", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1, name: "Para hoy" })).toBeVisible();
  await expect(page.locator(".home-head__lead strong")).toHaveText(/^Tienes \d+ cosas? por atender\.$/);
  const list = page.getByRole("region", { name: /Lo que falta atender/ });
  await expect(list.getByRole("listitem").first()).toBeVisible();
  expect(await list.getByRole("listitem").count()).toBeLessThanOrEqual(7);
  const urgent = page.getByRole("link", { name: "Atender lo más urgente" });
  await expect(urgent).toHaveAttribute("href", await list.getByRole("link", { name: /^Atender/ }).first().getAttribute("href") ?? "");
  await urgent.click();
  await page.waitForURL(/\/(reclamaciones|privacidad|cotizaciones|consultas)\/.+/);
});

test("el historial de cambios filtra por lo que pasó", async ({ page }) => {
  await signIn(page, "/actividad");
  await expect(page.getByRole("heading", { level: 1, name: "Historial de cambios" })).toBeVisible();
  await page.getByLabel("Qué pasó").selectOption({ label: "Inicios de sesión" });
  const rows = page.locator(".log__row");
  await expect(rows.first()).toContainText("inició sesión");
  await expect(rows.filter({ hasNotText: "inició sesión" })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Agregar persona" }).click();
  await page.getByLabel("Nombres y apellidos").fill("Prueba Automática Quispe");
  await page.getByLabel("Correo electrónico").fill("prueba.e2e@obras-test.pe");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Cuenta creada para Prueba Automática Quispe.")).toBeVisible();
  // La lista ya no tiene menú por fila (brief §6.5): se abre la cuenta y se elimina desde "Más acciones".
  await page.getByRole("link", { name: "Abrir la cuenta de Prueba Automática Quispe" }).click();
  await page.waitForURL(/\/usuarios\/.+/);
  await page.getByRole("button", { name: "Más acciones para Prueba Automática Quispe" }).click();
  await page.getByRole("menuitem", { name: "Eliminar cuenta" }).click();
  const confirm = page.getByRole("button", { name: "Sí, eliminar" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
  await confirm.click();
  await expect(page.getByText("Cuenta eliminada.")).toBeVisible();
  await page.waitForURL(/\/usuarios$/);
});

test("Cuentas filtra al personal y la consulta por persona dice qué puede hacer", async ({ page }) => {
  await signIn(page, "/usuarios");
  await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Personal de FUNDIGSAC" }).click();
  await page.waitForURL(/tipo=personal/);
  await expect(page.locator(".accounts-table tbody tr")).toHaveCount(6);
  await page.goto("/roles");
  await page.getByLabel("Elige a alguien del equipo").selectOption({ label: "Karina Lozano Paz (Ventas)" });
  await expect(page.locator(".lookup__list--yes")).toContainText("Atender y responder cotizaciones");
  await expect(page.locator(".lookup__list--no")).toContainText("Responder reclamos");
});

test("responde una hoja de reclamación y queda como respondida", async ({ page }) => {
  await signIn(page, "/reclamaciones/r-0002");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hoja de reclamación");
  await page.getByRole("textbox", { name: "Respuesta del proveedor" }).fill("Hemos revisado su caso y asignamos un ejecutivo que le responderá el mismo día.");
  await page.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(page.getByText("Respuesta registrada y enviada al consumidor.")).toBeVisible();
  await expect(page.locator(".case-head").getByText("Respondida")).toBeVisible();
});

// El idioma salió de la barra superior: se cambia en Ajustes > Mis preferencias (brief de diseño §6.1).
test("cambia a inglés desde Mis preferencias y se mantiene al navegar", async ({ page }) => {
  await signIn(page, "/configuracion?tab=preferences");
  // Ajustes guarda con un solo botón al pie, activo solo cuando hay cambios (brief de diseño §6.3).
  const save = page.getByRole("button", { name: "Guardar cambios" });
  await expect(save).toBeDisabled();
  await page.getByRole("group", { name: "Idioma" }).getByRole("button", { name: "English" }).click();
  await save.click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.goto("/usuarios");
  await expect(page.locator(".topbar__title")).toHaveText("Accounts");
  await expect(page.getByRole("navigation", { name: "Panel sections" }).getByRole("link", { name: /Requests/ })).toBeVisible();
});

test("el menú tiene cuatro secciones y Solicitudes agrupa las cuatro colas", async ({ page }) => {
  await signIn(page, "/cotizaciones");
  const sections = page.getByRole("navigation", { name: "Secciones del panel" });
  await expect(sections.getByRole("link")).toHaveCount(4);
  await expect(sections.getByRole("link", { name: /Solicitudes/ })).toHaveAttribute("aria-current", "page");
  const kinds = page.getByRole("navigation", { name: "Tipos de solicitud" });
  await expect(kinds.getByRole("link")).toHaveCount(4);
  await kinds.getByRole("link", { name: /Reclamos/ }).click();
  await page.waitForURL("**/reclamaciones");
  await expect(kinds.getByRole("link", { name: /Reclamos/ })).toHaveAttribute("aria-current", "page");
});

test("la búsqueda encuentra una solicitud por su código", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Buscar por nombre, correo o código" }).click();
  await page.getByRole("combobox", { name: "Buscar por nombre, correo o código" }).fill("COT-2026-0521");
  const option = page.getByRole("option", { name: /COT-2026-0521/ });
  await expect(option).toBeVisible();
  await option.click();
  await page.waitForURL(/\/cotizaciones\/.+/);
});

test("la barra superior tiene tema e idioma en computadora", async ({ page, isMobile }) => {
  test.skip(isMobile, "En el teléfono siguen en Ajustes");
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page);
  const bar = page.locator(".topbar");
  await expect(bar.getByRole("group", { name: /idioma/i })).toBeVisible();
  const toggle = bar.getByRole("button", { name: /modo (oscuro|claro)/i });
  await expect(toggle).toBeVisible();
  const before = await page.locator("html").getAttribute("data-theme");
  await toggle.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "");
});

test("Ajustes permite filas compactas en computadora y se aplica al guardar", async ({ page, isMobile }) => {
  test.skip(isMobile, "La opción solo existe en computadora");
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, "/configuracion");
  await page.getByRole("group", { name: "Altura de las filas" }).getByRole("button", { name: "Compacta" }).click();
  await page.getByRole("button", { name: /Guardar/ }).first().click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
});

test("la entrada Regla de tinta se ve una vez por sesión y no bloquea el panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page);
  // Ya se mostró al entrar: no se repite al navegar ni al recargar en la misma sesión.
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.*/, { timeout: 2500 });
  expect(await page.evaluate(() => sessionStorage.getItem("fx-intro-admin"))).toBe("1");
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", /.*/);
  await expect(page.locator(".shell-intro")).toBeHidden();
});

test("el inicio lista las cuentas por confirmar y permite reenviar el correo", async ({ page }) => {
  await signIn(page);
  const section = page.getByRole("region", { name: "Esperan confirmar su correo" });
  await expect(section).toBeVisible();
  const first = section.getByRole("button", { name: /^Reenviar el correo de confirmación a / }).first();
  await first.click();
  await expect(first).toHaveText("Enviado");
  await expect(first).toBeDisabled();
});

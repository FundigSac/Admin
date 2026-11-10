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

// ===== Ideas favoritas (2026-11): estados vacíos, plazos legales, conteos, fechas, cifras, nombres y confirmaciones =====

const DB_KEY = "fundigsac-admin:db:v6";
const LISTS = ["/usuarios", "/actividad", "/cotizaciones", "/consultas", "/reclamaciones", "/privacidad"];

/** Cambia la base de demostración del navegador y recarga: solo datos de demo, nunca la API real. */
async function editDemoDb(page: Page, edit: string) {
  await page.evaluate(
    ([key, body]) => {
      const db = JSON.parse(localStorage.getItem(key)!);
      new Function("db", body)(db);
      localStorage.setItem(key, JSON.stringify(db));
    },
    [DB_KEY, edit] as const,
  );
  await page.reload();
}

async function seriousAxe(page: Page) {
  const axe = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  return axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.length}`);
}

test("X8-1 sin coincidencias: cada lista dice que no hay resultados y ofrece quitar filtros", async ({ page }) => {
  await signIn(page, "/usuarios");
  for (const path of LISTS) {
    await page.goto(path);
    const search = page.locator("main").getByRole("searchbox");
    await expect(page.locator("main h1")).toBeVisible();
    await search.fill("zzzz-sin-coincidencias");
    const empty = page.getByRole("status").filter({ hasText: "Ningún resultado con estos filtros" });
    await expect(empty).toBeVisible();
    await expect(empty).toHaveAttribute("data-empty", "filtered");
    expect(await seriousAxe(page)).toEqual([]);
    await empty.getByRole("button", { name: "Quitar filtros" }).click();
    await expect(search).toHaveValue("");
    await expect(page.locator("[data-empty]")).toHaveCount(0);
  }
});

test("X8-1 sin registros: cada lista explica qué aparecerá ahí y no ofrece quitar filtros", async ({ page }) => {
  await signIn(page, "/usuarios");
  await editDemoDb(page, "db.users = []; db.activity = []; db.quotes = []; db.inquiries = []; db.claims = []; db.privacy = [];");
  const titles: Record<string, RegExp> = {
    "/usuarios": /Aún no hay cuentas/,
    "/actividad": /Aún no hay actividad/,
    "/cotizaciones": /Aún no hay cotizaciones/,
    "/consultas": /Aún no hay consultas/,
    "/reclamaciones": /Aún no hay reclamaciones/,
    "/privacidad": /Aún no hay solicitudes/,
  };
  for (const path of LISTS) {
    await page.goto(path);
    const empty = page.locator('[data-empty="none"]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(titles[path]);
    await expect(empty).toContainText("Aquí aparecerán");
    await expect(empty.getByRole("button")).toHaveCount(0);
    await expect(page.locator("main h1")).toContainText("(0)");
    expect(await seriousAxe(page)).toEqual([]);
  }
});

test("X12-1 plazo legal con ícono, forma y texto en lista, ficha y resumen", async ({ page }) => {
  await signIn(page, "/reclamaciones");
  // La hoja abierta que vence primero pasa a estar vencida hace 5 días; las solicitudes de privacidad quedan en plazo.
  await editDemoDb(
    page,
    "const open = db.claims.filter((c) => c.status !== 'answered').sort((a, b) => a.dueAt - b.dueAt)[0]; open.dueAt = Date.now() - 5 * 86400000; db.privacy.forEach((p) => { if (p.status !== 'done') p.dueAt = Date.now() + 20 * 86400000; });",
  );
  const late = page.locator('main .deadline[data-state="late"]:visible').first();
  await expect(late).toContainText("Vencido");
  await expect(late.locator("svg")).toHaveCount(1);
  await expect(page.locator('main .deadline[data-state="ok"]:visible').first()).toContainText("En plazo");
  // Cada estado usa un ícono distinto: la forma no depende del color.
  const shapes = await page.locator("main .deadline[data-state]:visible").evaluateAll((els) => {
    const by: Record<string, string> = {};
    els.forEach((el) => (by[el.getAttribute("data-state")!] = el.querySelector("svg")!.innerHTML));
    return by;
  });
  expect(new Set(Object.values(shapes)).size).toBe(Object.keys(shapes).length);
  await late.click();
  await expect(page.locator(".case-head .deadline")).toContainText(/Vencido ?· hace \d+ días? hábil/);
  await page.goto("/privacidad");
  await expect(page.locator('main .deadline[data-state="ok"]:visible').first()).toContainText("En plazo");
  await page.goto("/panel");
  const rail = page.getByRole("region", { name: /Plazos legales que vencen pronto/ });
  await expect(rail.locator('.deadline[data-state="late"]')).toContainText("Vencido");
});

test("X8-2 y X9-2 los títulos llevan el total y no cambian al filtrar", async ({ page }) => {
  await signIn(page, "/reclamaciones");
  for (const path of LISTS) {
    await page.goto(path);
    await expect(page.locator("main h1 .title-count")).toHaveText(/^\s?\(\d[\d.,]*\)$/);
  }
  await page.goto("/reclamaciones");
  const count = page.locator("main h1 .title-count");
  await expect(count).toHaveText(/\(\d+\)/);
  const before = await count.innerText();
  await page.locator("main").getByRole("searchbox").fill("zzzz");
  await expect(page.locator("[data-empty]")).toBeVisible();
  await expect(count).toHaveText(before);
  await page.goto("/reclamaciones/r-0002");
  await expect(page.getByRole("heading", { level: 2, name: /^Historial \(\d+\)$/ })).toBeVisible();
  await page.goto("/cotizaciones/q-0003");
  await expect(page.getByRole("heading", { level: 2, name: /^Productos solicitados \(\d+\)$/ })).toBeVisible();
});

test("X10-1 fechas relativas con la hora exacta de Lima en auditoría e historial", async ({ page }) => {
  await signIn(page, "/actividad");
  const first = page.locator(".feed__time").first();
  await expect(first).toHaveText(/^(hace|ahora|dentro)/);
  await expect(first).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  await expect(first).toHaveAttribute("title", /\d{4}.*hora de Lima/);
  await page.goto("/reclamaciones/r-0002");
  const event = page.locator(".timeline time").first();
  await expect(event).toHaveText(/^(hace|ahora|ayer|anteayer)/);
  await expect(event).toHaveAttribute("title", /\d{4}.*hora de Lima/);
  const iso = await event.getAttribute("datetime");
  expect(Number.isNaN(Date.parse(iso!))).toBe(false);
});

test("B9-1 cifras tabulares en tablas, contadores y KPI", async ({ page, isMobile }) => {
  await signIn(page, "/panel");
  const tabular = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontVariantNumeric);
  await expect(page.locator(".kpi__value").first()).toBeVisible();
  expect(await tabular(".kpi__value")).toContain("tabular-nums");
  await page.goto("/reclamaciones");
  await expect(page.locator("main h1 .title-count")).toBeVisible();
  expect(await tabular("main h1 .title-count")).toContain("tabular-nums");
  expect(await tabular(".toolbar__count")).toContain("tabular-nums");
  expect(await tabular(".deadline")).toContain("tabular-nums");
  if (!isMobile) {
    expect(await tabular(".tabs__count")).toContain("tabular-nums");
    expect(await tabular(".nav-count")).toContain("tabular-nums");
    expect(await tabular("table td")).toContain("tabular-nums");
  }
});

test("X9-7 todo botón de solo ícono tiene nombre accesible", async ({ page, isMobile }) => {
  await signIn(page, "/panel");
  const unnamed = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("button, a[href], [role=button]")]
        .filter((el) => el.getClientRects().length > 0 && !(el.textContent ?? "").trim())
        .filter((el) => !el.getAttribute("aria-label")?.trim() && !el.getAttribute("aria-labelledby"))
        .map((el) => el.outerHTML.slice(0, 120)),
    );
  for (const path of [...SCREENS, "/reclamaciones/r-0002", "/cotizaciones/q-0003", "/usuarios?estado=pending"]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    if (isMobile) await page.getByRole("button", { name: "Abrir menú" }).click();
    expect(await unnamed(), path).toEqual([]);
    const axe = await new AxeBuilder({ page }).withRules(["button-name", "link-name", "aria-command-name", "svg-img-alt"]).analyze();
    expect(axe.violations.map((v) => v.id), path).toEqual([]);
  }
});

test("X8-5 al guardar un caso queda un mensaje de éxito descartable", async ({ page }) => {
  await signIn(page, "/privacidad/p-0002");
  await page.locator(".case-head").getByRole("button", { name: /Confirmar identidad|Iniciar supresión|Enviar constancia/ }).click();
  const flash = page.locator(".case-head").getByRole("status");
  await expect(flash).toContainText("Caso actualizado.");
  await expect(flash).toContainText("Guardado a las");
  // Un aviso flotante se iría a los 4 s; este sigue ahí.
  await page.waitForTimeout(5500);
  await expect(flash).toBeVisible();
  expect(await seriousAxe(page)).toEqual([]);
  await flash.getByRole("button", { name: "Cerrar mensaje" }).click();
  await expect(flash).toHaveCount(0);
});

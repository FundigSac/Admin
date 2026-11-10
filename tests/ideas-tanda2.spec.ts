import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Ideas de la tanda 2 (2026-11): KPI como filtros, estados vacíos, plazos legales, matriz de permisos, línea de
// tiempo y cotizaciones por etapa. Todo en modo demostración: los datos viven en el navegador, nunca en la API real.

const DB_KEY = "fundigsac-admin:db:v6";

/** Sesión de demostración (solo en desarrollo, sin Backend): ?__demo abre el panel directamente. */
async function open(page: Page, path: string) {
  await page.goto(`${path}${path.includes("?") ? "&" : "?"}__demo`);
  await expect(page.locator("main h1")).toBeVisible();
  // Firefox aborta un goto si la redirección de ?__demo aún no terminó; WebKit hidrata más tarde que Chromium.
  await page.waitForLoadState("networkidle");
}

/** Escribe en la búsqueda y reintenta si el texto llegó antes de la hidratación (WebKit lo descarta). */
async function search(page: Page, text: string, expected: ReturnType<Page["locator"]>) {
  const box = page.locator("main").getByRole("searchbox");
  await expect(async () => {
    await box.fill(text);
    await expect(expected).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}

async function editDemoDb(page: Page, edit: string) {
  // La base de demostración se guarda con la primera consulta, que puede llegar después del título.
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, DB_KEY);
  await page.evaluate(
    ([key, body]) => {
      const db = JSON.parse(localStorage.getItem(key)!);
      new Function("db", body)(db);
      localStorage.setItem(key, JSON.stringify(db));
    },
    [DB_KEY, edit] as const,
  );
  await page.reload();
  await expect(page.locator("main h1")).toBeVisible();
}

async function seriousAxe(page: Page) {
  const axe = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  return axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.length}`);
}

test("B4-1 un KPI filtra el gráfico y los últimos registros, y «Quitar filtro» lo deshace", async ({ page }) => {
  await open(page, "/panel");
  const pending = page.getByRole("button", { name: /Filtrar el gráfico y los últimos registros por «Por verificar»/ });
  const active = page.getByRole("button", { name: /Filtrar el gráfico y los últimos registros por «Activos esta semana»/ });
  await expect(pending).toBeEnabled();
  await expect(pending).toHaveAttribute("aria-pressed", "false");

  await pending.click();
  await expect(pending).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-segment-meta=pending]")).toContainText("por verificar");
  const latest = page.getByRole("region", { name: /Últimos registros por verificar/ });
  await expect(latest).toBeVisible();
  const rows = latest.locator(".row");
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(rows.filter({ hasNotText: "Pendiente" })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Mostrando solo: por verificar" })).toBeVisible();
  expect(await seriousAxe(page)).toEqual([]);

  // Solo un filtro a la vez: pulsar otro KPI cambia el subconjunto.
  await active.click();
  await expect(active).toHaveAttribute("aria-pressed", "true");
  await expect(pending).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("heading", { level: 2, name: /Últimos registros activos esta semana/ })).toBeVisible();

  await page.getByRole("button", { name: "Quitar filtro" }).click();
  await expect(active).toHaveAttribute("aria-pressed", "false");
  await expect(active).toBeFocused();
  await expect(page.getByRole("heading", { level: 2, name: /^Últimos registros/ })).toHaveText(/^Últimos registros\s*$/);
  await expect(page.getByRole("button", { name: "Quitar filtro" })).toHaveCount(0);
});

test("B4-1 el filtro se maneja con teclado", async ({ page, isMobile }) => {
  test.skip(isMobile, "Teclado físico: se prueba en escritorio");
  await open(page, "/panel");
  const pending = page.getByRole("button", { name: /^Filtrar .*«Por verificar»/ });
  await expect(pending).toBeEnabled();
  await pending.focus();
  await page.keyboard.press("Space");
  await expect(pending).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(pending).toHaveAttribute("aria-pressed", "false");
});

test("X8-1 las colas distinguen «Aún no hay…» de «Ningún resultado con estos filtros» con «Limpiar filtros»", async ({ page }) => {
  // Se entra por el resumen: Firefox aborta un goto a la misma URL que acaba de cargar (NS_BINDING_ABORTED).
  await open(page, "/panel");
  for (const path of ["/reclamaciones", "/cotizaciones"]) {
    await page.goto(path);
    const filtered = page.locator('[data-empty="filtered"]');
    await search(page, "zzzz-nada", filtered);
    await expect(filtered).toContainText("Ningún resultado con estos filtros");
    await filtered.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.locator("[data-empty]")).toHaveCount(0);
  }
  await editDemoDb(page, "db.claims = []; db.quotes = [];");
  for (const [path, title] of [
    ["/reclamaciones", "Aún no hay reclamaciones"],
    ["/cotizaciones", "Aún no hay cotizaciones"],
  ]) {
    await page.goto(path);
    const none = page.locator('[data-empty="none"]');
    await expect(none).toContainText(title);
    await expect(none.getByRole("button")).toHaveCount(0);
  }
});

test("X12-1 plazo de reclamaciones: En plazo, Por vencer y Vencido con ícono, forma y texto", async ({ page }) => {
  await open(page, "/reclamaciones");
  // Tres hojas abiertas: una vence hoy (por vencer), otra venció hace 10 días y otra vence en 30.
  await editDemoDb(
    page,
    "const open = db.claims.filter((c) => c.status !== 'answered'); const now = Date.now(); open[0].dueAt = now + 3600000; open[1].dueAt = now - 10 * 86400000; open[2].dueAt = now + 30 * 86400000;",
  );
  const chip = (state: string) => page.locator(`main .deadline[data-state="${state}"]:visible`).first();
  await expect(chip("soon")).toContainText("Por vencer");
  await expect(chip("late")).toContainText("Vencido");
  await expect(chip("ok")).toContainText("En plazo");
  const icons = await Promise.all(["ok", "soon", "late"].map((s) => chip(s).locator("svg").innerHTML()));
  expect(new Set(icons).size).toBe(3);
  // El texto está siempre, no solo el color: el estado se lee en el contenido accesible.
  await expect(page.getByText("Vence pronto")).toHaveCount(0);
});

test("X13-1 matriz de permisos de solo lectura, agrupada y plegable", async ({ page }) => {
  await open(page, "/roles");
  const matrix = page.getByRole("table");
  await expect(matrix.getByRole("columnheader", { name: "Administrador" })).toBeVisible();
  // Cada celda dice su estado en texto (para lectores de pantalla), no solo con el ícono.
  const cells = matrix.locator("td.matrix__cell");
  const total = await cells.count();
  expect(total).toBeGreaterThan(0);
  expect(await cells.filter({ hasText: /^(Permitido|No permitido)$/ }).count()).toBe(total);
  // Sin controles de edición: es una vista de solo lectura.
  await expect(matrix.locator("input, select, [role=checkbox], [role=switch]")).toHaveCount(0);

  const group = matrix.getByRole("button", { name: /^Comercial · 4 permisos$/ });
  await expect(group).toHaveAttribute("aria-expanded", "true");
  const row = matrix.getByRole("row", { name: /Ver cotizaciones/ });
  await expect(row).toBeVisible();
  await group.click();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await expect(row).toBeHidden();
  await group.focus();
  await page.keyboard.press("Enter");
  await expect(row).toBeVisible();

  await page.getByRole("button", { name: "Cerrar todos" }).click();
  await expect(matrix.locator("tbody tr:not(.matrix__group):visible")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir todos" }).click();
  expect(await seriousAxe(page)).toEqual([]);
});

test("B12-4 línea de tiempo vertical con cambios de estado y <time> en cotización y reclamación", async ({ page }) => {
  for (const path of ["/cotizaciones/q-0003", "/reclamaciones/r-0002"]) {
    await open(page, path);
    const items = page.locator(".timeline > li");
    expect(await items.count()).toBeGreaterThan(0);
    await expect(items.locator("time")).toHaveCount(await items.count());
    const status = page.locator('.timeline > li[data-kind="status"]');
    await expect(status.first()).toContainText("Cambio de estado");
  }
  // Un cambio de estado nuevo aparece arriba, marcado como tal.
  await open(page, "/cotizaciones?estado=new");
  await page.locator("main a[href^=\"/cotizaciones/q-\"]:visible").first().click();
  await expect(page.locator(".timeline > li").first()).toBeVisible();
  const before = await page.locator(".timeline > li").count();
  await page.locator(".case-head .btn--primary").first().click();
  await expect(page.locator(".timeline > li")).toHaveCount(before + 1);
  const first = page.locator(".timeline > li").first();
  await expect(first).toHaveAttribute("data-kind", "status");
  await expect(first.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
});

test("B2-2 cotizaciones por etapa: conteos de los estados reales y enlace a cada cola", async ({ page, isMobile }) => {
  await open(page, "/panel");
  const card = page.getByRole("region", { name: /Cotizaciones por etapa/ });
  await expect(card.locator("[data-stage]")).toHaveCount(4);
  const total = Number((await card.locator(".title-count").innerText()).replace(/\D/g, ""));
  const values = await card.locator("[data-stage] .barlist__value").evaluateAll((els) => els.map((el) => Number(el.firstChild!.textContent!.replace(/\D/g, ""))));
  const lost = Number((await card.getByRole("link", { name: /perdida/ }).innerText()).replace(/\D/g, ""));
  expect(values.reduce((a, b) => a + b, 0) + lost).toBe(total);
  await card.getByRole("link", { name: "En revisión" }).click();
  await page.waitForURL(/\/cotizaciones\?estado=reviewing/);
  if (isMobile) {
    // En el teléfono el estado se elige con una lista desplegable en vez de pestañas.
    await expect(page.locator("main select.status-select")).toHaveValue("reviewing");
    await expect(page.locator("main select.status-select option:checked")).toContainText(`(${values[1]})`);
  } else {
    await expect(page.getByRole("tab", { name: /En revisión/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: /En revisión/ }).locator(".tabs__count")).toHaveText(String(values[1]));
  }
});

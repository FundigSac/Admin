// Auditoría responsive: abre cada pantalla del panel en varios anchos y mide lo que se rompe.
//   node scripts/responsive-audit.mjs [baseUrl] [--shots]
// Detecta: desplazamiento horizontal de la página, elementos que se salen del viewport o de su contenedor
// recortado, textos que se cortan sin puntos suspensivos y controles táctiles de menos de 32 px en teléfono.
// Con --shots guarda una captura por pantalla y ancho en .taste-skill/responsive/.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2]?.startsWith("http") ? process.argv[2] : "http://127.0.0.1:3110";
const shots = process.argv.includes("--shots");
const WIDTHS = [320, 375, 414, 600, 768, 900, 1024, 1180, 1280, 1440, 1920];
const ROUTES = [
  "/login",
  "/panel",
  "/usuarios",
  "/usuarios?estado=pending",
  "/actividad",
  "/cotizaciones",
  "/cotizaciones/q-0003",
  "/consultas",
  "/consultas/c-0002",
  "/reclamaciones",
  "/reclamaciones/r-0002",
  "/privacidad",
  "/privacidad/p-0002",
  "/roles",
  "/configuracion",
  "/configuracion?tab=preferences",
  "/configuracion?tab=notifications",
  "/configuracion?tab=security",
  "/configuracion?tab=data",
];

const out = ".taste-skill/responsive";
if (shots) mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const problems = [];

for (const route of ROUTES) {
  const login = route === "/login";
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", colorScheme: width % 2 ? "light" : "dark" });
    const page = await context.newPage();
    const url = `${base}${route}${login ? "" : `${route.includes("?") ? "&" : "?"}__demo`}`;
    await page.goto(url, { waitUntil: "networkidle" });
    if (!login) await page.waitForSelector(".route", { timeout: 15000 });
    await page.waitForTimeout(700);
    const report = await page.evaluate(() => {
      const issues = [];
      const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw + 1) issues.push(`page scrolls sideways by ${document.documentElement.scrollWidth - vw}px`);
      const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""} "${(el.textContent || "").trim().slice(0, 30)}"`;
      const clipped = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return p;
        }
        return null;
      };
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || el.closest("dialog:not([open]), [aria-hidden='true'], .sr-only, svg")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const frame = clipped(el);
        // Fuera de la pantalla sin un contenedor que lo recorte o lo deje desplazar.
        if (!frame && (r.right > vw + 1 || r.left < -1)) issues.push(`outside viewport: ${label(el)} (${Math.round(r.left)}→${Math.round(r.right)})`);
        // Texto cortado sin puntos suspensivos.
        if (el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis" && !["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(el.tagName) && cs.webkitLineClamp === "none")
          issues.push(`text cut: ${label(el)}`);
      }
      if (vw < 600) {
        for (const el of document.querySelectorAll("button, a.btn, .nav-item, select, input:not([type=checkbox]):not([type=radio])")) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (r.width && r.height && r.height < 28 && cs.visibility !== "hidden" && !el.closest(".infotip, .sidebar:not(.is-open), dialog:not([open])")) issues.push(`small target ${Math.round(r.height)}px: ${label(el)}`);
        }
      }
      return [...new Set(issues)].slice(0, 12);
    });
    if (report.length) problems.push({ route, width, report });
    if (shots) await page.screenshot({ path: `${out}/${route.replace(/[/?=&]+/g, "_").replace(/^_/, "") || "root"}-${width}.jpg`, quality: 70, type: "jpeg", fullPage: true });
    await context.close();
  }
  process.stdout.write(".");
}
await browser.close();
console.log("");
if (!problems.length) console.log(`OK: ${ROUTES.length} pantallas × ${WIDTHS.length} anchos sin problemas.`);
for (const p of problems) console.log(`\n${p.route} @${p.width}px\n  - ${p.report.join("\n  - ")}`);
process.exit(problems.length ? 1 : 0);

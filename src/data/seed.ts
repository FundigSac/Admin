import { buildCases } from "./cases-seed";
import { ADMIN_EMAIL, ADMIN_NAME, STAFF } from "./demo-account";
import type { Activity, ActivityType, SignupMethod, SignupSource, User, UserStatus } from "./types";

// Datos de demostración: personas y empresas ficticias. Se generan con una semilla fija para que el panel se vea
// igual en cada carga, y las fechas se calculan desde "ahora" para que la demo nunca envejezca.

const FIRST = [
  "María", "José", "Luis", "Rosa", "Carlos", "Ana", "Jorge", "Lucía", "Miguel", "Carmen", "Juan", "Patricia", "Víctor", "Elena",
  "Fernando", "Sofía", "Ricardo", "Diana", "Raúl", "Gabriela", "Óscar", "Valeria", "Hugo", "Milagros", "César", "Andrea", "Iván",
  "Natalia", "Renzo", "Claudia", "Alonso", "Fiorella",
];
const LAST = [
  "Quispe", "Flores", "Huamán", "Mamani", "Rojas", "Sánchez", "García", "Torres", "Ramírez", "Chávez", "Mendoza", "Vargas",
  "Castillo", "Paredes", "Gutiérrez", "Salazar", "Cárdenas", "Ccahuana", "Espinoza", "Villanueva", "Ticona", "Aguilar", "Benites", "Palomino",
];
const COMPANIES = [
  "Constructora Los Andes S.A.C.", "Riego Valle Sur E.I.R.L.", "Ingeniería Hidráulica Pacífico S.A.C.", "Minera Cerro Azul S.A.",
  "Saneamiento Integral del Norte S.A.C.", "Agroexportadora Santa Rosa S.A.", "Consorcio Agua Limpia", "Montajes Industriales Rímac S.A.C.",
  "Obras y Proyectos Huancayo E.I.R.L.", "Tecnoriego Perú S.A.C.", "Servicios Mineros Altiplano S.A.C.", "Proyectos Civiles Chiclayo S.A.C.",
  "Distribuidora Ferretera Lima Centro", "Hidrosistemas Arequipa S.A.C.",
];
const CITIES = ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Piura", "Cusco", "Huancayo", "Ica", "Puno", "Cajamarca", "Tacna", "Callao"];
const MAIL = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com"];
const PRIVACY_VERSION = "2026-10";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SEED_SIZE = 86;

// mulberry32: PRNG pequeño y determinista.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function uuid(r: () => number) {
  const hex = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** RUC de persona jurídica (prefijo 20) con dígito verificador de SUNAT válido. */
function ruc(r: () => number) {
  const body = `20${Array.from({ length: 8 }, () => Math.floor(r() * 10)).join("")}`;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(body[i]), 0);
  const check = (11 - (sum % 11)) % 10;
  return `${body}${check}`;
}

function companyDomain(company: string) {
  return `${slug(company.replace(/S\.A\.C\.|E\.I\.R\.L\.|S\.A\./g, "")).slice(0, 16)}.pe`;
}

export function buildSeed(now: number) {
  const r = rng(20261019);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)];
  const rucByCompany = new Map(COMPANIES.map((c) => [c, c.startsWith("Consorcio") || c.startsWith("Distribuidora") ? null : ruc(r)]));
  const users: User[] = [];

  for (let i = 0; i < SEED_SIZE; i += 1) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const name = `${first} ${last} ${pick(LAST)}`;
    const company = r() < 0.72 ? pick(COMPANIES) : null;
    const handle = `${slug(first)}.${slug(last)}${r() < 0.4 ? Math.floor(r() * 90 + 10) : ""}`;
    const roll = r();
    const method: SignupMethod = roll < 0.48 ? "google" : roll < 0.86 ? "email" : "facebook";
    const email = method === "email" && company ? `${handle}@${companyDomain(company)}` : `${handle}@${method === "google" ? "gmail.com" : pick(MAIL)}`;

    // Más registros recientes que antiguos: la curva crece hacia hoy, como un sitio que empieza a captar cuentas.
    const registeredAt = Math.round(now - Math.pow(r(), 1.7) * 120 * DAY - r() * 6 * HOUR);
    const verified = method !== "email" || r() < 0.8;
    const status: UserStatus = r() < 0.06 ? "disabled" : verified ? "active" : "pending";
    const active = status === "active";
    const lastActiveAt = status === "pending" ? null : Math.round(Math.min(now - 5 * MINUTE, registeredAt + r() * (now - registeredAt)));

    users.push({
      id: uuid(r),
      kind: "customer",
      name,
      email,
      company,
      ruc: company ? (rucByCompany.get(company) ?? null) : null,
      phone: r() < 0.64 ? `+51 9${Math.floor(r() * 90 + 10)} ${Math.floor(r() * 900 + 100)} ${Math.floor(r() * 900 + 100)}` : null,
      method,
      status,
      roles: ["customer"],
      emailVerified: verified,
      newsletter: r() < 0.41,
      privacyNoticeVersion: PRIVACY_VERSION,
      source: pick<SignupSource>(["registro", "registro", "registro", "carrito", "cotizar", "login"]),
      registeredAt,
      lastActiveAt,
      quotes: active ? Math.floor(Math.pow(r(), 2) * 9) : 0,
      cartItems: active ? Math.floor(r() * 5) : 0,
      sessions: active ? Math.floor(r() * 30) + 1 : status === "disabled" ? Math.floor(r() * 6) + 1 : 0,
      city: pick(CITIES),
      device: r() < 0.58 ? "mobile" : "desktop",
      notes: "",
      version: 0,
    });
  }

  // Personal de FUNDIGSAC con roles de gestión (cuentas STAFF del Backend).
  STAFF.forEach(({ name, email, roles }, i) => {
    users.push({
      id: uuid(r),
      kind: "staff",
      name,
      email,
      company: "FUNDIGSAC S.A.C.",
      ruc: null,
      phone: null,
      method: "email",
      status: "active",
      roles: [...roles],
      emailVerified: true,
      newsletter: false,
      privacyNoticeVersion: PRIVACY_VERSION,
      source: "login",
      registeredAt: now - (150 + i * 4) * DAY,
      lastActiveAt: now - (i + 1) * 47 * MINUTE,
      quotes: 0,
      cartItems: 0,
      sessions: 80 + i * 13,
      city: "Lima",
      device: "desktop",
      notes: "",
      version: 3,
    });
  });

  users.sort((a, b) => b.registeredAt - a.registeredAt);
  const activity = buildActivity(users, now, r);
  const cases = buildCases(now, users, rng(20261020));
  // Una sola fuente de verdad: el conteo de cotizaciones de cada cuenta y su historial salen de las cotizaciones
  // vinculadas, para que la ficha, la lista y la auditoría digan lo mismo.
  for (const u of users) {
    const own = cases.quotes.filter((q) => q.userId === u.id);
    u.quotes = own.length;
    for (const q of own) activity.push({ id: `evt_q_${q.id}`, at: q.createdAt, type: "quote", userId: u.id, userName: u.name, actor: null, detail: q.code });
  }
  activity.sort((a, b) => b.at - a.at);
  return { users, activity, ...cases };
}

function buildActivity(users: User[], now: number, r: () => number): Activity[] {
  const events: Activity[] = [];
  let n = 0;
  const push = (type: ActivityType, user: User, at: number, actor: string | null = null, detail?: string) => {
    if (at > now) return;
    events.push({ id: `evt_${(n += 1)}`, at: Math.round(at), type, userId: user.id, userName: user.name, actor, detail });
  };

  for (const u of users) {
    if (u.kind === "staff") {
      if (u.email !== ADMIN_EMAIL) push("invite", u, u.registeredAt, ADMIN_NAME, u.roles.join(","));
      if (u.lastActiveAt) push("login", u, u.lastActiveAt);
      continue;
    }
    push("signup", u, u.registeredAt, null, u.method);
    if (u.emailVerified && u.method === "email") push("verify", u, u.registeredAt + r() * 3 * HOUR);
    if (u.lastActiveAt) push("login", u, u.lastActiveAt);
    if (u.status === "disabled") push("disable", u, (u.lastActiveAt ?? u.registeredAt) + HOUR, ADMIN_NAME);
    if (r() < 0.05) push("password", u, u.registeredAt + r() * (now - u.registeredAt));
  }
  return events.sort((a, b) => b.at - a.at);
}

import { buildSeed } from "@/data/seed";
import type { Activity, ActivityType, User, UserStatus } from "@/data/types";
import type { ActivityParams, DashboardStats, PageResult, RangeKey, UserDraft, UserListParams, UserListResult, UsersApi } from "./contract";

// Adaptador local: simula el Backend en el navegador. Guarda la "base" en localStorage para que los cambios
// (suspender, editar, crear) persistan entre recargas. Fase de diseño: no hay servidor ni base de datos real.

const KEY = "fundigsac-admin:db:v1";
const DAY = 86_400_000;
/** Pasada una semana se vuelve a sembrar, para que las gráficas de "últimos 30 días" no se queden vacías. */
const MAX_AGE = 7 * DAY;

type Db = { seededAt: number; users: User[]; activity: Activity[] };

let memory: Db | null = null;

function load(): Db {
  if (memory) return memory;
  const now = Date.now();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (Array.isArray(parsed.users) && now - parsed.seededAt < MAX_AGE) return (memory = parsed);
    }
  } catch {
    // Sin almacenamiento (modo privado o bloqueado): se trabaja solo en memoria.
  }
  const seed = buildSeed(now);
  memory = { seededAt: now, ...seed };
  save();
  return memory;
}

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Igual que en load(): la sesión sigue en memoria.
  }
}

/** Latencia de red simulada, para que los estados de carga se vean como en producción. */
function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function rangeStart(range: RangeKey | undefined, now: number) {
  if (!range || range === "all") return 0;
  return now - Number.parseInt(range, 10) * DAY;
}

function matches(u: User, p: UserListParams, now: number, ignoreStatus = false) {
  if (p.q) {
    const q = normalize(p.q.trim());
    const hay = normalize(`${u.name} ${u.email} ${u.company ?? ""} ${u.ruc ?? ""} ${u.phone ?? ""} ${u.city}`);
    if (!q.split(/\s+/).every((part) => hay.includes(part))) return false;
  }
  if (!ignoreStatus && p.status && p.status !== "all" && u.status !== p.status) return false;
  if (p.method && p.method !== "all" && u.method !== p.method) return false;
  if (p.role && p.role !== "all" && !u.roles.includes(p.role)) return false;
  if (p.kind && p.kind !== "all" && u.kind !== p.kind) return false;
  if (u.registeredAt < rangeStart(p.range, now)) return false;
  return true;
}

const STATUS_ORDER: Record<UserStatus, number> = { active: 0, pending: 1, disabled: 2 };

function compare(a: User, b: User, sort: UserListParams["sort"]) {
  const s = sort ?? { id: "registeredAt", desc: true };
  let diff = 0;
  if (s.id === "name") diff = a.name.localeCompare(b.name, "es");
  else if (s.id === "status") diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  else if (s.id === "lastActiveAt") diff = (a.lastActiveAt ?? 0) - (b.lastActiveAt ?? 0);
  else diff = a[s.id] - b[s.id];
  return s.desc ? -diff : diff;
}

function filtered(p: UserListParams) {
  const now = Date.now();
  return load()
    .users.filter((u) => matches(u, p, now))
    .sort((a, b) => compare(a, b, p.sort));
}

function log(type: ActivityType, user: User, actor: string | null, detail?: string) {
  const db = load();
  db.activity.unshift({ id: `evt_${crypto.randomUUID()}`, at: Date.now(), type, userId: user.id, userName: user.name, actor, detail });
}

function find(id: string) {
  const user = load().users.find((u) => u.id === id);
  if (!user) throw new Error("not_found");
  return user;
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  // Evita inyección de fórmulas al abrir el CSV en Excel.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const mockAdapter: UsersApi = {
  async listUsers(p) {
    const now = Date.now();
    const users = load().users;
    const rows = filtered(p);
    const totalPages = Math.max(1, Math.ceil(rows.length / p.size));
    const page = Math.min(p.page, totalPages - 1);
    const base = users.filter((u) => matches(u, p, now, true));
    const statusCounts = { all: base.length, active: 0, pending: 0, disabled: 0 };
    base.forEach((u) => (statusCounts[u.status] += 1));
    const result: UserListResult = {
      items: rows.slice(page * p.size, page * p.size + p.size),
      page,
      size: p.size,
      totalItems: rows.length,
      totalPages,
      statusCounts,
    };
    return delay(result);
  },

  async getUser(id) {
    return delay(load().users.find((u) => u.id === id) ?? null, 200);
  },

  async stats(range) {
    const now = Date.now();
    const customers = load().users.filter((u) => u.kind === "customer");
    const days = range === "all" ? 120 : Number.parseInt(range, 10);
    const start = now - days * DAY;
    const prevStart = start - days * DAY;
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    const series = Array.from({ length: days }, (_, i) => ({ day: startOfToday - (days - 1 - i) * DAY, count: 0 }));
    const byMethod = { email: 0, google: 0, facebook: 0 };
    const byStatus = { active: 0, pending: 0, disabled: 0 };
    const sources = new Map<string, number>();
    const cities = new Map<string, number>();
    let newInRange = 0;
    let newPrevRange = 0;
    let activeWeek = 0;
    const funnel = { registered: 0, verified: 0, quoted: 0 };

    for (const u of customers) {
      byStatus[u.status] += 1;
      if (u.lastActiveAt && u.lastActiveAt >= now - 7 * DAY) activeWeek += 1;
      if (u.registeredAt >= start) {
        newInRange += 1;
        funnel.registered += 1;
        if (u.emailVerified) funnel.verified += 1;
        if (u.quotes > 0) funnel.quoted += 1;
        byMethod[u.method] += 1;
        sources.set(u.source, (sources.get(u.source) ?? 0) + 1);
        cities.set(u.city, (cities.get(u.city) ?? 0) + 1);
        const idx = Math.floor((u.registeredAt - (startOfToday - (days - 1) * DAY)) / DAY);
        if (series[idx]) series[idx].count += 1;
      } else if (u.registeredAt >= prevStart) newPrevRange += 1;
    }

    const pending = customers.filter((u) => u.status === "pending").sort((a, b) => a.registeredAt - b.registeredAt);
    const sortDesc = (map: Map<string, number>) => [...map].sort((a, b) => b[1] - a[1]);
    const stats: DashboardStats = {
      total: customers.length,
      newInRange,
      newPrevRange,
      pending: byStatus.pending,
      activeWeek,
      disabled: byStatus.disabled,
      verifiedRate: customers.filter((u) => u.emailVerified).length / Math.max(1, customers.length),
      newsletterRate: customers.filter((u) => u.newsletter).length / Math.max(1, customers.length),
      series,
      byMethod,
      byStatus,
      bySource: sortDesc(sources).map(([source, count]) => ({ source, count })),
      byCity: sortDesc(cities)
        .slice(0, 5)
        .map(([city, count]) => ({ city, count })),
      latest: [...customers].sort((a, b) => b.registeredAt - a.registeredAt).slice(0, 6),
      funnel,
      pendingOldest: pending.slice(0, 4),
      pendingOver48h: pending.filter((u) => now - u.registeredAt > 2 * DAY).length,
      generatedAt: now,
    };
    return delay(stats, 320);
  },

  async listActivity(p: ActivityParams) {
    let rows = load().activity;
    if (p.userId) rows = rows.filter((a) => a.userId === p.userId);
    if (p.type && p.type !== "all") rows = rows.filter((a) => a.type === p.type);
    if (p.q) {
      const q = normalize(p.q.trim());
      rows = rows.filter((a) => normalize(`${a.userName} ${a.actor ?? ""} ${a.detail ?? ""}`).includes(q));
    }
    const totalPages = Math.max(1, Math.ceil(rows.length / p.size));
    const page = Math.min(p.page, totalPages - 1);
    const result: PageResult<Activity> = { items: rows.slice(page * p.size, page * p.size + p.size), page, size: p.size, totalItems: rows.length, totalPages };
    return delay(result);
  },

  async createUser(draft: UserDraft, actor) {
    const db = load();
    const email = draft.email.trim().toLowerCase();
    if (db.users.some((u) => u.email === email)) throw new Error("email_taken");
    const now = Date.now();
    const user: User = {
      id: crypto.randomUUID(),
      kind: draft.kind,
      name: draft.name.trim(),
      email,
      company: draft.company || null,
      ruc: draft.ruc || null,
      phone: draft.phone || null,
      method: "email",
      status: draft.status,
      roles: draft.roles,
      emailVerified: false,
      newsletter: false,
      privacyNoticeVersion: "2026-10",
      source: "registro",
      registeredAt: now,
      lastActiveAt: null,
      quotes: 0,
      cartItems: 0,
      sessions: 0,
      city: "Lima",
      device: "desktop",
      notes: draft.notes ?? "",
      version: 0,
    };
    db.users.unshift(user);
    log(draft.kind === "staff" ? "invite" : "signup", user, actor, draft.kind === "staff" ? draft.roles.join(",") : "email");
    save();
    return delay(user, 420);
  },

  async updateUser(id, patch, actor) {
    const db = load();
    const user = find(id);
    if (patch.email) {
      const email = patch.email.trim().toLowerCase();
      if (db.users.some((u) => u.email === email && u.id !== id)) throw new Error("email_taken");
      patch.email = email;
    }
    const rolesChanged = patch.roles && patch.roles.join() !== user.roles.join();
    Object.assign(user, patch, { version: user.version + 1 });
    log(rolesChanged ? "roles" : "update", user, actor, rolesChanged ? user.roles.join(",") : undefined);
    save();
    return delay(user, 380);
  },

  async setStatus(ids, status, actor) {
    for (const id of ids) {
      const user = find(id);
      if (user.status === status) continue;
      user.status = status;
      user.version += 1;
      log(status === "disabled" ? "disable" : "enable", user, actor);
    }
    save();
    return delay(undefined, 380);
  },

  async deleteUsers(ids, actor) {
    const db = load();
    for (const id of ids) {
      const user = find(id);
      log("delete", user, actor);
    }
    db.users = db.users.filter((u) => !ids.includes(u.id));
    save();
    return delay(undefined, 420);
  },

  async resendVerification(id) {
    find(id);
    return delay(undefined, 500);
  },

  async sendPasswordReset(id, actor) {
    log("password", find(id), actor);
    save();
    return delay(undefined, 500);
  },

  async exportCsv(p) {
    const header = ["id", "nombre", "correo", "empresa", "ruc", "celular", "metodo", "estado", "roles", "correo_verificado", "boletin", "origen", "ciudad", "registrado", "ultima_actividad", "cotizaciones"];
    const iso = (t: number | null) => (t ? new Date(t).toISOString() : "");
    const lines = filtered(p).map((u) =>
      [u.id, u.name, u.email, u.company, u.ruc, u.phone, u.method, u.status, u.roles.join("|"), u.emailVerified, u.newsletter, u.source, u.city, iso(u.registeredAt), iso(u.lastActiveAt), u.quotes].map(csvCell).join(","),
    );
    // BOM para que Excel abra las tildes correctamente.
    return delay(`﻿${[header.join(","), ...lines].join("\r\n")}`, 200);
  },

  async reset() {
    memory = null;
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // nada que limpiar
    }
    load();
    return delay(undefined, 300);
  },
};

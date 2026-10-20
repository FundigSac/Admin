import type {
  Activity,
  ActivityType,
  CaseEvent,
  Claim,
  ClaimStatus,
  DocType,
  Inquiry,
  InquiryStatus,
  PrivacyRequest,
  PrivacyStatus,
  ProductFamily,
  ProjectType,
  Quote,
  QuoteSource,
  QuoteStatus,
  SignupSource,
  User,
  UserRole,
  UserStatus,
} from "@/data/types";
import { addBusinessDays, businessDaysLeft } from "@/lib/business-days";
import type { CaseListResult, CaseMap, CaseModule, DashboardStats, PageResult, QueueCounts, StaffMember, UserListParams, UsersApi } from "./contract";

// Adaptador del Backend real: llama al BFF del panel (/api/backend/staff/... → /api/v1/staff/...) y traduce sus vistas
// al modelo del panel. Las colas de atención son pequeñas (B2B), así que se leen completas y se filtran aquí, como en
// la demostración; las cuentas se filtran y paginan en el Backend.

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

type Res<T> = { data: T; etag: string | null };

async function call<T>(path: string, init: { method?: string; body?: unknown; ifMatch?: string | null } = {}): Promise<Res<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.ifMatch) headers["If-Match"] = init.ifMatch;
  const res = await fetch(`/api/backend/staff/${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (res.status === 401 && json?.error === "SESSION_EXPIRED") {
    // La sesión de la API venció o se revocó: se vuelve a ingresar sin perder la pantalla de destino.
    // Recarga completa a propósito: borra la caché de datos de la sesión que venció (no hay router fuera de React).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new ApiError(401, "SESSION_EXPIRED");
  }
  if (!res.ok) throw new ApiError(res.status, json?.error ?? "ERROR");
  return { data: json as T, etag: res.headers.get("ETag") };
}

const get = async <T>(path: string) => (await call<T>(path)).data;
const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== "all") s.set(k, String(v));
  const text = s.toString();
  return text ? `?${text}` : "";
};
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : null);
/** Fecha sin hora de la API (AAAA-MM-DD) como instante local al final del día (los plazos vencen al cerrar el día). */
const endOfLocalDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
};
const startOfLocalDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

// ───────── Cuentas ─────────

type Row = {
  id: string; kind: string; fullName: string; email: string; companyName: string | null; ruc: string | null; phone: string | null;
  signupMethod: string; status: string; roles: string[]; emailVerified: boolean; newsletter: boolean; privacyNoticeVersion: string | null;
  signupSource: string | null; createdAt: string; lastLoginAt: string | null; quotes: number; cartItems: number; activeSessions: number; signIns: number;
  notes: string | null; version: number;
};

const STATUS_IN: Record<string, UserStatus> = { ACTIVE: "active", PENDING_VERIFICATION: "pending", DISABLED: "disabled" };
const STATUS_OUT: Record<UserStatus, string> = { active: "ACTIVE", pending: "PENDING_VERIFICATION", disabled: "DISABLED" };
const SOURCES = new Set<SignupSource>(["registro", "carrito", "cotizar", "login"]);

function user(r: Row): User {
  return {
    id: r.id,
    kind: r.kind === "STAFF" ? "staff" : "customer",
    name: r.fullName,
    email: r.email,
    company: r.companyName,
    ruc: r.ruc,
    phone: r.phone,
    method: r.signupMethod === "GOOGLE" ? "google" : r.signupMethod === "FACEBOOK" ? "facebook" : "email",
    status: STATUS_IN[r.status] ?? "pending",
    roles: r.roles.map((x) => x.toLowerCase() as UserRole),
    emailVerified: r.emailVerified,
    newsletter: r.newsletter,
    privacyNoticeVersion: r.privacyNoticeVersion ?? "",
    source: SOURCES.has(r.signupSource as SignupSource) ? (r.signupSource as SignupSource) : "registro",
    registeredAt: Date.parse(r.createdAt),
    lastActiveAt: ms(r.lastLoginAt),
    quotes: r.quotes,
    cartItems: r.cartItems,
    sessions: r.signIns,
    // El Backend no recopila ciudad ni dispositivo: la ficha muestra "—".
    city: "",
    device: null,
    notes: r.notes ?? "",
    version: r.version,
  };
}

function listQuery(p: UserListParams) {
  return qs({
    q: p.q?.trim(),
    status: p.status && p.status !== "all" ? STATUS_OUT[p.status] : undefined,
    kind: p.kind && p.kind !== "all" ? p.kind.toUpperCase() : undefined,
    method: p.method && p.method !== "all" ? p.method.toUpperCase() : undefined,
    role: p.role && p.role !== "all" ? p.role.toUpperCase() : undefined,
    range: p.range,
    sort: p.sort?.id,
    desc: p.sort ? p.sort.desc : true,
    page: p.page,
    size: p.size,
  });
}

/** La versión vigente (ETag) de una cuenta: el Backend la exige en If-Match para cualquier cambio. */
const etagOf = async (id: string) => (await call<Row>(`accounts/${id}`)).etag;

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  // Evita inyección de fórmulas al abrir el CSV en Excel.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// ───────── Personal (responsables) ─────────

type StaffView = { id: string; fullName: string; email: string; roles: string[] };
let staffCache: { at: number; promise: Promise<StaffMember[]> } | null = null;

function staffList(): Promise<StaffMember[]> {
  if (staffCache && Date.now() - staffCache.at < 60_000) return staffCache.promise;
  const promise = get<PageResult<StaffView>>("users?size=100").then((page) =>
    page.items.map((s) => ({ id: s.id, name: s.fullName, email: s.email, roles: s.roles.map((r) => r.toLowerCase() as UserRole) })),
  );
  staffCache = { at: Date.now(), promise };
  promise.catch(() => (staffCache = null));
  return promise;
}

async function staffName(id: string | null): Promise<string | null> {
  if (!id) return null;
  return (await staffList().catch(() => [])).find((s) => s.id === id)?.name ?? null;
}

async function staffId(name: string): Promise<string> {
  const found = (await staffList()).find((s) => s.name === name);
  if (!found) throw new ApiError(400, "UNKNOWN_ASSIGNEE");
  return found.id;
}

// ───────── Casos: lectura ─────────

type QuoteSummary = { id: string; folio: string; origin: string; status: string; companyName: string; contactName: string; email: string; lineCount: number; assigneeId: string | null; submittedAt: string };
type QuoteDetail = {
  id: string; folio: string; origin: string; status: string;
  contact: { companyName: string; ruc: string; contactName: string; position: string | null; email: string; phone: string };
  project: { projectType: string | null; deliveryDepartment: string | null; deliveryPlace: string | null; requestedDeliveryDate: string | null; message: string | null };
  items: { productName: string; variantLabel: string | null; quantity: number; unit: string }[];
  customerId: string | null; assigneeId: string | null; statusReason: string | null;
  history: { from: string | null; to: string; note: string | null; actorId: string | null; occurredAt: string }[];
  submittedAt: string;
};
type InquirySummary = { id: string; folio: string; reason: string; status: string; fullName: string; companyName: string; email: string; assigneeId: string | null; receivedAt: string };
type InquiryDetail = InquirySummary & { ruc: string | null; position: string | null; phone: string; message: string; history: QuoteDetail["history"] };
type ClaimSummary = { id: string; folio: string; kind: string; status: string; consumerName: string; filedAt: string; responseDueOn: string; assigneeId: string | null };
type ClaimDetail = ClaimSummary & {
  document: string; email: string; phone: string; address: string; minor: boolean; guardianName: string | null; guardianDocument: string | null;
  goodType: string | null; goodDescription: string; claimedAmount: { amount: number; currency: string } | null; serviceLocation: string | null;
  incidentDate: string; relatedReference: string | null; facts: string; consumerRequest: string; responseChannel: string;
  responseText: string | null; respondedAt: string | null; history: { type: string; note: string | null; actorId: string | null; occurredAt: string }[];
};
type PrivacyView = { id: string; folio: string; type: string; status: string; fullName: string; email: string; details: string; resolutionNote: string | null; receivedAt: string; resolvedAt: string | null; resolvedBy: string | null };

const PATHS: Record<CaseModule, string> = { quotes: "quotes", inquiries: "inquiries", claims: "complaints", privacy: "privacy/requests" };

const QUOTE_STATUS: Record<string, QuoteStatus> = { RECEIVED: "new", ASSIGNED: "reviewing", IN_REVIEW: "reviewing", RESPONDED: "sent", CANCELLED: "lost" };
const INQUIRY_STATUS: Record<string, InquiryStatus> = { RECEIVED: "new", IN_PROGRESS: "new", ANSWERED: "answered", CLOSED: "closed" };
const CLAIM_STATUS: Record<string, ClaimStatus> = { FILED: "received", IN_REVIEW: "in_progress", ANSWERED: "answered", CLOSED: "answered" };
const PRIVACY_STATUS: Record<string, PrivacyStatus> = { RECEIVED: "received", IN_PROGRESS: "processing", RESOLVED: "done", REJECTED: "done" };
const SOURCE: Record<string, QuoteSource> = { GENERAL_FORM: "general", PRODUCT_FORM: "product", PROCUREMENT: "procurement", CART: "cart" };
const PROJECT: Record<string, ProjectType> = { "Agua y saneamiento": "saneamiento", "Redes y matrices": "matrices", "Alcantarillado y drenaje": "alcantarillado" };
const FAMILY: [RegExp, ProductFamily][] = [[/v[aá]lvul/i, "valvulas"], [/tuber/i, "tuberias"], [/marco|tapa/i, "marcos_tapas"]];
const DOC: Record<string, DocType> = { DNI: "DNI", CE: "CE", RUC: "RUC", PASSPORT: "Pasaporte" };
/** Marca en la nota de cierre que distingue una cotización perdida de una ganada (el Backend las cierra igual). */
const LOST_NOTE = "Perdida";
const WON_NOTE = "Ganada";

function quoteStatus(status: string, closingNote?: string | null): QuoteStatus {
  if (status === "CLOSED") return closingNote === LOST_NOTE ? "lost" : "won";
  return QUOTE_STATUS[status] ?? "new";
}

function familyOf(text: string): ProductFamily {
  const families = new Set(FAMILY.filter(([re]) => re.test(text)).map(([, f]) => f));
  return families.size === 1 ? [...families][0] : "mixto";
}

const QUOTE_EVENT: Record<string, string> = { RECEIVED: "received", ASSIGNED: "assigned", IN_REVIEW: "reviewing", RESPONDED: "sent", CANCELLED: "lost" };

async function quoteFrom(q: QuoteDetail): Promise<Quote> {
  const closing = [...q.history].reverse().find((h) => h.to === "CLOSED")?.note;
  const assignee = await staffName(q.assigneeId);
  const history: CaseEvent[] = await Promise.all(
    q.history.map(async (h) => ({
      at: Date.parse(h.occurredAt),
      label: h.to === "CLOSED" ? (h.note === LOST_NOTE ? "lost" : "won") : (QUOTE_EVENT[h.to] ?? h.to.toLowerCase()),
      actor: await staffName(h.actorId),
      note: h.to === "ASSIGNED" ? (assignee ?? undefined) : h.note && h.note !== LOST_NOTE && h.note !== WON_NOTE ? h.note : undefined,
    })),
  );
  return {
    id: q.id,
    code: q.folio,
    createdAt: Date.parse(q.submittedAt),
    status: quoteStatus(q.status, closing),
    source: SOURCE[q.origin] ?? "general",
    company: q.contact.companyName,
    ruc: q.contact.ruc,
    contactName: q.contact.contactName,
    contactRole: q.contact.position ?? "",
    email: q.contact.email,
    phone: q.contact.phone,
    projectType: PROJECT[q.project.projectType ?? ""] ?? "otro",
    destination: q.project.deliveryDepartment ?? q.project.deliveryPlace ?? "",
    family: familyOf([q.project.message ?? "", ...q.items.map((i) => i.productName)].join(" ")),
    items: q.items.map((i) => ({ product: i.productName, dn: i.variantLabel ?? "", qty: Number(i.quantity), unit: i.unit === "m" ? "m" : "und" })),
    deliveryBy: q.project.requestedDeliveryDate ? startOfLocalDay(q.project.requestedDeliveryDate) : null,
    message: q.project.message ?? "",
    assignee,
    userId: q.customerId,
    history,
  };
}

const INQUIRY_EVENT: Record<string, string> = { RECEIVED: "received", IN_PROGRESS: "reviewing", ANSWERED: "replied", CLOSED: "closed" };

async function inquiryFrom(i: InquiryDetail): Promise<Inquiry> {
  const assignee = await staffName(i.assigneeId);
  const reply = [...i.history].reverse().find((h) => h.to === "ANSWERED" && h.note)?.note ?? null;
  return {
    id: i.id,
    code: i.folio,
    createdAt: Date.parse(i.receivedAt),
    status: INQUIRY_STATUS[i.status] ?? "new",
    fullName: i.fullName,
    company: i.companyName,
    ruc: i.ruc ?? "",
    position: i.position ?? "",
    email: i.email,
    phone: i.phone,
    reason: i.reason === "DOCUMENTATION" ? "documentacion" : i.reason === "MEETING" ? "reunion" : "general",
    message: i.message,
    reply,
    assignee,
    history: await Promise.all(
      i.history.map(async (h) => ({ at: Date.parse(h.occurredAt), label: INQUIRY_EVENT[h.to] ?? h.to.toLowerCase(), actor: await staffName(h.actorId), note: h.to === "ANSWERED" ? undefined : (h.note ?? undefined) })),
    ),
  };
}

const CLAIM_EVENT: Record<string, string> = { FILED: "received", ASSIGNED: "assigned", NOTE: "note", ANSWERED: "answered", CLOSED: "closed" };

async function claimFrom(c: ClaimDetail): Promise<Claim> {
  const [docType, ...docRest] = c.document.split(" ");
  const assignee = await staffName(c.assigneeId);
  const answeredBy = [...c.history].reverse().find((h) => h.type === "ANSWERED")?.actorId ?? null;
  return {
    id: c.id,
    code: c.folio,
    createdAt: Date.parse(c.filedAt),
    dueAt: endOfLocalDay(c.responseDueOn),
    kind: c.kind === "GRIEVANCE" ? "queja" : "reclamo",
    status: CLAIM_STATUS[c.status] ?? "received",
    name: c.consumerName,
    docType: DOC[docType] ?? "DNI",
    docNumber: docRest.join(" "),
    address: c.address,
    phone: c.phone,
    email: c.email,
    minor: c.minor,
    representative: c.guardianName ? { name: c.guardianName, doc: c.guardianDocument ?? "" } : null,
    goodType: c.goodType === "PRODUCT" ? "PRODUCTO" : c.goodType === "SERVICE" ? "SERVICIO" : null,
    product: c.goodDescription,
    amount: c.claimedAmount ? Number(c.claimedAmount.amount) : null,
    currency: c.claimedAmount?.currency === "USD" ? "USD" : "PEN",
    place: c.serviceLocation,
    eventDate: startOfLocalDay(c.incidentDate),
    orderRef: c.relatedReference,
    facts: c.facts,
    request: c.consumerRequest,
    responseChannel: c.responseChannel === "POSTAL_ADDRESS" ? "Carta al domicilio" : "Correo electrónico",
    answer: c.responseText ? { text: c.responseText, at: ms(c.respondedAt) ?? Date.now(), actor: (await staffName(answeredBy)) ?? "" } : null,
    assignee,
    history: await Promise.all(
      c.history.map(async (h) => ({ at: Date.parse(h.occurredAt), label: CLAIM_EVENT[h.type] ?? h.type.toLowerCase(), actor: await staffName(h.actorId), note: h.type === "ASSIGNED" ? (assignee ?? undefined) : (h.note ?? undefined) })),
    ),
  };
}

/** La API no lleva historial de estas solicitudes: se arma con la recepción y la resolución. Plazo: 10 días hábiles. */
async function privacyFrom(r: PrivacyView): Promise<PrivacyRequest> {
  const createdAt = Date.parse(r.receivedAt);
  const resolver = await staffName(r.resolvedBy);
  const history: CaseEvent[] = [{ at: createdAt, label: "received", actor: null }];
  if (r.status === "IN_PROGRESS") history.push({ at: createdAt, label: "processing", actor: null });
  if (r.resolvedAt) history.push({ at: Date.parse(r.resolvedAt), label: "done", actor: resolver, note: r.resolutionNote ?? undefined });
  return {
    id: r.id,
    code: r.folio,
    createdAt,
    dueAt: addBusinessDays(createdAt, 10),
    status: PRIVACY_STATUS[r.status] ?? "received",
    name: r.fullName,
    email: r.email,
    channel: "form",
    userId: null,
    reason: r.details,
    assignee: resolver,
    history,
  };
}

/** Todas las solicitudes de una cola (páginas de 100, hasta 1000). */
async function fetchAll<T>(module: CaseModule): Promise<T[]> {
  const items: T[] = [];
  for (let page = 0; page < 10; page++) {
    const res = await get<PageResult<T>>(`${PATHS[module]}?page=${page}&size=100`);
    items.push(...res.items);
    if (page + 1 >= res.totalPages) break;
  }
  return items;
}

async function detail<M extends CaseModule>(module: M, id: string): Promise<CaseMap[M] | null> {
  try {
    const data = await get<unknown>(`${PATHS[module]}/${id}`);
    if (module === "quotes") return (await quoteFrom(data as QuoteDetail)) as CaseMap[M];
    if (module === "inquiries") return (await inquiryFrom(data as InquiryDetail)) as CaseMap[M];
    if (module === "claims") return (await claimFrom(data as ClaimDetail)) as CaseMap[M];
    return (await privacyFrom(data as PrivacyView)) as CaseMap[M];
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

type Light = { id: string; code: string; name: string; status: string; createdAt: number; dueAt?: number; text: string };

/** Resumen de una fila para filtrar, contar y ordenar sin pedir cada ficha. */
async function lights(module: CaseModule): Promise<Light[]> {
  if (module === "quotes") {
    const rows = await fetchAll<QuoteSummary>("quotes");
    // Una cotización cerrada puede ser ganada o perdida: solo la ficha lo dice.
    return Promise.all(
      rows.map(async (q) => {
        const status = q.status === "CLOSED" ? ((await detail("quotes", q.id))?.status ?? "won") : quoteStatus(q.status);
        return { id: q.id, code: q.folio, name: q.companyName, status, createdAt: Date.parse(q.submittedAt), text: `${q.folio} ${q.companyName} ${q.contactName} ${q.email}` };
      }),
    );
  }
  if (module === "inquiries") {
    const rows = await fetchAll<InquirySummary>("inquiries");
    return rows.map((i) => ({ id: i.id, code: i.folio, name: i.fullName, status: INQUIRY_STATUS[i.status] ?? "new", createdAt: Date.parse(i.receivedAt), text: `${i.folio} ${i.fullName} ${i.companyName} ${i.email}` }));
  }
  if (module === "claims") {
    const rows = await fetchAll<ClaimSummary>("claims");
    return rows.map((c) => ({ id: c.id, code: c.folio, name: c.consumerName, status: CLAIM_STATUS[c.status] ?? "received", createdAt: Date.parse(c.filedAt), dueAt: endOfLocalDay(c.responseDueOn), text: `${c.folio} ${c.consumerName}` }));
  }
  const rows = await fetchAll<PrivacyView>("privacy");
  return rows.map((r) => {
    const createdAt = Date.parse(r.receivedAt);
    return { id: r.id, code: r.folio, name: r.fullName, status: PRIVACY_STATUS[r.status] ?? "received", createdAt, dueAt: addBusinessDays(createdAt, 10), text: `${r.folio} ${r.fullName} ${r.email}` };
  });
}

const CLOSED: Record<CaseModule, string[]> = { quotes: ["won", "lost"], inquiries: ["closed"], claims: ["answered"], privacy: ["done"] };
const WAITING: Record<CaseModule, string[]> = { quotes: ["new"], inquiries: ["new"], claims: ["received", "in_progress"], privacy: ["received", "identity", "processing"] };

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// ───────── Casos: cambios ─────────

const QUOTE_TARGET: Record<QuoteStatus, string[]> = {
  new: [],
  reviewing: ["IN_REVIEW"],
  sent: ["IN_REVIEW", "RESPONDED"],
  won: ["IN_REVIEW", "RESPONDED", "CLOSED"],
  lost: [],
};
const QUOTE_ORDER = ["RECEIVED", "ASSIGNED", "IN_REVIEW", "RESPONDED", "CLOSED"];

async function moveQuote(id: string, target: QuoteStatus) {
  let current = await call<QuoteDetail>(`quotes/${id}`);
  const step = async (status: string, note?: string) => {
    current = await call<QuoteDetail>(`quotes/${id}/status`, { method: "POST", body: { status, ...(note ? { note } : {}) }, ifMatch: current.etag });
  };
  if (target === "lost") {
    // Antes de responder se cancela; ya respondida, se cierra con la marca de perdida.
    if (current.data.status === "RESPONDED") await step("CLOSED", LOST_NOTE);
    else await step("CANCELLED", "Marcada como perdida desde el panel");
    return;
  }
  for (const status of QUOTE_TARGET[target]) {
    if (QUOTE_ORDER.indexOf(current.data.status) >= QUOTE_ORDER.indexOf(status)) continue;
    await step(status, status === "CLOSED" ? WON_NOTE : undefined);
  }
}

async function assign(module: "quotes" | "inquiries" | "claims", id: string, name: string) {
  const { etag } = await call(`${PATHS[module]}/${id}`);
  await call(`${PATHS[module]}/${id}/assign`, { method: "POST", body: { assigneeId: await staffId(name) }, ifMatch: etag });
}

/** Nota de la resolución que la API envía por correo al titular (mínimo 10 caracteres). */
const PRIVACY_DONE_NOTE = "Atendimos tu solicitud de datos personales conforme a la Ley N.° 29733. Si tienes alguna duda, responde a este correo indicando tu folio.";

export const httpAdapter: UsersApi = {
  capabilities: { createCustomers: false, editEmail: false, resetDemo: false, statusInForm: false, caseNotes: ["claims"], caseAssign: ["quotes", "inquiries", "claims"] },

  listStaff: staffList,

  async listUsers(p) {
    const page = await get<{ items: Row[]; page: number; size: number; totalItems: number; totalPages: number; statusCounts: Record<string, number> }>(`accounts${listQuery(p)}`);
    const c = page.statusCounts;
    return {
      items: page.items.map(user),
      page: page.page,
      size: page.size,
      totalItems: page.totalItems,
      totalPages: Math.max(1, page.totalPages),
      statusCounts: { all: c.all ?? 0, active: c.ACTIVE ?? 0, pending: c.PENDING_VERIFICATION ?? 0, disabled: c.DISABLED ?? 0 },
    };
  },

  async getUser(id) {
    try {
      return user(await get<Row>(`accounts/${id}`));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null;
      throw e;
    }
  },

  async stats(range) {
    type Stats = Omit<DashboardStats, "series" | "byMethod" | "byStatus" | "latest" | "pendingOldest" | "generatedAt" | "byCity"> & {
      series: { day: string; count: number }[];
      byMethod: Record<string, number>;
      byStatus: Record<string, number>;
      latest: Row[];
      pendingOldest: Row[];
      generatedAt: string;
    };
    const s = await get<Stats>(`accounts/stats${qs({ range })}`);
    return {
      ...s,
      series: s.series.map((d) => ({ day: startOfLocalDay(d.day), count: d.count })),
      byMethod: { email: s.byMethod.EMAIL ?? 0, google: s.byMethod.GOOGLE ?? 0, facebook: s.byMethod.FACEBOOK ?? 0 },
      byStatus: { active: s.byStatus.ACTIVE ?? 0, pending: s.byStatus.PENDING_VERIFICATION ?? 0, disabled: s.byStatus.DISABLED ?? 0 },
      byCity: [],
      latest: s.latest.map(user),
      pendingOldest: s.pendingOldest.map(user),
      generatedAt: Date.parse(s.generatedAt),
    };
  },

  async listActivity(p) {
    type Item = { id: string; at: string; type: string; userId: string; userName: string; actorName: string | null; detail: string | null };
    const page = await get<PageResult<Item>>(`accounts/activity${qs({ q: p.q?.trim(), type: p.type && p.type !== "all" ? p.type.toUpperCase() : undefined, userId: p.userId, page: p.page, size: p.size })}`);
    return {
      ...page,
      totalPages: Math.max(1, page.totalPages),
      items: page.items.map((a): Activity => ({ id: a.id, at: Date.parse(a.at), type: a.type.toLowerCase() as ActivityType, userId: a.userId, userName: a.userName, actor: a.actorName, detail: a.detail?.toLowerCase() ?? undefined })),
    };
  },

  async createUser(draft) {
    // Los clientes se registran en el sitio (y aceptan el aviso de privacidad); desde el panel solo se invita personal.
    if (draft.kind !== "staff") throw new Error("customers_self_register");
    let created: Res<Row>;
    try {
      created = await call<Row>("users", { method: "POST", body: { email: draft.email.trim(), fullName: draft.name.trim(), roles: draft.roles.map((r) => r.toUpperCase()) } });
    } catch (e) {
      if (e instanceof ApiError && e.code === "EMAIL_IN_USE") throw new Error("email_taken");
      throw e;
    }
    staffCache = null;
    if (draft.notes?.trim()) await call(`accounts/${created.data.id}/notes`, { method: "PUT", body: { notes: draft.notes } });
    return user(await get<Row>(`accounts/${created.data.id}`));
  },

  async updateUser(id, patch) {
    const current = user(await get<Row>(`accounts/${id}`));
    const profileChanged = (["name", "company", "ruc", "phone"] as const).some((k) => patch[k] !== undefined && (patch[k] || null) !== (current[k] || null));
    if (profileChanged) {
      await call(`accounts/${id}`, {
        method: "PATCH",
        body: { fullName: (patch.name ?? current.name).trim(), companyName: (patch.company ?? current.company) || null, ruc: (patch.ruc ?? current.ruc) || null, phone: (patch.phone ?? current.phone) || null },
        ifMatch: await etagOf(id),
      });
    }
    if (current.kind === "staff" && patch.roles && patch.roles.join() !== current.roles.join()) {
      await call(`users/${id}/roles`, { method: "PUT", body: { roles: patch.roles.map((r) => r.toUpperCase()) }, ifMatch: await etagOf(id) });
      staffCache = null;
    }
    if (patch.status && patch.status !== current.status && patch.status !== "pending") {
      await call(`accounts/${id}/${patch.status === "disabled" ? "disable" : "enable"}`, { method: "POST", body: {}, ifMatch: await etagOf(id) });
    }
    if (patch.notes !== undefined && patch.notes !== current.notes) await call(`accounts/${id}/notes`, { method: "PUT", body: { notes: patch.notes } });
    return user(await get<Row>(`accounts/${id}`));
  },

  async setStatus(ids, status) {
    for (const id of ids) {
      const { data, etag } = await call<Row>(`accounts/${id}`);
      if (STATUS_IN[data.status] === status) continue;
      await call(`accounts/${id}/${status === "disabled" ? "disable" : "enable"}`, { method: "POST", body: {}, ifMatch: etag });
    }
  },

  async deleteUsers(ids) {
    for (const id of ids) await call(`accounts/${id}`, { method: "DELETE", ifMatch: await etagOf(id) });
    staffCache = null;
  },

  async resendVerification(id) {
    await call(`accounts/${id}/verification-email`, { method: "POST", body: {} });
  },

  async sendPasswordReset(id) {
    await call(`accounts/${id}/password-reset`, { method: "POST", body: {} });
  },

  async exportCsv(p) {
    const header = ["id", "nombre", "correo", "empresa", "ruc", "celular", "metodo", "estado", "roles", "correo_verificado", "boletin", "origen", "ciudad", "registrado", "ultima_actividad", "cotizaciones"];
    const iso = (t: number | null) => (t ? new Date(t).toISOString() : "");
    const rows: User[] = [];
    for (let page = 0; page < 100; page++) {
      const res = await this.listUsers({ ...p, page, size: 100 });
      rows.push(...res.items);
      if (page + 1 >= res.totalPages) break;
    }
    const lines = rows.map((u) =>
      [u.id, u.name, u.email, u.company, u.ruc, u.phone, u.method, u.status, u.roles.join("|"), u.emailVerified, u.newsletter, u.source, u.city, iso(u.registeredAt), iso(u.lastActiveAt), u.quotes].map(csvCell).join(","),
    );
    // BOM para que Excel abra las tildes correctamente.
    return `﻿${[header.join(","), ...lines].join("\r\n")}`;
  },

  async reset() {
    // Con datos reales no hay "demostración" que restablecer.
  },

  async listCases(module, p) {
    const all = await lights(module);
    const q = p.q ? normalize(p.q.trim()) : "";
    const base = q ? all.filter((c) => q.split(/\s+/).every((part) => normalize(c.text).includes(part))) : all;
    const statusCounts: Record<string, number> = { all: base.length };
    base.forEach((c) => (statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1));
    const rows = base
      .filter((c) => !p.status || p.status === "all" || c.status === p.status)
      .sort((a, b) => {
        if (p.sort === "oldest") return a.createdAt - b.createdAt;
        if (p.sort === "due") {
          const closedA = CLOSED[module].includes(a.status) ? 1 : 0;
          const closedB = CLOSED[module].includes(b.status) ? 1 : 0;
          return closedA - closedB || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || b.createdAt - a.createdAt;
        }
        return b.createdAt - a.createdAt;
      });
    const totalPages = Math.max(1, Math.ceil(rows.length / p.size));
    const page = Math.min(p.page, totalPages - 1);
    const items = (await Promise.all(rows.slice(page * p.size, page * p.size + p.size).map((c) => detail(module, c.id)))).filter((x) => x !== null) as CaseMap[typeof module][];
    const result: CaseListResult<CaseMap[typeof module]> = { items, page, size: p.size, totalItems: rows.length, totalPages, statusCounts };
    return result;
  },

  getCase: detail,

  async updateCase(module, id, patch, event) {
    // Campos que el panel cambia en cualquier cola (el resto del caso no se edita desde aquí).
    const changes = patch as { assignee?: string | null; status?: string; reply?: string | null; answer?: { text: string } | null };
    const current = await detail(module, id);
    if (!current) throw new ApiError(404, "NOT_FOUND");
    const { assignee: currentAssignee, status: currentStatus } = current as unknown as { assignee: string | null; status: string };

    if (event.label === "note") {
      if (module !== "claims") throw new ApiError(400, "NOTES_UNSUPPORTED");
      const { etag } = await call(`complaints/${id}`);
      await call(`complaints/${id}/notes`, { method: "POST", body: { note: event.note ?? "" }, ifMatch: etag });
      return (await detail(module, id))!;
    }
    // Tomar el caso (o asignarlo): solo si cambia de responsable.
    if (changes.assignee && changes.assignee !== currentAssignee && module !== "privacy") await assign(module, id, changes.assignee);

    if (module === "quotes" && changes.status && changes.status !== currentStatus) await moveQuote(id, changes.status as QuoteStatus);
    if (module === "inquiries" && changes.status && changes.status !== currentStatus) {
      const { etag } = await call(`inquiries/${id}`);
      const status = changes.status === "answered" ? "ANSWERED" : changes.status === "closed" ? "CLOSED" : "IN_PROGRESS";
      await call(`inquiries/${id}/status`, { method: "POST", body: { status, ...(changes.reply ? { note: changes.reply } : {}) }, ifMatch: etag });
    }
    if (module === "claims" && changes.answer) {
      const { etag } = await call(`complaints/${id}`);
      await call(`complaints/${id}/answer`, { method: "POST", body: { response: changes.answer.text }, ifMatch: etag });
    }
    if (module === "privacy" && changes.status && changes.status !== currentStatus) {
      let { data, etag } = await call<PrivacyView>(`privacy/requests/${id}`);
      if (data.status === "RECEIVED") ({ data, etag } = await call<PrivacyView>(`privacy/requests/${id}/start`, { method: "POST", body: {}, ifMatch: etag }));
      if (changes.status === "done" && data.status === "IN_PROGRESS") {
        await call(`privacy/requests/${id}/conclude`, { method: "POST", body: { accepted: true, resolutionNote: PRIVACY_DONE_NOTE }, ifMatch: etag });
      }
    }
    return (await detail(module, id))!;
  },

  async queueCounts() {
    const [quotes, inquiries, claims, privacy] = await Promise.all((["quotes", "inquiries", "claims", "privacy"] as const).map((m) => lights(m)));
    const count = (m: CaseModule, rows: Light[]) => rows.filter((c) => WAITING[m].includes(c.status)).length;
    const now = Date.now();
    const open = (m: "claims" | "privacy", rows: Light[]) =>
      rows.filter((c) => !CLOSED[m].includes(c.status) && c.dueAt !== undefined && businessDaysLeft(c.dueAt, now) <= 5).map((c) => ({ module: m, id: c.id, code: c.code, name: c.name, dueAt: c.dueAt! }));
    const due: QueueCounts["due"] = [...open("claims", claims), ...open("privacy", privacy)].sort((a, b) => a.dueAt - b.dueAt);
    return { quotes: count("quotes", quotes), inquiries: count("inquiries", inquiries), claims: count("claims", claims), privacy: count("privacy", privacy), due };
  },
};

import "server-only";
import { randomUUID } from "node:crypto";
import { audit, permissionsOf, requireStaff, STAFF_ROLES } from "../auth";
import { randomToken, sha256Hex } from "../crypto";
import { db, type Tx } from "../db";
import { badRequest, conflict, json, notFound, Problem, readJson } from "../http";
import { enqueueMail } from "../mail";
import { etag, FIRMA, ifMatch, stale } from "../shared";
import { Check, pageResult, paging } from "../validate";
import type { Route } from "../router";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const ALL_ROLES = ["CUSTOMER", ...STAFF_ROLES];
const SITE_URL = () => process.env.SITE_URL?.trim() || "https://fundigsac-web.vercel.app";
const ADMIN_URL = () => process.env.ADMIN_URL?.trim() || "https://fundigsac-admin.vercel.app";

function uid(id: string) {
  if (!UUID.test(id)) throw notFound("USER_NOT_FOUND");
  return id.toLowerCase();
}

// ------------------------------------------------------------------ vistas

/** Fila del directorio (AccountRow): datos de la cuenta + uso del sitio. Nunca lista cuentas eliminadas. */
const ROW_SELECT = (sql: Tx) => sql`
  select u.id, u.kind, u.full_name, u.email, u.company_name, u.ruc, u.phone, u.signup_method, u.status, u.email_verified_at,
         u.newsletter_opt_in_at, u.privacy_notice_version, u.signup_source, u.created_at, u.last_login_at, u.version,
         coalesce((select array_agg(r.role order by r.role) from app.user_roles r where r.user_id = u.id), '{}') roles,
         (select count(*)::int from app.quote_requests q where q.customer_id = u.id) quotes,
         (select count(*)::int from app.quote_cart_items c where c.owner_id = u.id) cart_items,
         (select count(*)::int from app.refresh_tokens t where t.user_id = u.id and t.revoked_at is null and t.expires_at > now()) active_sessions,
         (select count(*)::int from app.audit_events a where a.resource_type = 'USER' and a.resource_id = u.id::text and a.action = 'SIGNED_IN') sign_ins,
         (select n.notes from app.account_notes n where n.user_id = u.id) notes
    from app.user_accounts u`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const accountRow = (r: any) => ({
  id: r.id, kind: r.kind, fullName: r.full_name, email: r.email, companyName: r.company_name, ruc: r.ruc, phone: r.phone, signupMethod: r.signup_method,
  status: r.status, roles: r.roles, emailVerified: !!r.email_verified_at, newsletter: !!r.newsletter_opt_in_at, privacyNoticeVersion: r.privacy_notice_version,
  signupSource: r.signup_source, createdAt: iso(r.created_at), lastLoginAt: iso(r.last_login_at), quotes: r.quotes, cartItems: r.cart_items,
  activeSessions: r.active_sessions, signIns: r.sign_ins, notes: r.notes ?? null, version: Number(r.version),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const accountView = (r: any) => ({
  id: r.id, kind: r.kind, email: r.email, fullName: r.full_name, companyName: r.company_name, ruc: r.ruc, phone: r.phone, status: r.status,
  roles: r.roles, permissions: permissionsOf(r.roles), emailVerified: !!r.email_verified_at, lastLoginAt: iso(r.last_login_at), createdAt: iso(r.created_at), version: Number(r.version),
});

async function loadRow(sql: Tx, id: string) {
  const [r] = await sql`${ROW_SELECT(sql)} where u.id = ${id} and u.status <> 'DELETED'`;
  if (!r) throw notFound("USER_NOT_FOUND");
  return r;
}

// ------------------------------------------------------------------ directorio

const STATUS_ORDER = "case u.status when 'ACTIVE' then 0 when 'PENDING_VERIFICATION' then 1 else 2 end";

function filters(sql: Tx, url: URL, withStatus: boolean) {
  const get = (k: string) => {
    const v = url.searchParams.get(k)?.trim();
    return !v || v === "all" ? null : v;
  };
  const errs: { field: string; code: string }[] = [];
  const pick = (k: string, values: string[]) => {
    const v = get(k);
    if (v && !values.includes(v)) errs.push({ field: k, code: "INVALID_FILTER" });
    return v && values.includes(v) ? v : null;
  };
  const status = pick("status", ["ACTIVE", "PENDING_VERIFICATION", "DISABLED"]);
  const kind = pick("kind", ["CUSTOMER", "STAFF"]);
  const method = pick("method", ["EMAIL", "GOOGLE", "FACEBOOK"]);
  const role = pick("role", ALL_ROLES);
  const range = pick("range", ["7d", "30d", "90d", "all"]);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length > 100) errs.push({ field: "q", code: "INVALID_LENGTH" });
  if (errs.length) throw badRequest(errs);
  const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
  const days = range && range !== "all" ? Number(range.replace("d", "")) : null;
  return sql`where u.status <> 'DELETED'
    ${withStatus && status ? sql`and u.status = ${status}` : sql``}
    ${kind ? sql`and u.kind = ${kind}` : sql``}
    ${method ? sql`and u.signup_method = ${method}` : sql``}
    ${role ? sql`and exists (select 1 from app.user_roles r where r.user_id = u.id and r.role = ${role})` : sql``}
    ${days ? sql`and u.created_at >= now() - make_interval(days => ${days})` : sql``}
    ${words.reduce((acc, w) => sql`${acc} and app.unaccent_text(concat_ws(' ', u.full_name, u.email, u.company_name, u.ruc, u.phone)) like ${"%" + w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\\%_]/g, (m) => "\\" + m) + "%"}`, sql``)}`;
}

const listAccounts: Route = async (request) => {
  await requireStaff(request, "users:manage");
  const url = new URL(request.url);
  const { page, size } = paging(url);
  const sql = db() as unknown as Tx;
  const where = filters(sql, url, true);
  const sortKey = url.searchParams.get("sort") ?? "registeredAt";
  const desc = url.searchParams.get("desc") !== "false";
  const dir = desc ? sql`desc` : sql`asc`;
  const order =
    sortKey === "name" ? sql`lower(u.full_name) ${dir}` :
    sortKey === "lastActiveAt" ? sql`u.last_login_at ${dir} nulls last` :
    sortKey === "quotes" ? sql`quotes ${dir}` :
    sortKey === "status" ? sql`${sql.unsafe(STATUS_ORDER)} ${dir}` :
    sql`u.created_at ${dir}`;
  if (!["name", "registeredAt", "lastActiveAt", "quotes", "status"].includes(sortKey)) throw badRequest([{ field: "sort", code: "INVALID_FILTER" }]);
  const [{ n }] = await sql`select count(*)::int n from app.user_accounts u ${where}`;
  const rows = await sql`select * from (${ROW_SELECT(sql)} ${where}) u order by ${order}, u.id limit ${size} offset ${page * size}`;
  const counts = await sql`select u.status, count(*)::int n from app.user_accounts u ${filters(sql, url, false)} group by u.status`;
  const statusCounts: Record<string, number> = { all: 0, ACTIVE: 0, PENDING_VERIFICATION: 0, DISABLED: 0 };
  for (const c of counts) {
    statusCounts[c.status] = c.n;
    statusCounts.all += c.n;
  }
  return json({ ...pageResult(rows.map(accountRow), page, size, n), statusCounts });
};

const getAccount: Route = async (request, { id }) => {
  await requireStaff(request, "users:manage");
  const r = accountRow(await loadRow(db() as unknown as Tx, uid(id)));
  return json(r, 200, etag(r.version));
};

const putNotes: Route = async (request, { id }) => {
  const me = await requireStaff(request, "users:manage");
  const userId = uid(id);
  const body = await readJson(request, 8192);
  new Check(body).allow(["notes"]).done();
  if (typeof body.notes !== "string") throw badRequest([{ field: "notes", code: "REQUIRED" }]);
  if (body.notes.includes("\u0000")) throw badRequest([{ field: "notes", code: "INVALID_CHARACTER" }]);
  const notes = body.notes.trim();
  if (notes.length > 2000) throw badRequest([{ field: "notes", code: "TOO_LONG" }]);
  const r = await db().begin(async (tx) => {
    await loadRow(tx, userId);
    if (!notes) await tx`delete from app.account_notes where user_id = ${userId}`;
    else await tx`insert into app.account_notes (user_id, notes, updated_at, updated_by) values (${userId}, ${notes}, now(), ${me.id})
                  on conflict (user_id) do update set notes = excluded.notes, updated_at = now(), updated_by = excluded.updated_by`;
    return accountRow(await loadRow(tx, userId));
  });
  return json(r, 200, etag(r.version));
};

/** Cambia una cuenta con bloqueo y versión. `change` recibe la fila actual. */
async function withAccount<T>(userId: string, expected: number, change: (tx: Tx, row: Record<string, unknown>) => Promise<T>): Promise<T> {
  return (await db().begin(async (tx) => {
    const [row] = await tx`select u.*, coalesce((select array_agg(r.role order by r.role) from app.user_roles r where r.user_id = u.id), '{}') roles from app.user_accounts u where u.id = ${userId} for update`;
    if (!row || row.status === "DELETED") throw notFound("USER_NOT_FOUND");
    if (Number(row.version) !== expected) throw stale();
    return change(tx, row);
  })) as T;
}

async function activeAdmins(tx: Tx): Promise<number> {
  const [{ n }] = await tx`select count(*)::int n from app.user_accounts u join app.user_roles r on r.user_id = u.id where r.role = 'ADMINISTRATOR' and u.status = 'ACTIVE'`;
  return n;
}

async function viewOf(tx: Tx, userId: string) {
  const [r] = await tx`select u.*, coalesce((select array_agg(r.role order by r.role) from app.user_roles r where r.user_id = u.id), '{}') roles from app.user_accounts u where u.id = ${userId}`;
  return accountView(r);
}

const patchAccount: Route = async (request, { id }) => {
  const me = await requireStaff(request, "users:manage");
  const userId = uid(id);
  const expected = ifMatch(request);
  const body = await readJson(request, 8192);
  const c = new Check(body).allow(["fullName", "companyName", "ruc", "phone"]);
  const fullName = c.str("fullName", { required: true, min: 2, max: 120 });
  const companyName = c.str("companyName", { max: 160 });
  const ruc = c.ruc("ruc", false);
  const phone = c.phone("phone", false);
  c.done();
  const v = await withAccount(userId, expected, async (tx) => {
    await tx`update app.user_accounts set full_name = ${fullName}, company_name = ${companyName}, ruc = ${ruc}, phone = ${phone}, updated_at = now(), version = version + 1 where id = ${userId}`;
    await audit(tx, me.id, "USER_UPDATED", "USER", userId, {});
    return viewOf(tx, userId);
  });
  return json(v, 200, etag(v.version));
};

const setStatus = (target: "DISABLED" | "ENABLED"): Route => async (request, { id }) => {
  const me = await requireStaff(request, "users:manage");
  const userId = uid(id);
  const expected = ifMatch(request);
  const v = await withAccount(userId, expected, async (tx, row) => {
    const roles = row.roles as string[];
    if (target === "DISABLED") {
      if (userId === me.id) throw new Problem(422, "CANNOT_DISABLE_SELF");
      if (row.status === "DISABLED") throw conflict("ALREADY_DISABLED");
      if (roles.includes("ADMINISTRATOR") && row.status === "ACTIVE" && (await activeAdmins(tx)) <= 1) throw new Problem(422, "LAST_ADMINISTRATOR");
      await tx`update app.user_accounts set status = 'DISABLED', security_stamp = security_stamp + 1, updated_at = now(), version = version + 1 where id = ${userId}`;
      await tx`update app.refresh_tokens set revoked_at = now() where user_id = ${userId} and revoked_at is null`;
      await audit(tx, me.id, "USER_STATUS_CHANGED", "USER", userId, { status: "DISABLED" });
    } else {
      if (row.status !== "DISABLED") throw conflict("NOT_DISABLED");
      const next = row.password_hash || (row.kind === "STAFF" && row.email_verified_at) || row.signup_method !== "EMAIL" ? "ACTIVE" : "PENDING_VERIFICATION";
      await tx`update app.user_accounts set status = ${next}, failed_login_attempts = 0, locked_until = null, updated_at = now(), version = version + 1 where id = ${userId}`;
      await audit(tx, me.id, "USER_STATUS_CHANGED", "USER", userId, { status: next });
    }
    return viewOf(tx, userId);
  });
  return json(v, 200, etag(v.version));
};

const deleteAccount: Route = async (request, { id }) => {
  const me = await requireStaff(request, "users:manage");
  const userId = uid(id);
  const expected = ifMatch(request);
  await withAccount(userId, expected, async (tx, row) => {
    if (userId === me.id) throw new Problem(422, "CANNOT_DELETE_SELF");
    if ((row.roles as string[]).includes("ADMINISTRATOR") && row.status === "ACTIVE" && (await activeAdmins(tx)) <= 1) throw new Problem(422, "LAST_ADMINISTRATOR");
    // Anonimiza: las cotizaciones y reclamos conservan su propia copia de los datos.
    await tx`update app.user_accounts set email = ${`eliminada-${userId.replace(/-/g, "")}@cuentas-eliminadas.invalid`}, full_name = 'Cuenta eliminada',
               company_name = null, ruc = null, phone = null, password_hash = null, newsletter_opt_in_at = null, google_subject = null,
               status = 'DELETED', deleted_at = now(), security_stamp = security_stamp + 1, updated_at = now(), version = version + 1 where id = ${userId}`;
    await tx`update app.refresh_tokens set revoked_at = now() where user_id = ${userId} and revoked_at is null`;
    await tx`delete from app.account_notes where user_id = ${userId}`;
    await audit(tx, me.id, "ACCOUNT_DELETED", "USER", userId, {});
  });
  return json(null, 204);
};

/** Token de un solo uso (verificación o recuperación). Emitir invalida los pendientes del mismo propósito. */
export async function issueOneTimeToken(tx: Tx, userId: string, purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "STAFF_INVITATION", ttlSeconds: number): Promise<string> {
  await tx`update app.one_time_tokens set used_at = now() where user_id = ${userId} and purpose = ${purpose} and used_at is null`;
  const token = randomToken(32);
  await tx`insert into app.one_time_tokens (id, user_id, purpose, token_hash, created_at, expires_at) values (${randomUUID()}, ${userId}, ${purpose}, ${sha256Hex(token)}, now(), now() + make_interval(secs => ${ttlSeconds}))`;
  return token;
}

export async function mailVerify(tx: Tx, user: { id: string; email: string; full_name: string }) {
  const token = await issueOneTimeToken(tx, user.id, "EMAIL_VERIFICATION", 24 * 3600);
  await enqueueMail(tx, {
    dedupeKey: `VERIFY_EMAIL:${user.id}:${Date.now()}:${user.email}`, template: "VERIFY_EMAIL", to: user.email, reference: user.id,
    subject: "FUNDIGSAC: confirme su correo",
    text: `Hola, ${user.full_name}:\n\nPara activar su cuenta en FUNDIGSAC, abra este enlace (vence en 24 horas):\n${SITE_URL()}/verificar-correo#token=${token}${FIRMA}`,
  });
}

export async function mailReset(tx: Tx, user: { id: string; email: string; full_name: string }) {
  const token = await issueOneTimeToken(tx, user.id, "PASSWORD_RESET", 30 * 60);
  await enqueueMail(tx, {
    dedupeKey: `PASSWORD_RESET:${user.id}:${Date.now()}:${user.email}`, template: "PASSWORD_RESET", to: user.email, reference: user.id,
    subject: "FUNDIGSAC: restablezca su contraseña",
    text: `Hola, ${user.full_name}:\n\nPara elegir una contraseña nueva, abra este enlace (vence en 30 minutos):\n${SITE_URL()}/restablecer#token=${token}\n\nSi no lo pidió, ignore este correo.${FIRMA}`,
  });
}

const sendVerification: Route = async (request, { id }) => {
  await requireStaff(request, "users:manage");
  const userId = uid(id);
  await db().begin(async (tx) => {
    const [u] = await tx`select id, email, full_name, kind, status from app.user_accounts where id = ${userId} and status <> 'DELETED'`;
    if (!u) throw notFound("USER_NOT_FOUND");
    if (u.kind !== "CUSTOMER" || u.status !== "PENDING_VERIFICATION") throw new Problem(422, "NOT_PENDING");
    await mailVerify(tx, u as never);
  });
  return json({ message: "Enviamos el correo a la cuenta." }, 202);
};

const sendReset: Route = async (request, { id }) => {
  await requireStaff(request, "users:manage");
  const userId = uid(id);
  await db().begin(async (tx) => {
    const [u] = await tx`select id, email, full_name, kind, status from app.user_accounts where id = ${userId} and status <> 'DELETED'`;
    if (!u) throw notFound("USER_NOT_FOUND");
    if (u.kind === "STAFF") throw new Problem(422, "STAFF_PASSWORDLESS");
    if (u.status === "DISABLED") throw new Problem(422, "ACCOUNT_DISABLED");
    await mailReset(tx, u as never);
  });
  return json({ message: "Enviamos el correo a la cuenta." }, 202);
};

// ------------------------------------------------------------------ actividad

const ACT_TYPES = ["SIGNUP", "LOGIN", "VERIFY", "QUOTE", "PASSWORD", "DISABLE", "ENABLE", "ROLES", "UPDATE", "DELETE", "INVITE"];

const activity: Route = async (request) => {
  await requireStaff(request, "users:manage");
  const url = new URL(request.url);
  const { page, size } = paging(url);
  const type = url.searchParams.get("type")?.trim() || null;
  if (type && !ACT_TYPES.includes(type)) throw badRequest([{ field: "type", code: "INVALID_FILTER" }]);
  const userId = url.searchParams.get("userId");
  if (userId && !UUID.test(userId)) throw badRequest([{ field: "userId", code: "INVALID_VALUE" }]);
  const q = url.searchParams.get("q")?.trim() || null;
  if (q && q.length > 100) throw badRequest([{ field: "q", code: "INVALID_LENGTH" }]);
  const sql = db() as unknown as Tx;
  const base = sql`
    select 'aud_' || a.id id, a.occurred_at at,
           case a.action when 'SIGNED_IN' then 'LOGIN' when 'EMAIL_VERIFIED' then 'VERIFY' when 'PASSWORD_RESET' then 'PASSWORD' when 'PASSWORD_CHANGED' then 'PASSWORD'
                         when 'USER_ROLES_CHANGED' then 'ROLES' when 'STAFF_INVITED' then 'INVITE' when 'ACCOUNT_DELETED' then 'DELETE' when 'USER_UPDATED' then 'UPDATE'
                         when 'USER_STATUS_CHANGED' then case when a.details->>'status' = 'DISABLED' then 'DISABLE' else 'ENABLE' end end type,
           u.id user_id, u.full_name user_name, case when a.actor_id is not null and a.actor_id::text <> a.resource_id then act.full_name end actor_name,
           coalesce(a.details->>'method', a.details->>'roles') detail
      from app.audit_events a join app.user_accounts u on u.id::text = a.resource_id left join app.user_accounts act on act.id = a.actor_id
     where a.resource_type = 'USER' and a.action in ('SIGNED_IN','EMAIL_VERIFIED','PASSWORD_RESET','PASSWORD_CHANGED','USER_ROLES_CHANGED','STAFF_INVITED','ACCOUNT_DELETED','USER_UPDATED','USER_STATUS_CHANGED')
    union all
    select 'usr_' || u.id, u.created_at, 'SIGNUP', u.id, u.full_name, null, u.signup_method from app.user_accounts u where u.kind = 'CUSTOMER'
    union all
    select 'cot_' || q.id, q.submitted_at, 'QUOTE', u.id, u.full_name, null, q.folio from app.quote_requests q join app.user_accounts u on u.id = q.customer_id`;
  const where = sql`where true ${type ? sql`and type = ${type}` : sql``} ${userId ? sql`and user_id = ${userId}` : sql``}
    ${q ? sql`and (user_name ilike ${"%" + q + "%"} or actor_name ilike ${"%" + q + "%"} or detail ilike ${"%" + q + "%"})` : sql``}`;
  const [{ n }] = await sql`select count(*)::int n from (${base}) x ${where}`;
  const rows = await sql`select * from (${base}) x ${where} order by at desc, id limit ${size} offset ${page * size}`;
  return json(pageResult(rows.map((r) => ({ id: r.id, at: iso(r.at), type: r.type, userId: r.user_id, userName: r.user_name, actorName: r.actor_name, detail: r.detail })), page, size, n));
};

// ------------------------------------------------------------------ indicadores

const stats: Route = async (request) => {
  await requireStaff(request, "users:manage");
  const url = new URL(request.url);
  const range = url.searchParams.get("range")?.trim() || "all";
  if (!["7d", "30d", "90d", "all"].includes(range)) throw badRequest([{ field: "range", code: "INVALID_FILTER" }]);
  const n = range === "all" ? null : Number(range.replace("d", ""));
  const days = n ?? 120;
  const sql = db() as unknown as Tx;
  const C = sql`app.user_accounts u where u.kind = 'CUSTOMER' and u.status <> 'DELETED'`;
  // Inicio del periodo: medianoche de Lima de (hoy − (N − 1)).
  const [{ from, prev }] = n
    ? await sql`select ((now() at time zone 'America/Lima')::date - ${n - 1}::int)::timestamp at time zone 'America/Lima' as from,
                       ((now() at time zone 'America/Lima')::date - ${2 * n - 1}::int)::timestamp at time zone 'America/Lima' as prev`
    : [{ from: new Date(0), prev: new Date(0) }];
  const [t] = await sql`select count(*)::int total,
      count(*) filter (where u.created_at >= ${from})::int new_in,
      count(*) filter (where u.created_at >= ${prev} and u.created_at < ${from})::int new_prev,
      count(*) filter (where u.status = 'PENDING_VERIFICATION')::int pending,
      count(*) filter (where u.last_login_at >= now() - interval '7 days')::int active_week,
      count(*) filter (where u.status = 'DISABLED')::int disabled,
      count(*) filter (where u.email_verified_at is not null)::int verified,
      count(*) filter (where u.newsletter_opt_in_at is not null)::int newsletter,
      count(*) filter (where u.status = 'PENDING_VERIFICATION' and u.created_at < now() - interval '48 hours')::int pending48,
      count(*) filter (where u.status = 'ACTIVE')::int s_active,
      count(*) filter (where u.created_at >= ${from} and u.signup_method = 'EMAIL')::int m_email,
      count(*) filter (where u.created_at >= ${from} and u.signup_method = 'GOOGLE')::int m_google,
      count(*) filter (where u.created_at >= ${from} and u.signup_method = 'FACEBOOK')::int m_facebook,
      count(*) filter (where u.created_at >= ${from} and u.email_verified_at is not null)::int f_verified,
      count(*) filter (where u.created_at >= ${from} and exists (select 1 from app.quote_requests q where q.customer_id = u.id))::int f_quoted
    from ${C}`;
  const series = await sql`
    select d::date::text as day, coalesce(c.n, 0)::int as count
      from generate_series((now() at time zone 'America/Lima')::date - ${days - 1}::int, (now() at time zone 'America/Lima')::date, interval '1 day') d
      left join (select (u.created_at at time zone 'America/Lima')::date dd, count(*) n from ${C} group by 1) c on c.dd = d::date order by d`;
  const bySource = await sql`select coalesce(u.signup_source, 'registro') source, count(*)::int count from ${C} and u.created_at >= ${from} group by 1 order by 2 desc, 1`;
  const latest = await sql`select * from (${ROW_SELECT(sql)} where u.kind = 'CUSTOMER' and u.status <> 'DELETED') u order by u.created_at desc, u.id limit 6`;
  const pendingOldest = await sql`select * from (${ROW_SELECT(sql)} where u.kind = 'CUSTOMER' and u.status = 'PENDING_VERIFICATION') u order by u.created_at, u.id limit 4`;
  const rate = (x: number) => (t.total ? x / t.total : 0);
  return json({
    total: t.total, newInRange: t.new_in, newPrevRange: n ? t.new_prev : 0, pending: t.pending, activeWeek: t.active_week, disabled: t.disabled,
    verifiedRate: rate(t.verified), newsletterRate: rate(t.newsletter), series,
    byMethod: { EMAIL: t.m_email, GOOGLE: t.m_google, FACEBOOK: t.m_facebook },
    byStatus: { ACTIVE: t.s_active, PENDING_VERIFICATION: t.pending, DISABLED: t.disabled },
    bySource, latest: latest.map(accountRow), funnel: { registered: t.new_in, verified: t.f_verified, quoted: t.f_quoted },
    pendingOldest: pendingOldest.map(accountRow), pendingOver48h: t.pending48, generatedAt: new Date().toISOString(),
  });
};

// ------------------------------------------------------------------ personal

function parseRoles(c: Check, body: Record<string, unknown>): string[] | null {
  const raw = body.roles;
  if (!Array.isArray(raw) || raw.length === 0) return c.fail("roles", "REQUIRED") ?? null;
  if (raw.some((r) => typeof r !== "string" || !ALL_ROLES.includes(r))) return c.fail("roles", "INVALID_VALUE") ?? null;
  if (raw.includes("CUSTOMER")) return c.fail("roles", "INVALID_ROLE") ?? null;
  return [...new Set(raw as string[])].sort();
}

const listStaff: Route = async (request) => {
  await requireStaff(request, "users:manage");
  const url = new URL(request.url);
  const { page, size } = paging(url);
  const q = url.searchParams.get("q")?.trim() || null;
  const sql = db() as unknown as Tx;
  const where = sql`where u.kind = 'STAFF' and u.status <> 'DELETED' ${q ? sql`and (u.email ilike ${"%" + q + "%"} or u.full_name ilike ${"%" + q + "%"})` : sql``}`;
  const [{ n }] = await sql`select count(*)::int n from app.user_accounts u ${where}`;
  const rows = await sql`select u.*, coalesce((select array_agg(r.role order by r.role) from app.user_roles r where r.user_id = u.id), '{}') roles
                         from app.user_accounts u ${where} order by u.full_name, u.id limit ${size} offset ${page * size}`;
  return json(pageResult(rows.map(accountView), page, size, n));
};

const inviteStaff: Route = async (request) => {
  const me = await requireStaff(request, "users:manage");
  const body = await readJson(request, 8192);
  const c = new Check(body).allow(["email", "fullName", "roles"]);
  const email = c.email("email");
  const fullName = c.str("fullName", { required: true, min: 2, max: 120 });
  const roles = parseRoles(c, body);
  c.done();
  const v = await db().begin(async (tx) => {
    const [exists] = await tx`select 1 from app.user_accounts where email = ${email}`;
    if (exists) throw conflict("EMAIL_IN_USE", "Ese correo ya tiene una cuenta.");
    const id = randomUUID();
    await tx`insert into app.user_accounts (id, kind, email, full_name, status, created_at, updated_at) values (${id}, 'STAFF', ${email}, ${fullName}, 'PENDING_VERIFICATION', now(), now())`;
    for (const r of roles!) await tx`insert into app.user_roles (user_id, role) values (${id}, ${r})`;
    await issueOneTimeToken(tx, id, "STAFF_INVITATION", 3 * 24 * 3600);
    await audit(tx, me.id, "STAFF_INVITED", "USER", id, { roles: roles!.join(",") });
    await enqueueMail(tx, {
      dedupeKey: `STAFF_INVITATION:${id}:${email}`, template: "STAFF_INVITATION", to: email!, reference: id,
      subject: "FUNDIGSAC: invitación al panel interno",
      text: `Hola, ${fullName}:\n\n${me.fullName} te dio acceso al panel interno de FUNDIGSAC. Para entrar, abre ${ADMIN_URL()}/login, escribe este correo y usa el código de 6 dígitos que te llegará. No necesitas contraseña.`,
    });
    return viewOf(tx, id);
  });
  return json(v, 201, { ...etag(v.version), Location: `/api/v1/staff/users/${v.id}` });
};

const putRoles: Route = async (request, { id }) => {
  const me = await requireStaff(request, "users:manage");
  const userId = uid(id);
  const expected = ifMatch(request);
  const body = await readJson(request, 4096);
  const c = new Check(body).allow(["roles"]);
  const roles = parseRoles(c, body);
  c.done();
  const v = await withAccount(userId, expected, async (tx, row) => {
    if (row.kind !== "STAFF") throw notFound("USER_NOT_FOUND");
    const wasAdmin = (row.roles as string[]).includes("ADMINISTRATOR");
    if (wasAdmin && !roles!.includes("ADMINISTRATOR")) {
      if (userId === me.id) throw new Problem(422, "CANNOT_DEMOTE_SELF");
      if (row.status === "ACTIVE" && (await activeAdmins(tx)) <= 1) throw new Problem(422, "LAST_ADMINISTRATOR");
    }
    await tx`delete from app.user_roles where user_id = ${userId}`;
    for (const r of roles!) await tx`insert into app.user_roles (user_id, role) values (${userId}, ${r})`;
    await tx`update app.user_accounts set security_stamp = security_stamp + 1, updated_at = now(), version = version + 1 where id = ${userId}`;
    await audit(tx, me.id, "USER_ROLES_CHANGED", "USER", userId, { roles: roles!.join(",") });
    return viewOf(tx, userId);
  });
  return json(v, 200, etag(v.version));
};

export const staffAccountRoutes: Record<string, Route> = {
  "GET /staff/accounts": listAccounts,
  "GET /staff/accounts/stats": stats,
  "GET /staff/accounts/activity": activity,
  "GET /staff/accounts/:id": getAccount,
  "PUT /staff/accounts/:id/notes": putNotes,
  "PATCH /staff/accounts/:id": patchAccount,
  "POST /staff/accounts/:id/disable": setStatus("DISABLED"),
  "POST /staff/accounts/:id/enable": setStatus("ENABLED"),
  "DELETE /staff/accounts/:id": deleteAccount,
  "POST /staff/accounts/:id/verification-email": sendVerification,
  "POST /staff/accounts/:id/password-reset": sendReset,
  "GET /staff/users": listStaff,
  "POST /staff/users": inviteStaff,
  "PUT /staff/users/:id/roles": putRoles,
};

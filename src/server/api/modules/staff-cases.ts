import "server-only";
import { randomUUID } from "node:crypto";
import { audit, requireStaff, ROLE_PERMISSIONS, type Permission } from "../auth";
import { db, type Tx } from "../db";
import { badRequest, conflict, json, notFound, Problem, readJson } from "../http";
import { limaDate } from "../lima";
import { enqueueMail } from "../mail";
import { etag, FIRMA, ifMatch, inbox, stale } from "../shared";
import { Check, pageResult, paging } from "../validate";
import { itemView } from "./forms";
import type { Route } from "../router";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const like = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

function idParam(id: string, code: string) {
  if (!UUID.test(id)) throw notFound(code);
  return id.toLowerCase();
}

function qParam(url: URL): string | null {
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length > 100) throw badRequest([{ field: "q", code: "INVALID_LENGTH" }]);
  return q || null;
}

function statusParam<T extends string>(url: URL, values: readonly T[], code = "INVALID_FILTER"): T | null {
  const s = url.searchParams.get("status")?.trim();
  if (!s || s === "all") return null;
  if (!values.includes(s as T)) throw badRequest([{ field: "status", code }]);
  return s as T;
}

/** La persona asignada debe ser del personal, estar activa y tener el permiso de gestión del módulo. */
async function checkAssignee(tx: Tx, body: Record<string, unknown>, perm: Permission): Promise<string> {
  const c = new Check(body).allow(["assigneeId"]);
  const id = typeof body.assigneeId === "string" && UUID.test(body.assigneeId) ? body.assigneeId.toLowerCase() : null;
  if (!id) c.fail("assigneeId", body.assigneeId === undefined || body.assigneeId === null ? "REQUIRED" : "INVALID_VALUE");
  c.done();
  const rows = await tx<{ role: string }[]>`
    select r.role from app.user_accounts u join app.user_roles r on r.user_id = u.id where u.id = ${id} and u.kind = 'STAFF' and u.status = 'ACTIVE'`;
  if (!rows.some((r) => ROLE_PERMISSIONS[r.role]?.includes(perm))) throw badRequest([{ field: "assigneeId", code: "INVALID_ASSIGNEE" }]);
  return id!;
}

// ======================================================================= Cotizaciones

const QUOTE_STATUSES = ["RECEIVED", "ASSIGNED", "IN_REVIEW", "RESPONDED", "CLOSED", "CANCELLED"] as const;
const QUOTE_NEXT: Record<string, string[]> = {
  RECEIVED: ["ASSIGNED", "IN_REVIEW", "CANCELLED"], ASSIGNED: ["IN_REVIEW", "CANCELLED"], IN_REVIEW: ["RESPONDED", "CANCELLED"], RESPONDED: ["CLOSED", "IN_REVIEW"], CLOSED: [], CANCELLED: [],
};

async function quoteDetail(tx: Tx, id: string) {
  const [q] = await tx`select *, requested_delivery_date::text rdd from app.quote_requests where id = ${id}`;
  if (!q) throw notFound("QUOTE_NOT_FOUND");
  const items = await tx`select * from app.quote_items where quote_id = ${id} order by line_no`;
  const history = await tx`select from_status, to_status, note, actor_id, occurred_at from app.quote_status_events where quote_id = ${id} order by occurred_at, id`;
  return {
    id: q.id, folio: q.folio, origin: q.origin, status: q.status,
    contact: { companyName: q.company_name, ruc: q.ruc, contactName: q.contact_name, position: q.contact_position, email: q.email, phone: q.phone },
    project: { projectType: q.project_type, deliveryDepartment: q.delivery_department, deliveryPlace: q.delivery_place, requestedDeliveryDate: q.rdd, message: q.message },
    items: items.map(itemView), privacyNoticeVersion: q.privacy_notice_version, customerId: q.customer_id, assigneeId: q.assignee_id, statusReason: q.status_reason,
    history: history.map((h) => ({ from: h.from_status, to: h.to_status, note: h.note, actorId: h.actor_id, occurredAt: iso(h.occurred_at) })),
    submittedAt: iso(q.submitted_at), updatedAt: iso(q.updated_at), version: Number(q.version),
  };
}

const listQuotes: Route = async (request) => {
  await requireStaff(request, "quote:read");
  const url = new URL(request.url);
  const { page, size } = paging(url);
  const status = statusParam(url, QUOTE_STATUSES);
  const q = qParam(url);
  const assignee = url.searchParams.get("assigneeId");
  const unassigned = url.searchParams.get("unassigned") === "true";
  const sql = db();
  const where = sql`where true
    ${status ? sql`and status = ${status}` : sql``}
    ${assignee && UUID.test(assignee) ? sql`and assignee_id = ${assignee}` : sql``}
    ${unassigned ? sql`and assignee_id is null` : sql``}
    ${q ? sql`and (folio ilike ${like(q)} or company_name ilike ${like(q)} or contact_name ilike ${like(q)} or email ilike ${like(q)})` : sql``}`;
  const [{ n }] = await sql`select count(*)::int n from app.quote_requests ${where}`;
  const rows = await sql`select r.*, (select count(*)::int from app.quote_items i where i.quote_id = r.id) line_count from app.quote_requests r ${where}
                         order by submitted_at desc, id desc limit ${size} offset ${page * size}`;
  return json(pageResult(rows.map((r) => ({ id: r.id, folio: r.folio, origin: r.origin, status: r.status, companyName: r.company_name, contactName: r.contact_name, email: r.email, lineCount: r.line_count, assigneeId: r.assignee_id, submittedAt: iso(r.submitted_at), updatedAt: iso(r.updated_at) })), page, size, n));
};

const getQuote: Route = async (request, { id }) => {
  await requireStaff(request, "quote:read");
  const d = await quoteDetail(db() as unknown as Tx, idParam(id, "QUOTE_NOT_FOUND"));
  return json(d, 200, etag(d.version));
};

/** Bloquea la fila, comprueba la versión y la estado, y deja que `change` haga el resto en la misma transacción. */
async function versioned<T>(table: "quote_requests" | "inquiries" | "complaints" | "data_subject_requests", id: string, expected: number, notFoundCode: string, change: (tx: Tx, row: Record<string, unknown>) => Promise<T>): Promise<T> {
  return (await db().begin(async (tx) => {
    const [row] = await tx`select * from ${tx("app." + table)} where id = ${id} for update`;
    if (!row) throw notFound(notFoundCode);
    if (Number(row.version) !== expected) throw stale();
    return change(tx, row);
  })) as T;
}

const assignQuote: Route = async (request, { id }) => {
  const me = await requireStaff(request, "quote:manage");
  const quoteId = idParam(id, "QUOTE_NOT_FOUND");
  const expected = ifMatch(request);
  const body = await readJson(request, 4096);
  const d = await versioned("quote_requests", quoteId, expected, "QUOTE_NOT_FOUND", async (tx, row) => {
    if (["RESPONDED", "CLOSED", "CANCELLED"].includes(row.status as string)) throw conflict("INVALID_TRANSITION");
    const assignee = await checkAssignee(tx, body, "quote:manage");
    const to = row.status === "RECEIVED" ? "ASSIGNED" : (row.status as string);
    await tx`update app.quote_requests set assignee_id = ${assignee}, status = ${to}, updated_at = now(), version = version + 1 where id = ${quoteId}`;
    await tx`insert into app.quote_status_events (id, quote_id, from_status, to_status, note, actor_id, occurred_at) values (${randomUUID()}, ${quoteId}, ${row.status as string}, ${to}, 'Asignada', ${me.id}, now())`;
    await audit(tx, me.id, `QUOTE_${to}`, "QUOTE", quoteId, { assigneeId: assignee });
    return quoteDetail(tx, quoteId);
  });
  return json(d, 200, etag(d.version));
};

const moveQuote: Route = async (request, { id }) => {
  const me = await requireStaff(request, "quote:manage");
  const quoteId = idParam(id, "QUOTE_NOT_FOUND");
  const expected = ifMatch(request);
  const body = await readJson(request, 8192);
  const c = new Check(body).allow(["status", "note"]);
  const to = c.str("status", { required: true, max: 12 });
  const note = c.str("note", { max: 1000, multiline: true });
  c.done();
  if (!QUOTE_STATUSES.includes(to as never)) throw badRequest([{ field: "status", code: "INVALID_STATUS" }]);
  const d = await versioned("quote_requests", quoteId, expected, "QUOTE_NOT_FOUND", async (tx, row) => {
    const from = row.status as string;
    if (!QUOTE_NEXT[from]?.includes(to!)) throw conflict("INVALID_TRANSITION");
    if (to === "CANCELLED" && (note?.length ?? 0) < 5) throw new Problem(422, "REASON_REQUIRED", "Indique el motivo de la cancelación.");
    await tx`update app.quote_requests set status = ${to}, status_reason = ${to === "CANCELLED" ? note!.slice(0, 500) : (row.status_reason as string | null)}, updated_at = now(), version = version + 1 where id = ${quoteId}`;
    await tx`insert into app.quote_status_events (id, quote_id, from_status, to_status, note, actor_id, occurred_at) values (${randomUUID()}, ${quoteId}, ${from}, ${to}, ${note}, ${me.id}, now())`;
    await audit(tx, me.id, `QUOTE_${to}`, "QUOTE", quoteId, {});
    return quoteDetail(tx, quoteId);
  });
  return json(d, 200, etag(d.version));
};

// ======================================================================= Consultas

const INQ_STATUSES = ["RECEIVED", "IN_PROGRESS", "ANSWERED", "CLOSED"] as const;
const INQ_NEXT: Record<string, string[]> = { RECEIVED: ["IN_PROGRESS", "ANSWERED", "CLOSED"], IN_PROGRESS: ["ANSWERED", "CLOSED"], ANSWERED: ["CLOSED", "IN_PROGRESS"], CLOSED: [] };

async function inquiryDetail(tx: Tx, id: string) {
  const [r] = await tx`select * from app.inquiries where id = ${id}`;
  if (!r) throw notFound("INQUIRY_NOT_FOUND");
  const history = await tx`select from_status, to_status, note, actor_id, occurred_at from app.inquiry_events where inquiry_id = ${id} order by occurred_at, id`;
  return {
    id: r.id, folio: r.folio, reason: r.reason, status: r.status, fullName: r.full_name, companyName: r.company_name, ruc: r.ruc, position: r.position, email: r.email, phone: r.phone,
    message: r.message, requestedDocument: r.requested_document, privacyNoticeVersion: r.privacy_notice_version, assigneeId: r.assignee_id,
    history: history.map((h) => ({ from: h.from_status, to: h.to_status, note: h.note, actorId: h.actor_id, occurredAt: iso(h.occurred_at) })),
    receivedAt: iso(r.received_at), updatedAt: iso(r.updated_at), version: Number(r.version),
  };
}

const listInquiries: Route = async (request) => {
  await requireStaff(request, "inquiry:read");
  const url = new URL(request.url);
  const { page, size } = paging(url);
  const status = statusParam(url, INQ_STATUSES, "INVALID_VALUE");
  const q = qParam(url);
  const sql = db();
  const where = sql`where true ${status ? sql`and status = ${status}` : sql``}
    ${q ? sql`and (folio ilike ${like(q)} or full_name ilike ${like(q)} or company_name ilike ${like(q)} or email ilike ${like(q)})` : sql``}`;
  const [{ n }] = await sql`select count(*)::int n from app.inquiries ${where}`;
  const rows = await sql`select * from app.inquiries ${where} order by received_at desc, id desc limit ${size} offset ${page * size}`;
  return json(pageResult(rows.map((r) => ({ id: r.id, folio: r.folio, reason: r.reason, status: r.status, fullName: r.full_name, companyName: r.company_name, email: r.email, assigneeId: r.assignee_id, receivedAt: iso(r.received_at) })), page, size, n));
};

const getInquiry: Route = async (request, { id }) => {
  await requireStaff(request, "inquiry:read");
  const d = await inquiryDetail(db() as unknown as Tx, idParam(id, "INQUIRY_NOT_FOUND"));
  return json(d, 200, etag(d.version));
};

const assignInquiry: Route = async (request, { id }) => {
  const me = await requireStaff(request, "inquiry:manage");
  const inqId = idParam(id, "INQUIRY_NOT_FOUND");
  const expected = ifMatch(request);
  const body = await readJson(request, 4096);
  const d = await versioned("inquiries", inqId, expected, "INQUIRY_NOT_FOUND", async (tx, row) => {
    if (row.status === "CLOSED") throw conflict("INVALID_TRANSITION");
    const assignee = await checkAssignee(tx, body, "inquiry:manage");
    const to = row.status === "RECEIVED" ? "IN_PROGRESS" : (row.status as string);
    await tx`update app.inquiries set assignee_id = ${assignee}, status = ${to}, updated_at = now(), version = version + 1 where id = ${inqId}`;
    await tx`insert into app.inquiry_events (id, inquiry_id, from_status, to_status, note, actor_id, occurred_at) values (${randomUUID()}, ${inqId}, ${row.status as string}, ${to}, 'Asignada', ${me.id}, now())`;
    await audit(tx, me.id, `INQUIRY_${to}`, "INQUIRY", inqId, { assigneeId: assignee });
    return inquiryDetail(tx, inqId);
  });
  return json(d, 200, etag(d.version));
};

const moveInquiry: Route = async (request, { id }) => {
  const me = await requireStaff(request, "inquiry:manage");
  const inqId = idParam(id, "INQUIRY_NOT_FOUND");
  const expected = ifMatch(request);
  const body = await readJson(request, 8192);
  const c = new Check(body).allow(["status", "note"]);
  const to = c.str("status", { required: true, max: 12 });
  const note = c.str("note", { max: 1000, multiline: true });
  c.done();
  if (!INQ_STATUSES.includes(to as never)) throw badRequest([{ field: "status", code: "INVALID_VALUE" }]);
  const d = await versioned("inquiries", inqId, expected, "INQUIRY_NOT_FOUND", async (tx, row) => {
    const from = row.status as string;
    if (!INQ_NEXT[from]?.includes(to!)) throw conflict("INVALID_TRANSITION");
    await tx`update app.inquiries set status = ${to}, updated_at = now(), version = version + 1 where id = ${inqId}`;
    await tx`insert into app.inquiry_events (id, inquiry_id, from_status, to_status, note, actor_id, occurred_at) values (${randomUUID()}, ${inqId}, ${from}, ${to}, ${note}, ${me.id}, now())`;
    await audit(tx, me.id, `INQUIRY_${to}`, "INQUIRY", inqId, {});
    if (to === "ANSWERED" && note) {
      await enqueueMail(tx, {
        dedupeKey: `INQUIRY_ANSWER:${row.folio}:${Date.now()}:${row.email}`, template: "INQUIRY_ANSWER", to: row.email as string, reference: row.folio as string,
        subject: `FUNDIGSAC: respuesta a su consulta ${row.folio}`,
        text: `Estimado(a) ${row.full_name}:\n\nEn atención a su consulta ${row.folio}:\n\n${note}${FIRMA}`,
      });
    }
    return inquiryDetail(tx, inqId);
  });
  return json(d, 200, etag(d.version));
};

// ======================================================================= Reclamaciones

const CMP_STATUSES = ["FILED", "IN_REVIEW", "ANSWERED", "CLOSED"] as const;
const isOverdue = (status: string, due: string) => (status === "FILED" || status === "IN_REVIEW") && limaDate() > due;

async function complaintSheet(tx: Tx, id: string) {
  const [r] = await tx`select *, response_due_on::text due, incident_date::text incident from app.complaints where id = ${id}`;
  if (!r) throw notFound("COMPLAINT_NOT_FOUND");
  const history = await tx`select event_type, note, actor_id, occurred_at from app.complaint_events where complaint_id = ${id} order by occurred_at, id`;
  return {
    id: r.id, folio: r.folio, kind: r.kind, status: r.status, consumerName: r.consumer_name, document: `${r.document_type} ${r.document_number}`, email: r.email, phone: r.phone,
    address: r.address, minor: r.is_minor, guardianName: r.guardian_name, guardianDocument: r.guardian_document_type ? `${r.guardian_document_type} ${r.guardian_document_number}` : null,
    goodType: r.good_type, goodDescription: r.good_description, claimedAmount: r.claimed_amount === null ? null : { amount: Number(r.claimed_amount), currency: r.claimed_currency },
    serviceLocation: r.service_location, incidentDate: r.incident, relatedReference: r.related_reference, facts: r.facts, consumerRequest: r.consumer_request,
    responseChannel: r.response_channel, filedAt: iso(r.filed_at), responseDueOn: r.due, overdue: isOverdue(r.status, r.due), responseText: r.response_text,
    respondedAt: iso(r.responded_at), closedAt: iso(r.closed_at), assigneeId: r.assignee_id,
    history: history.map((h) => ({ type: h.event_type, note: h.note, actorId: h.actor_id, occurredAt: iso(h.occurred_at) })), version: Number(r.version),
  };
}

const listComplaints: Route = async (request) => {
  await requireStaff(request, "complaint:read");
  const url = new URL(request.url);
  const { page, size } = paging(url);
  const status = statusParam(url, CMP_STATUSES, "INVALID_VALUE");
  const q = qParam(url);
  const overdue = url.searchParams.get("overdue") === "true";
  const sql = db();
  const where = sql`where true ${status ? sql`and status = ${status}` : sql``}
    ${overdue ? sql`and status in ('FILED','IN_REVIEW') and response_due_on < ${limaDate()}` : sql``}
    ${q ? sql`and (folio ilike ${like(q)} or consumer_name ilike ${like(q)} or email ilike ${like(q)})` : sql``}`;
  const [{ n }] = await sql`select count(*)::int n from app.complaints ${where}`;
  const rows = await sql`select id, folio, kind, status, consumer_name, filed_at, response_due_on::text due, assignee_id from app.complaints ${where}
                         order by response_due_on, filed_at, id limit ${size} offset ${page * size}`;
  return json(pageResult(rows.map((r) => ({ id: r.id, folio: r.folio, kind: r.kind, status: r.status, consumerName: r.consumer_name, filedAt: iso(r.filed_at), responseDueOn: r.due, overdue: isOverdue(r.status, r.due), assigneeId: r.assignee_id })), page, size, n));
};

const getComplaint: Route = async (request, { id }) => {
  await requireStaff(request, "complaint:read");
  const d = await complaintSheet(db() as unknown as Tx, idParam(id, "COMPLAINT_NOT_FOUND"));
  return json(d, 200, etag(d.version));
};

const assignComplaint: Route = async (request, { id }) => {
  const me = await requireStaff(request, "complaint:manage");
  const cid = idParam(id, "COMPLAINT_NOT_FOUND");
  const expected = ifMatch(request);
  const body = await readJson(request, 4096);
  const d = await versioned("complaints", cid, expected, "COMPLAINT_NOT_FOUND", async (tx, row) => {
    if (row.status === "ANSWERED" || row.status === "CLOSED") throw conflict("ALREADY_ANSWERED");
    const assignee = await checkAssignee(tx, body, "complaint:manage");
    await tx`update app.complaints set assignee_id = ${assignee}, status = 'IN_REVIEW', updated_at = now(), version = version + 1 where id = ${cid}`;
    await tx`insert into app.complaint_events (id, complaint_id, event_type, actor_id, occurred_at) values (${randomUUID()}, ${cid}, 'ASSIGNED', ${me.id}, now())`;
    await audit(tx, me.id, "COMPLAINT_ASSIGNED", "COMPLAINT", cid, { assigneeId: assignee });
    return complaintSheet(tx, cid);
  });
  return json(d, 200, etag(d.version));
};

const noteComplaint: Route = async (request, { id }) => {
  const me = await requireStaff(request, "complaint:manage");
  const cid = idParam(id, "COMPLAINT_NOT_FOUND");
  const expected = ifMatch(request);
  const body = await readJson(request, 8192);
  const c = new Check(body).allow(["note"]);
  const note = c.str("note", { required: true, min: 3, max: 1000, multiline: true });
  c.done();
  const d = await versioned("complaints", cid, expected, "COMPLAINT_NOT_FOUND", async (tx) => {
    await tx`update app.complaints set updated_at = now(), version = version + 1 where id = ${cid}`;
    await tx`insert into app.complaint_events (id, complaint_id, event_type, note, actor_id, occurred_at) values (${randomUUID()}, ${cid}, 'NOTE', ${note}, ${me.id}, now())`;
    await audit(tx, me.id, "COMPLAINT_NOTE", "COMPLAINT", cid, {});
    return complaintSheet(tx, cid);
  });
  return json(d, 200, etag(d.version));
};

const answerComplaint: Route = async (request, { id }) => {
  const me = await requireStaff(request, "complaint:manage");
  const cid = idParam(id, "COMPLAINT_NOT_FOUND");
  const expected = ifMatch(request);
  const body = await readJson(request, 32 * 1024);
  const c = new Check(body).allow(["response"]);
  const response = c.str("response", { required: true, min: 20, max: 8000, multiline: true });
  c.done();
  const d = await versioned("complaints", cid, expected, "COMPLAINT_NOT_FOUND", async (tx, row) => {
    if (row.status === "ANSWERED" || row.status === "CLOSED") throw conflict("ALREADY_ANSWERED");
    const [{ due }] = await tx`select response_due_on::text due from app.complaints where id = ${cid}`;
    const late = limaDate() > due;
    await tx`update app.complaints set response_text = ${response}, responded_at = now(), responded_by = ${me.id}, status = 'ANSWERED', updated_at = now(), version = version + 1 where id = ${cid}`;
    await tx`insert into app.complaint_events (id, complaint_id, event_type, note, actor_id, occurred_at) values (${randomUUID()}, ${cid}, 'ANSWERED', ${late ? "Respuesta fuera de plazo" : null}, ${me.id}, now())`;
    await audit(tx, me.id, "COMPLAINT_ANSWERED", "COMPLAINT", cid, { late });
    if (row.response_channel === "EMAIL") {
      await enqueueMail(tx, {
        dedupeKey: `COMPLAINT_ANSWER:${row.folio}:${row.email}`, template: "COMPLAINT_ANSWER", to: row.email as string, reference: row.folio as string,
        subject: `FUNDIGSAC: respuesta a su hoja de reclamación ${row.folio}`,
        text: `Estimado(a) ${row.consumer_name}:\n\nEn atención a su hoja de reclamación N.° ${row.folio}, le respondemos:\n\n${response}${FIRMA}`,
      });
    } else {
      const legal = inbox("LEGAL_INBOX");
      if (legal)
        await enqueueMail(tx, {
          dedupeKey: `COMPLAINT_ANSWER_POST:${row.folio}:${legal}`, template: "COMPLAINT_ANSWER_POST", to: legal, reference: row.folio as string,
          subject: `Libro de Reclamaciones: enviar respuesta por correo postal ${row.folio}`,
          text: `La hoja ${row.folio} pidió respuesta por correo postal a: ${row.address}.\n\nTexto de la respuesta:\n${response}`,
        });
    }
    return complaintSheet(tx, cid);
  });
  return json(d, 200, etag(d.version));
};

// ======================================================================= Privacidad

const DSR_STATUSES = ["RECEIVED", "IN_PROGRESS", "RESOLVED", "REJECTED"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const requestView = (r: any) => ({
  id: r.id, folio: r.folio, type: r.request_type, status: r.status, fullName: r.full_name, email: r.email, document: r.document_type ? `${r.document_type} ${r.document_number}` : null,
  details: r.details, resolutionNote: r.resolution_note, receivedAt: iso(r.received_at), resolvedAt: iso(r.resolved_at), resolvedBy: r.resolved_by, version: Number(r.version),
});

const listPrivacy: Route = async (request) => {
  await requireStaff(request, "privacy:read");
  const url = new URL(request.url);
  const { page, size } = paging(url);
  const status = statusParam(url, DSR_STATUSES, "INVALID_VALUE");
  const sql = db();
  const where = sql`where true ${status ? sql`and status = ${status}` : sql``}`;
  const [{ n }] = await sql`select count(*)::int n from app.data_subject_requests ${where}`;
  const rows = await sql`select * from app.data_subject_requests ${where} order by received_at, id limit ${size} offset ${page * size}`;
  return json(pageResult(rows.map(requestView), page, size, n));
};

const getPrivacy: Route = async (request, { id }) => {
  await requireStaff(request, "privacy:read");
  const [r] = await db()`select * from app.data_subject_requests where id = ${idParam(id, "REQUEST_NOT_FOUND")}`;
  if (!r) throw notFound("REQUEST_NOT_FOUND");
  return json(requestView(r), 200, etag(r.version));
};

const startPrivacy: Route = async (request, { id }) => {
  const me = await requireStaff(request, "privacy:manage");
  const rid = idParam(id, "REQUEST_NOT_FOUND");
  const expected = ifMatch(request);
  const r = await versioned("data_subject_requests", rid, expected, "REQUEST_NOT_FOUND", async (tx, row) => {
    if (row.status !== "RECEIVED") throw conflict("INVALID_TRANSITION");
    const [x] = await tx`update app.data_subject_requests set status = 'IN_PROGRESS', updated_at = now(), version = version + 1 where id = ${rid} returning *`;
    await audit(tx, me.id, "DSR_IN_PROGRESS", "DATA_SUBJECT_REQUEST", rid, {});
    return x;
  });
  return json(requestView(r), 200, etag(r.version));
};

const concludePrivacy: Route = async (request, { id }) => {
  const me = await requireStaff(request, "privacy:manage");
  const rid = idParam(id, "REQUEST_NOT_FOUND");
  const expected = ifMatch(request);
  const body = await readJson(request, 16 * 1024);
  const c = new Check(body).allow(["accepted", "resolutionNote"]);
  const accepted = c.bool("accepted", { required: true });
  const note = c.str("resolutionNote", { required: true, min: 10, max: 4000, multiline: true });
  c.done();
  const r = await versioned("data_subject_requests", rid, expected, "REQUEST_NOT_FOUND", async (tx, row) => {
    if (row.status !== "RECEIVED" && row.status !== "IN_PROGRESS") throw conflict("INVALID_TRANSITION");
    const status = accepted ? "RESOLVED" : "REJECTED";
    const [x] = await tx`update app.data_subject_requests set status = ${status}, resolution_note = ${note}, resolved_at = now(), resolved_by = ${me.id}, updated_at = now(), version = version + 1 where id = ${rid} returning *`;
    await audit(tx, me.id, `DSR_${status}`, "DATA_SUBJECT_REQUEST", rid, {});
    await enqueueMail(tx, {
      dedupeKey: `RIGHTS_RESOLUTION:${row.folio}:${row.email}`, template: "RIGHTS_RESOLUTION", to: row.email as string, reference: row.folio as string,
      subject: `FUNDIGSAC: resultado de su solicitud ${row.folio}`,
      text: `Estimado(a) ${row.full_name}:\n\nSu solicitud ${row.folio} ${accepted ? "fue atendida" : "no pudo ser atendida"}.\n\n${note}${FIRMA}`,
    });
    return x;
  });
  return json(requestView(r), 200, etag(r.version));
};

export const staffCaseRoutes: Record<string, Route> = {
  "GET /staff/quotes": listQuotes,
  "GET /staff/quotes/:id": getQuote,
  "POST /staff/quotes/:id/assign": assignQuote,
  "POST /staff/quotes/:id/status": moveQuote,
  "GET /staff/inquiries": listInquiries,
  "GET /staff/inquiries/:id": getInquiry,
  "POST /staff/inquiries/:id/assign": assignInquiry,
  "POST /staff/inquiries/:id/status": moveInquiry,
  "GET /staff/complaints": listComplaints,
  "GET /staff/complaints/:id": getComplaint,
  "POST /staff/complaints/:id/assign": assignComplaint,
  "POST /staff/complaints/:id/notes": noteComplaint,
  "POST /staff/complaints/:id/answer": answerComplaint,
  "GET /staff/privacy/requests": listPrivacy,
  "GET /staff/privacy/requests/:id": getPrivacy,
  "POST /staff/privacy/requests/:id/start": startPrivacy,
  "POST /staff/privacy/requests/:id/conclude": concludePrivacy,
};

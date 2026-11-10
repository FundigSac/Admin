import "server-only";
import { randomUUID } from "node:crypto";
import { audit, optionalPrincipal } from "../auth";
import { db, type Tx } from "../db";
import { badRequest, clientIp, json, notFound, Problem, readJson } from "../http";
import { addBusinessDays, limaDate } from "../lima";
import { rateLimit } from "../limits";
import { enqueueMail } from "../mail";
import { fechaLarga, FIRMA, inbox, nextFolio, receiptMatches, receiptToken, reserveIdempotency } from "../shared";
import { asObject, Check, normDocument } from "../validate";
import type { Route } from "../router";

const PUBLIC_FORM = (request: Request) => rateLimit(`public-form:${clientIp(request)}`, 5, 600);
const idemKey = (request: Request) => request.headers.get("idempotency-key")?.trim() || null;
const plusYears = (date: string, n: number) => `${Number(date.slice(0, 4)) + n}${date.slice(4)}`;

const UNITS: Record<string, [string, string]> = {
  und: ["UNIT", "Unidades"], juego: ["SET", "Juego completo"], lote: ["LOT", "Lote"], m: ["METER", "Metros lineales"], kg: ["KILOGRAM", "Kilogramos"],
  UNIT: ["UNIT", "Unidades"], SET: ["SET", "Juego completo"], LOT: ["LOT", "Lote"], METER: ["METER", "Metros lineales"], KILOGRAM: ["KILOGRAM", "Kilogramos"],
};

// ---------------------------------------------------------------- Cotizaciones

type QuoteItem = { productSlug: string | null; productName: string; variantLabel: string | null; quantity: string; unit: string; addons: string[]; notes: string | null };

function parseQuote(body: Record<string, unknown>) {
  const c = new Check(body).allow(["origin", "contact", "project", "items", "privacyNoticeVersion", "acceptPrivacyNotice", "website"]);
  const origin = c.oneOf("origin", ["GENERAL_FORM", "PRODUCT_FORM", "PROCUREMENT"] as const, { required: true });
  const contactRaw = asObject(body.contact);
  if (!contactRaw) c.fail("contact", "REQUIRED");
  const k = new Check(contactRaw ?? {}, "contact").allow(["companyName", "ruc", "contactName", "position", "email", "phone"]);
  const contact = {
    companyName: k.str("companyName", { required: true, min: 2, max: 160 }),
    ruc: k.ruc("ruc", true),
    contactName: k.str("contactName", { required: true, min: 2, max: 120 }),
    position: k.str("position", { max: 120 }),
    email: k.email("email"),
    phone: k.phone("phone"),
  };
  const projectRaw = body.project === undefined || body.project === null ? {} : asObject(body.project);
  if (!projectRaw) c.fail("project", "INVALID_VALUE");
  const p = new Check(projectRaw ?? {}, "project").allow(["projectType", "deliveryDepartment", "deliveryPlace", "requestedDeliveryDate", "message"]);
  const today = limaDate();
  const project = {
    projectType: p.str("projectType", { max: 120 }),
    deliveryDepartment: p.str("deliveryDepartment", { max: 60 }),
    deliveryPlace: p.str("deliveryPlace", { max: 200 }),
    requestedDeliveryDate: p.date("requestedDeliveryDate", { min: today, max: plusYears(today, 3) }),
    message: p.str("message", { max: 4000, multiline: true }),
  };
  const items: QuoteItem[] = [];
  const rawItems = body.items === undefined || body.items === null ? [] : body.items;
  if (!Array.isArray(rawItems)) c.fail("items", "INVALID_VALUE");
  else if (rawItems.length > 50) c.fail("items", "TOO_MANY");
  else
    rawItems.forEach((it, i) => {
      const o = asObject(it);
      const ic = new Check(o ?? {}, `items[${i}]`).allow(["productSlug", "productName", "variantLabel", "quantity", "unit", "addons", "notes"]);
      // El catálogo vive en el sitio: el slug se guarda como referencia (formato válido) junto al nombre que envió el
      // sitio. Sin nombre se usa el slug, como hace el propio sitio al reenviar en texto libre.
      const productSlug = ic.str("productSlug", { max: 120, pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/ });
      const productName = ic.str("productName", { required: !productSlug, min: 2, max: 200 }) ?? productSlug;
      const variantLabel = ic.str("variantLabel", { max: 120 });
      const q = o?.quantity;
      let quantity: string | null = null;
      if (typeof q !== "number" || !Number.isFinite(q)) ic.fail("quantity", q === undefined || q === null ? "REQUIRED" : "INVALID_VALUE");
      else if (q <= 0 || q > 1_000_000 || !/^\d{1,7}(\.\d{1,3})?$/.test(String(q))) ic.fail("quantity", "OUT_OF_RANGE");
      else quantity = String(q);
      const unitRaw = typeof o?.unit === "string" ? o.unit.trim() : "";
      if (!unitRaw) ic.fail("unit", "REQUIRED");
      else if (!UNITS[unitRaw]) c.errors.push({ field: "items.unit", code: "INVALID_UNIT" });
      let addons: string[] = [];
      if (o?.addons !== undefined && o?.addons !== null) {
        if (!Array.isArray(o.addons) || o.addons.length > 10 || o.addons.some((a) => typeof a !== "string" || !a.trim() || a.trim().length > 120)) ic.fail("addons", "INVALID_VALUE");
        else addons = [...new Set((o.addons as string[]).map((a) => a.trim()))];
      }
      const notes = ic.str("notes", { max: 1000, multiline: true });
      c.errors.push(...ic.errors);
      if (productName && quantity && UNITS[unitRaw]) items.push({ productSlug, productName, variantLabel, quantity, unit: UNITS[unitRaw][0], addons, notes });
    });
  const privacyNoticeVersion = c.str("privacyNoticeVersion", { required: true, max: 20 });
  c.bool("acceptPrivacyNotice", { mustBeTrue: true });
  c.honeypot();
  c.errors.push(...k.errors, ...p.errors);
  c.done();
  if (items.length === 0 && (project.message?.length ?? 0) < 10) throw new Problem(422, "EMPTY_QUOTE", "Indique al menos un producto o describa lo que necesita.");
  return { origin: origin!, contact, project, items, privacyNoticeVersion: privacyNoticeVersion! };
}

async function quoteReceiptBody(tx: Tx, folio: string) {
  const [q] = await tx<{ folio: string; status: string; submitted_at: Date }[]>`select folio, status, submitted_at from app.quote_requests where folio = ${folio}`;
  return {
    folio: q.folio,
    status: q.status,
    receivedAt: q.submitted_at.toISOString(),
    receiptToken: receiptToken("quote", q.folio),
    receiptUrl: `/api/v1/quotes/${q.folio}/receipt`,
    message: "Solicitud registrada. Ventas la revisará y le responderá por correo. Guarde su folio.",
  };
}

const submitQuote: Route = async (request) => {
  const body = await readJson(request);
  const cmd = parseQuote(body);
  const customer = await optionalPrincipal(request);
  const customerId = customer?.kind === "CUSTOMER" ? customer.id : null;
  await PUBLIC_FORM(request);
  const receipt = await db().begin(async (tx) => {
    const idem = await reserveIdempotency(tx, "quote", idemKey(request), { ...cmd, customerId });
    if (idem.replayFolio) return quoteReceiptBody(tx, idem.replayFolio);
    const id = randomUUID();
    const folio = await nextFolio(tx, cmd.origin === "PROCUREMENT" ? "REQ" : "COT");
    const { contact: k, project: p } = cmd;
    await tx`insert into app.quote_requests (id, folio, origin, status, company_name, ruc, contact_name, contact_position, email, phone,
               project_type, delivery_department, delivery_place, requested_delivery_date, message, privacy_notice_version, customer_id, submitted_at, updated_at)
             values (${id}, ${folio}, ${cmd.origin}, 'RECEIVED', ${k.companyName}, ${k.ruc}, ${k.contactName}, ${k.position}, ${k.email}, ${k.phone},
               ${p.projectType}, ${p.deliveryDepartment}, ${p.deliveryPlace}, ${p.requestedDeliveryDate}, ${p.message}, ${cmd.privacyNoticeVersion}, ${customerId}, now(), now())`;
    for (const [i, it] of cmd.items.entries()) {
      await tx`insert into app.quote_items (quote_id, line_no, product_slug, product_name, variant_label, quantity, unit, addons, notes)
               values (${id}, ${i + 1}, ${it.productSlug}, ${it.productName}, ${it.variantLabel}, ${it.quantity}, ${it.unit}, ${it.addons}, ${it.notes})`;
    }
    await tx`insert into app.quote_status_events (id, quote_id, from_status, to_status, actor_id, occurred_at) values (${randomUUID()}, ${id}, null, 'RECEIVED', ${customerId}, now())`;
    await audit(tx, customerId, "QUOTE_SUBMITTED", "QUOTE", id, { folio });
    const now = new Date();
    await enqueueMail(tx, {
      dedupeKey: `QUOTE_RECEIPT:${folio}:${k.email}`, template: "QUOTE_RECEIPT", to: k.email!, reference: folio,
      subject: `FUNDIGSAC: recibimos su solicitud de cotización ${folio}`,
      text: `Estimado(a) ${k.contactName}:\n\nRegistramos su solicitud de cotización ${folio} el ${fechaLarga(now)} con ${cmd.items.length} producto(s). El equipo de Ventas la revisará y le responderá por este medio. Guarde su folio para cualquier consulta.${FIRMA}`,
    });
    const sales = inbox("SALES_INBOX");
    if (sales)
      await enqueueMail(tx, {
        dedupeKey: `QUOTE_SALES:${folio}:${sales}`, template: "QUOTE_SALES", to: sales, reference: folio,
        subject: `Nueva solicitud de cotización ${folio} - ${k.companyName}`.slice(0, 200),
        text: `Empresa: ${k.companyName} (RUC ${k.ruc})\nContacto: ${k.contactName}, ${k.email}, ${k.phone}\nOrigen: ${cmd.origin}\nProductos: ${cmd.items.length}\n\nRevísela en el panel: ${process.env.ADMIN_URL ?? "https://fundigsac-admin.vercel.app"}/cotizaciones`,
      });
    await idem.finish(folio);
    return quoteReceiptBody(tx, folio);
  });
  return json(receipt, 201, { Location: receipt.receiptUrl });
};

const quoteReceipt: Route = async (request, { folio }) => {
  if (!/^[A-Z]{3}-\d{4}-\d{6}$/.test(folio)) throw badRequest([{ field: "folio", code: "INVALID_FOLIO" }]);
  await rateLimit(`receipt:${clientIp(request)}`, 30, 60);
  if (!receiptMatches("quote", folio, request.headers.get("x-receipt-token"))) throw notFound("QUOTE_NOT_FOUND");
  const [q] = await db()<{ id: string; folio: string; status: string; submitted_at: Date; company_name: string; contact_name: string; email: string }[]>`
    select id, folio, status, submitted_at, company_name, contact_name, email from app.quote_requests where folio = ${folio}`;
  if (!q) throw notFound("QUOTE_NOT_FOUND");
  const items = await db()`select line_no, product_slug, product_name, sku, variant_label, quantity, unit, addons, notes from app.quote_items where quote_id = ${q.id} order by line_no`;
  const [local, domain] = q.email.split("@");
  return json({ folio: q.folio, status: q.status, receivedAt: q.submitted_at.toISOString(), companyName: q.company_name, contactName: q.contact_name, email: `${local[0]}***@${domain}`, items: items.map(itemView) });
};

const UNIT_CODE: Record<string, [string, string]> = { UNIT: ["und", "Unidades"], SET: ["juego", "Juego completo"], LOT: ["lote", "Lote"], METER: ["m", "Metros lineales"], KILOGRAM: ["kg", "Kilogramos"] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const itemView = (r: any) => ({
  lineNo: r.line_no, productSlug: r.product_slug, productName: r.product_name, sku: r.sku, variantLabel: r.variant_label,
  quantity: Number(r.quantity), unit: UNIT_CODE[r.unit]?.[0] ?? r.unit, unitLabel: UNIT_CODE[r.unit]?.[1] ?? r.unit, addons: r.addons ?? [], notes: r.notes,
});

// ---------------------------------------------------------------- Consultas

const submitInquiry: Route = async (request) => {
  const body = await readJson(request);
  const c = new Check(body).allow(["reason", "fullName", "companyName", "ruc", "position", "email", "phone", "message", "requestedDocument", "privacyNoticeVersion", "acceptPrivacyNotice", "website"]);
  const cmd = {
    reason: c.oneOf("reason", ["GENERAL", "TECHNICAL", "COMMERCIAL", "DOCUMENTATION", "MEETING", "AFTER_SALES", "OTHER"] as const) ?? "GENERAL",
    fullName: c.str("fullName", { required: true, min: 2, max: 120 }),
    companyName: c.str("companyName", { required: true, min: 2, max: 160 }),
    ruc: c.ruc("ruc", false),
    position: c.str("position", { max: 120 }),
    email: c.email("email"),
    phone: c.phone("phone"),
    message: c.str("message", { required: true, min: 10, max: 4000, multiline: true }),
    requestedDocument: c.str("requestedDocument", { max: 200 }),
    privacyNoticeVersion: c.str("privacyNoticeVersion", { required: true, max: 20 }),
  };
  c.bool("acceptPrivacyNotice", { mustBeTrue: true });
  c.honeypot();
  c.done();
  await PUBLIC_FORM(request);
  const out = await db().begin(async (tx) => {
    const idem = await reserveIdempotency(tx, "inquiry", idemKey(request), cmd);
    if (idem.replayFolio) {
      const [r] = await tx<{ folio: string; status: string; received_at: Date }[]>`select folio, status, received_at from app.inquiries where folio = ${idem.replayFolio}`;
      return r;
    }
    const id = randomUUID();
    const folio = await nextFolio(tx, "CON");
    const [r] = await tx<{ folio: string; status: string; received_at: Date }[]>`
      insert into app.inquiries (id, folio, reason, full_name, company_name, ruc, position, email, phone, message, requested_document, privacy_notice_version, status, received_at, updated_at)
      values (${id}, ${folio}, ${cmd.reason}, ${cmd.fullName}, ${cmd.companyName}, ${cmd.ruc}, ${cmd.position}, ${cmd.email}, ${cmd.phone}, ${cmd.message}, ${cmd.requestedDocument}, ${cmd.privacyNoticeVersion}, 'RECEIVED', now(), now())
      returning folio, status, received_at`;
    await tx`insert into app.inquiry_events (id, inquiry_id, from_status, to_status, occurred_at) values (${randomUUID()}, ${id}, null, 'RECEIVED', now())`;
    await audit(tx, null, "INQUIRY_RECEIVED", "INQUIRY", id, { folio });
    await enqueueMail(tx, {
      dedupeKey: `INQUIRY_RECEIPT:${folio}:${cmd.email}`, template: "INQUIRY_RECEIPT", to: cmd.email!, reference: folio,
      subject: `FUNDIGSAC: recibimos su consulta ${folio}`,
      text: `Estimado(a) ${cmd.fullName}:\n\nRegistramos su consulta ${folio} el ${fechaLarga(r.received_at)}. Le responderemos por correo o teléfono.${FIRMA}`,
    });
    const sales = inbox("SALES_INBOX");
    if (sales)
      await enqueueMail(tx, {
        dedupeKey: `INQUIRY_SALES:${folio}:${sales}`, template: "INQUIRY_SALES", to: sales, reference: folio,
        subject: `Nueva consulta ${folio} - ${cmd.companyName}`.slice(0, 200),
        text: `Empresa: ${cmd.companyName}\nContacto: ${cmd.fullName}, ${cmd.email}, ${cmd.phone}\nMotivo: ${cmd.reason}`,
      });
    await idem.finish(folio);
    return r;
  });
  return json({ folio: out.folio, status: out.status, receivedAt: out.received_at.toISOString(), message: "Consulta registrada. Le responderemos por correo o teléfono." }, 201, { Location: `/api/v1/inquiries/${out.folio}` });
};

// ---------------------------------------------------------------- Libro de Reclamaciones

const RESPONSE_BUSINESS_DAYS = 15;

const fileComplaint: Route = async (request) => {
  const body = await readJson(request);
  const c = new Check(body).allow([
    "kind", "consumerName", "documentType", "documentNumber", "email", "phone", "address", "minor", "guardianName", "guardianDocumentType",
    "guardianDocumentNumber", "goodType", "goodDescription", "claimedAmount", "currency", "serviceLocation", "incidentDate", "relatedReference",
    "facts", "consumerRequest", "responseChannel", "privacyNoticeVersion", "acceptPrivacyNotice", "website",
  ]);
  const today = limaDate();
  const kind = c.oneOf("kind", ["CLAIM", "GRIEVANCE"] as const, { required: true });
  const documentType = c.oneOf("documentType", ["DNI", "CE", "PASSPORT", "RUC"] as const, { required: true });
  const docRaw = c.str("documentNumber", { required: true, max: 12 });
  const documentNumber = documentType && docRaw ? normDocument(documentType, docRaw) : null;
  if (documentType && docRaw && !documentNumber) c.fail("documentNumber", "INVALID_DOCUMENT");
  const minor = c.bool("minor");
  const guardianName = c.str("guardianName", { min: 2, max: 160 });
  const gType = c.oneOf("guardianDocumentType", ["DNI", "CE", "PASSPORT", "RUC"] as const);
  const gRaw = c.str("guardianDocumentNumber", { max: 12 });
  let guardian: { name: string; type: string; number: string } | null = null;
  if (minor) {
    if (!guardianName || !gRaw) c.fail("guardian", "REQUIRED");
    else if (!gType) c.fail("guardian.documentType", "INVALID_VALUE");
    else if (gType === "RUC") c.fail("guardian.documentType", "INVALID_DOCUMENT");
    else {
      const n = normDocument(gType, gRaw);
      if (!n) c.fail("guardian.documentNumber", "INVALID_DOCUMENT");
      else guardian = { name: guardianName, type: gType, number: n };
    }
  }
  const goodType = c.oneOf("goodType", ["PRODUCT", "SERVICE"] as const);
  if (kind === "CLAIM" && !goodType) c.fail("goodType", "REQUIRED");
  let amount: string | null = null;
  const a = body.claimedAmount;
  if (a !== undefined && a !== null) {
    if (typeof a !== "number" || !Number.isFinite(a) || a < 0 || a > 99_999_999.99 || !/^\d{1,8}(\.\d{1,2})?$/.test(String(a))) c.fail("amount", "INVALID_AMOUNT");
    else amount = String(a);
  }
  const currency = c.oneOf("currency", ["PEN", "USD"] as const) ?? (amount !== null ? "PEN" : null);
  const fiveYearsAgo = `${Number(today.slice(0, 4)) - 5}${today.slice(4)}`;
  const cmd = {
    kind, consumerName: c.str("consumerName", { required: true, min: 2, max: 160 }), documentType, documentNumber,
    email: c.email("email"), phone: c.phone("phone"), address: c.str("address", { required: true, min: 5, max: 300 }), minor, guardian,
    goodType: goodType ?? null, goodDescription: c.str("goodDescription", { required: true, min: 5, max: 1000, multiline: true }),
    amount, currency: amount !== null ? currency : null, serviceLocation: c.str("serviceLocation", { max: 200 }),
    incidentDate: c.date("incidentDate", { required: true, min: fiveYearsAgo, max: today }), relatedReference: c.str("relatedReference", { max: 60 }),
    facts: c.str("facts", { required: true, min: 20, max: 4000, multiline: true }), consumerRequest: c.str("consumerRequest", { required: true, min: 5, max: 2000, multiline: true }),
    responseChannel: c.oneOf("responseChannel", ["EMAIL", "POSTAL_ADDRESS"] as const, { required: true }),
    privacyNoticeVersion: c.str("privacyNoticeVersion", { required: true, max: 20 }),
  };
  c.bool("acceptPrivacyNotice", { mustBeTrue: true });
  c.honeypot();
  c.done();
  await PUBLIC_FORM(request);
  const row = await db().begin(async (tx) => {
    const idem = await reserveIdempotency(tx, "complaint", idemKey(request), cmd);
    if (idem.replayFolio) {
      const [r] = await tx<{ folio: string; kind: string; status: string; filed_at: Date; response_due_on: string }[]>`
        select folio, kind, status, filed_at, response_due_on::text from app.complaints where folio = ${idem.replayFolio}`;
      return r;
    }
    const id = randomUUID();
    const folio = await nextFolio(tx, "REC");
    const due = addBusinessDays(limaDate(), RESPONSE_BUSINESS_DAYS);
    const [r] = await tx<{ folio: string; kind: string; status: string; filed_at: Date; response_due_on: string }[]>`
      insert into app.complaints (id, folio, kind, consumer_name, document_type, document_number, email, phone, address, is_minor,
        guardian_name, guardian_document_type, guardian_document_number, good_type, good_description, claimed_amount, claimed_currency,
        service_location, incident_date, related_reference, facts, consumer_request, response_channel, privacy_notice_version, status,
        filed_at, response_due_on, updated_at)
      values (${id}, ${folio}, ${cmd.kind}, ${cmd.consumerName}, ${cmd.documentType}, ${cmd.documentNumber}, ${cmd.email}, ${cmd.phone}, ${cmd.address}, ${cmd.minor && !!guardian},
        ${guardian?.name ?? null}, ${guardian?.type ?? null}, ${guardian?.number ?? null}, ${cmd.goodType}, ${cmd.goodDescription}, ${cmd.amount}, ${cmd.currency},
        ${cmd.serviceLocation}, ${cmd.incidentDate}, ${cmd.relatedReference}, ${cmd.facts}, ${cmd.consumerRequest}, ${cmd.responseChannel}, ${cmd.privacyNoticeVersion}, 'FILED',
        now(), ${due}, now())
      returning folio, kind, status, filed_at, response_due_on::text`;
    await tx`insert into app.complaint_events (id, complaint_id, event_type, occurred_at) values (${randomUUID()}, ${id}, 'FILED', now())`;
    await audit(tx, null, "COMPLAINT_FILED", "COMPLAINT", id, { folio });
    const tipo = cmd.kind === "CLAIM" ? "reclamo" : "queja";
    await enqueueMail(tx, {
      dedupeKey: `COMPLAINT_RECEIPT:${folio}:${cmd.email}`, template: "COMPLAINT_RECEIPT", to: cmd.email!, reference: folio,
      subject: `FUNDIGSAC: constancia de su ${tipo} ${folio}`,
      text: `Estimado(a) ${cmd.consumerName}:\n\nRegistramos su ${tipo} en nuestro Libro de Reclamaciones con la hoja N.° ${folio} el ${fechaLarga(r.filed_at)}. Le responderemos a más tardar el ${r.response_due_on}, por el medio que eligió.\n\nResumen de lo presentado:\n${cmd.facts}\n\nPedido: ${cmd.consumerRequest}${FIRMA}`,
    });
    const legal = inbox("LEGAL_INBOX");
    if (legal)
      await enqueueMail(tx, {
        dedupeKey: `COMPLAINT_LEGAL:${folio}:${legal}`, template: "COMPLAINT_LEGAL", to: legal, reference: folio,
        subject: `Libro de Reclamaciones: nueva hoja ${folio}`,
        text: `Tipo: ${tipo}\nFecha límite de respuesta: ${r.response_due_on}\n\nAtiéndala en el panel: ${process.env.ADMIN_URL ?? "https://fundigsac-admin.vercel.app"}/reclamaciones`,
      });
    await idem.finish(folio);
    return r;
  });
  return json(
    { folio: row.folio, kind: row.kind, status: row.status, filedAt: row.filed_at.toISOString(), responseDueOn: row.response_due_on, receiptToken: receiptToken("complaint", row.folio) },
    201,
    { Location: `/api/v1/complaints/${row.folio}/receipt` },
  );
};

// ---------------------------------------------------------------- Privacidad

const TYPE_LABEL: Record<string, string> = { ACCESS: "acceso", RECTIFICATION: "rectificación", CANCELLATION: "cancelación", OPPOSITION: "oposición", ACCOUNT_DELETION: "eliminación de cuenta y datos" };

const privacyRequest: Route = async (request) => {
  const body = await readJson(request);
  const c = new Check(body).allow(["type", "fullName", "email", "documentType", "documentNumber", "details", "acceptPrivacyNotice", "website"]);
  const documentType = c.oneOf("documentType", ["DNI", "CE", "PASSPORT", "RUC"] as const);
  const docRaw = c.str("documentNumber", { max: 12 });
  let documentNumber: string | null = null;
  if (documentType) {
    if (!docRaw) c.fail("documentNumber", "REQUIRED");
    else if (!(documentNumber = normDocument(documentType, docRaw))) c.fail("documentNumber", "INVALID_DOCUMENT");
  }
  const cmd = {
    type: c.oneOf("type", ["ACCESS", "RECTIFICATION", "CANCELLATION", "OPPOSITION", "ACCOUNT_DELETION"] as const, { required: true }),
    fullName: c.str("fullName", { required: true, min: 2, max: 160 }),
    email: c.email("email"),
    documentType: documentNumber ? documentType : null,
    documentNumber,
    details: c.str("details", { required: true, min: 10, max: 4000, multiline: true }),
  };
  c.bool("acceptPrivacyNotice", { mustBeTrue: true });
  c.honeypot();
  c.done();
  await PUBLIC_FORM(request);
  const r = await db().begin(async (tx) => {
    const idem = await reserveIdempotency(tx, "privacy-request", idemKey(request), cmd);
    if (idem.replayFolio) {
      const [x] = await tx<{ folio: string; status: string; received_at: Date }[]>`select folio, status, received_at from app.data_subject_requests where folio = ${idem.replayFolio}`;
      return x;
    }
    const id = randomUUID();
    const folio = await nextFolio(tx, "ARC");
    const [x] = await tx<{ folio: string; status: string; received_at: Date }[]>`
      insert into app.data_subject_requests (id, folio, request_type, full_name, email, document_type, document_number, details, status, received_at, updated_at)
      values (${id}, ${folio}, ${cmd.type}, ${cmd.fullName}, ${cmd.email}, ${cmd.documentType}, ${cmd.documentNumber}, ${cmd.details}, 'RECEIVED', now(), now())
      returning folio, status, received_at`;
    await audit(tx, null, "DSR_RECEIVED", "DATA_SUBJECT_REQUEST", id, { folio });
    await enqueueMail(tx, {
      dedupeKey: `RIGHTS_RECEIPT:${folio}:${cmd.email}`, template: "RIGHTS_RECEIPT", to: cmd.email!, reference: folio,
      subject: `FUNDIGSAC: recibimos su solicitud de datos personales ${folio}`,
      text: `Estimado(a) ${cmd.fullName}:\n\nRegistramos su solicitud de ${TYPE_LABEL[cmd.type!]} con el folio ${folio} el ${fechaLarga(x.received_at)}. Le responderemos dentro del plazo que fija la Ley N.° 29733 y su reglamento.${FIRMA}`,
    });
    const privacy = inbox("PRIVACY_INBOX");
    if (privacy)
      await enqueueMail(tx, {
        dedupeKey: `RIGHTS_PRIVACY:${folio}:${privacy}`, template: "RIGHTS_PRIVACY", to: privacy, reference: folio,
        subject: `Nueva solicitud de derechos del titular ${folio}`,
        text: `Tipo: ${TYPE_LABEL[cmd.type!]}\n\nAtiéndala en el panel: ${process.env.ADMIN_URL ?? "https://fundigsac-admin.vercel.app"}/privacidad`,
      });
    await idem.finish(folio);
    return x;
  });
  return json({ folio: r.folio, status: r.status, receivedAt: r.received_at.toISOString() }, 201, { Location: `/api/v1/privacy/requests/${r.folio}` });
};

const recordConsent: Route = async (request) => {
  const body = await readJson(request, 4096);
  const c = new Check(body).allow(["consentId", "choices", "policyVersion", "source"]);
  let consentId: string = randomUUID();
  if (body.consentId !== undefined && body.consentId !== null) {
    if (typeof body.consentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.consentId)) c.fail("consentId", "INVALID_VALUE");
    else consentId = body.consentId.toLowerCase();
  }
  const choices = asObject(body.choices);
  if (!choices) c.fail("choices", "REQUIRED");
  else if (Object.keys(choices).sort().join(",") !== "necessary,thirdParty" || typeof choices.necessary !== "boolean" || typeof choices.thirdParty !== "boolean") c.fail("choices", "INVALID_CHOICES");
  else if (choices.necessary !== true) c.fail("choices.necessary", "MUST_BE_TRUE");
  const policyVersion = c.str("policyVersion", { required: true, max: 20, pattern: /^[0-9A-Za-z._-]{1,20}$/ });
  const source = c.oneOf("source", ["BANNER", "PREFERENCES", "POLICY", "EMBED"] as const, { required: true });
  c.done();
  await rateLimit(`consent:${clientIp(request)}`, 30, 60);
  const [r] = await db()<{ recorded_at: Date }[]>`
    insert into app.consent_records (id, consent_id, choices, policy_version, source, recorded_at)
    values (${randomUUID()}, ${consentId}, ${db().json(choices as never)}, ${policyVersion}, ${source}, now()) returning recorded_at`;
  return json({ consentId, policyVersion, recordedAt: r.recorded_at.toISOString() }, 201);
};

export const formRoutes: Record<string, Route> = {
  "POST /quotes": submitQuote,
  "GET /quotes/:folio/receipt": quoteReceipt,
  "POST /inquiries": submitInquiry,
  "POST /complaints": fileComplaint,
  "POST /privacy/requests": privacyRequest,
  "POST /privacy/consents": recordConsent,
};

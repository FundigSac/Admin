import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { call, sql } from "./helpers.mjs";

// Datos claramente ficticios. RUC 20100070970 cumple el dígito verificador (validación, no una empresa usada como cliente).
const RUC = "20100070970";
before(() => sql`delete from app.rate_limits`);
after(() => sql.end());

const quote = (extra = {}) => ({
  origin: "GENERAL_FORM",
  contact: { companyName: "Empresa Ficticia QA", ruc: RUC, contactName: "Persona Ficticia", email: "qa.cliente@example.test", phone: "+51 999 000 111" },
  project: { deliveryDepartment: "Lima", message: "Necesito una cotización de prueba sintética." },
  items: [{ productSlug: "valvula-compuerta-qa", productName: "Válvula QA", variantLabel: "DN 100", quantity: 3, unit: "und" }],
  privacyNoticeVersion: "2026-10",
  acceptPrivacyNotice: true,
  ...extra,
});

test("cotización: 201 con folio COT, constancia con token y no sin él", async () => {
  const r = await call("POST", "/quotes", quote());
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.match(r.json.folio, /^COT-2026-\d{6}$/);
  const ok = await call("GET", `/quotes/${r.json.folio}/receipt`, undefined, null, { "X-Receipt-Token": r.json.receiptToken });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.items[0].unit, "und");
  assert.equal(ok.json.items[0].quantity, 3);
  assert.match(ok.json.email, /^q\*\*\*@example\.test$/);
  const no = await call("GET", `/quotes/${r.json.folio}/receipt`, undefined, null, { "X-Receipt-Token": "x".repeat(43) });
  assert.equal(no.status, 404);
});

test("cotización idempotente: misma clave, mismo folio; otro cuerpo, 409", async () => {
  await sql`delete from app.rate_limits`;
  const h = { "Idempotency-Key": "qa-idem-" + Date.now() };
  const a = await call("POST", "/quotes", quote(), null, h);
  const b = await call("POST", "/quotes", quote(), null, h);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.json.folio, b.json.folio);
  const c = await call("POST", "/quotes", quote({ items: [] , project: { message: "Otro cuerpo distinto para la misma clave." } }), null, h);
  assert.equal(c.status, 409);
  assert.equal(c.json.code, "IDEMPOTENCY_KEY_REUSED");
});

test("cotización: validaciones del contrato", async () => {
  await sql`delete from app.rate_limits`;
  const bad = await call("POST", "/quotes", quote({ contact: { companyName: "X", ruc: "20100070971", contactName: "P", email: "no", phone: "abc" }, extra: 1 }));
  assert.equal(bad.status, 400);
  const codes = bad.json.errors.map((e) => `${e.field}:${e.code}`);
  for (const want of ["extra:UNKNOWN_FIELD", "contact.ruc:INVALID_RUC", "contact.email:INVALID_EMAIL", "contact.phone:INVALID_PHONE", "contact.companyName:INVALID_LENGTH"]) assert.ok(codes.includes(want), want + " en " + codes);
  const empty = await call("POST", "/quotes", quote({ items: [], project: { message: "corto" } }));
  assert.equal(empty.status, 422);
  assert.equal(empty.json.code, "EMPTY_QUOTE");
  const trap = await call("POST", "/quotes", quote({ website: "http://spam" }));
  assert.equal(trap.status, 400);
});

test("límite de frecuencia: el 6.º envío en 10 minutos responde 429 con Retry-After", async () => {
  await sql`delete from app.rate_limits`;
  let last;
  for (let i = 0; i < 6; i++) last = await call("POST", "/inquiries", { fullName: "Persona QA", companyName: "Empresa QA", email: "qa.c@example.test", phone: "999000111", message: "Consulta sintética de prueba", privacyNoticeVersion: "2026-10", acceptPrivacyNotice: true });
  assert.equal(last.status, 429);
  assert.equal(last.headers.get("retry-after"), "600");
});

test("Libro de Reclamaciones: hoja REC con plazo de 15 días hábiles e historial FILED", async () => {
  await sql`delete from app.rate_limits`;
  const r = await call("POST", "/complaints", {
    kind: "CLAIM", consumerName: "Consumidor Ficticio", documentType: "DNI", documentNumber: "12.345.678", email: "qa.reclamo@example.test",
    phone: "999 000 222", address: "Av. Ficticia 123, Lima", minor: false, goodType: "PRODUCT", goodDescription: "Producto de prueba",
    claimedAmount: 120.5, incidentDate: "2026-11-02", facts: "Hechos sintéticos para la prueba automática.", consumerRequest: "Pedido de prueba",
    responseChannel: "EMAIL", privacyNoticeVersion: "2026-10", acceptPrivacyNotice: true,
  }, null, { "Idempotency-Key": "qa-rec-" + Date.now() });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.match(r.json.folio, /^REC-2026-\d{6}$/);
  const [row] = await sql`select document_number, claimed_currency, response_due_on::text d, filed_at from app.complaints where folio = ${r.json.folio}`;
  assert.equal(row.document_number, "12345678");
  assert.equal(row.claimed_currency, "PEN");
  assert.equal(r.json.responseDueOn, row.d);
  // Lo presentado no se puede reescribir (trigger de la base).
  await assert.rejects(sql`update app.complaints set facts = 'cambiado por la prueba de integridad' where folio = ${r.json.folio}`);
  const [mail] = await sql`select template, status from app.email_outbox where reference = ${r.json.folio}`;
  assert.equal(mail.template, "COMPLAINT_RECEIPT");
});

test("reclamo sin tipo de bien y menor sin apoderado: 400", async () => {
  await sql`delete from app.rate_limits`;
  const r = await call("POST", "/complaints", {
    kind: "CLAIM", consumerName: "Consumidor Ficticio", documentType: "DNI", documentNumber: "1234", email: "qa.r@example.test", phone: "999000222",
    address: "Av. Ficticia 123", minor: true, goodDescription: "Algo", incidentDate: "2030-01-01", facts: "corto", consumerRequest: "x",
    responseChannel: "EMAIL", privacyNoticeVersion: "2026-10", acceptPrivacyNotice: false,
  });
  assert.equal(r.status, 400);
  const fields = r.json.errors.map((e) => e.field);
  for (const f of ["documentNumber", "guardian", "goodType", "incidentDate", "facts", "acceptPrivacyNotice"]) assert.ok(fields.includes(f), f + " en " + fields);
});

test("privacidad y consentimiento", async () => {
  await sql`delete from app.rate_limits`;
  const p = await call("POST", "/privacy/requests", { type: "ACCOUNT_DELETION", fullName: "Titular Ficticio", email: "qa.arco@example.test", details: "Solicitud sintética de prueba.", acceptPrivacyNotice: true });
  assert.equal(p.status, 201);
  assert.match(p.json.folio, /^ARC-2026-\d{6}$/);
  const extra = await call("POST", "/privacy/requests", { type: "ACCESS", fullName: "T", email: "qa@example.test", details: "x", acceptPrivacyNotice: true, privacyNoticeVersion: "2026-10" });
  assert.ok(extra.json.errors.some((e) => e.code === "UNKNOWN_FIELD"));
  const c = await call("POST", "/privacy/consents", { choices: { necessary: true, thirdParty: false }, policyVersion: "2026-10", source: "BANNER" });
  assert.equal(c.status, 201);
  const bad = await call("POST", "/privacy/consents", { choices: { necessary: false, thirdParty: false }, policyVersion: "2026-10", source: "BANNER" });
  assert.equal(bad.status, 400);
});

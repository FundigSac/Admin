import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { call, sql, staffLogin } from "./helpers.mjs";

const ADMIN = { id: "00000000-0000-4000-8000-0000000000a1", email: "qa.staff@example.test" };
const SALES = { id: "00000000-0000-4000-8000-0000000000a2", email: "qa.ventas@example.test" };
let admin, sales;

before(async () => {
  await sql`delete from app.rate_limits`;
  await sql`insert into app.user_accounts (id, kind, email, full_name, status, created_at, updated_at) values (${SALES.id}, 'STAFF', ${SALES.email}, 'QA Ventas Sintética', 'ACTIVE', now(), now()) on conflict (id) do nothing`;
  await sql`insert into app.user_roles values (${SALES.id}, 'SALES') on conflict do nothing`;
  admin = (await staffLogin(ADMIN.email, ADMIN.id)).accessToken;
  sales = (await staffLogin(SALES.email, SALES.id)).accessToken;
});
after(() => sql.end());

const ifm = (v) => ({ "If-Match": `"${v}"` });

test("ventas no puede ver reclamaciones (403) ni el personal sin sesión (401)", async () => {
  assert.equal((await call("GET", "/staff/complaints", undefined, sales)).status, 403);
  assert.equal((await call("GET", "/staff/complaints")).status, 401);
  assert.equal((await call("GET", "/staff/quotes?size=101", undefined, sales)).status, 400);
});

test("cotización: listar, asignar con If-Match, versión vieja 412, transición inválida 409, cancelar exige motivo", async () => {
  const list = await call("GET", "/staff/quotes?page=0&size=100", undefined, sales);
  assert.equal(list.status, 200);
  const item = list.json.items.find((q) => q.status === "RECEIVED");
  assert.ok(item, "hay una cotización sintética RECEIVED");
  const d = await call("GET", `/staff/quotes/${item.id}`, undefined, sales);
  assert.equal(d.headers.get("etag"), `"${d.json.version}"`);
  assert.equal((await call("POST", `/staff/quotes/${item.id}/assign`, { assigneeId: SALES.id }, sales)).status, 428);
  const a = await call("POST", `/staff/quotes/${item.id}/assign`, { assigneeId: SALES.id }, sales, ifm(d.json.version));
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.equal(a.json.status, "ASSIGNED");
  assert.equal(a.json.history.at(-1).note, "Asignada");
  assert.equal((await call("POST", `/staff/quotes/${item.id}/status`, { status: "IN_REVIEW" }, sales, ifm(d.json.version))).status, 412);
  assert.equal((await call("POST", `/staff/quotes/${item.id}/status`, { status: "CLOSED" }, sales, ifm(a.json.version))).status, 409);
  const noReason = await call("POST", `/staff/quotes/${item.id}/status`, { status: "CANCELLED" }, sales, ifm(a.json.version));
  assert.equal(noReason.status, 422);
  assert.equal(noReason.json.code, "REASON_REQUIRED");
  const rev = await call("POST", `/staff/quotes/${item.id}/status`, { status: "IN_REVIEW", note: "Revisando" }, sales, ifm(a.json.version));
  assert.equal(rev.status, 200);
  // Asignar a alguien sin permiso de cotizaciones (inexistente) ⇒ INVALID_ASSIGNEE.
  const bad = await call("POST", `/staff/quotes/${item.id}/assign`, { assigneeId: "00000000-0000-4000-8000-0000000000ff" }, sales, ifm(rev.json.version));
  assert.equal(bad.json.errors[0].code, "INVALID_ASSIGNEE");
});

test("reclamación: asignar, nota, responder una sola vez; la respuesta queda inmutable", async () => {
  const list = await call("GET", "/staff/complaints?size=100", undefined, admin);
  const item = list.json.items.find((c) => c.status === "FILED");
  assert.ok(item);
  let s = (await call("GET", `/staff/complaints/${item.id}`, undefined, admin)).json;
  s = (await call("POST", `/staff/complaints/${item.id}/assign`, { assigneeId: ADMIN.id }, admin, ifm(s.version))).json;
  assert.equal(s.status, "IN_REVIEW");
  s = (await call("POST", `/staff/complaints/${item.id}/notes`, { note: "Nota interna sintética" }, admin, ifm(s.version))).json;
  assert.equal(s.history.at(-1).type, "NOTE");
  const ans = await call("POST", `/staff/complaints/${item.id}/answer`, { response: "Respuesta sintética de prueba con más de veinte caracteres." }, admin, ifm(s.version));
  assert.equal(ans.status, 200);
  assert.equal(ans.json.status, "ANSWERED");
  const again = await call("POST", `/staff/complaints/${item.id}/answer`, { response: "Otra respuesta sintética de prueba, no debe guardarse." }, admin, ifm(ans.json.version));
  assert.equal(again.status, 409);
  assert.equal(again.json.code, "ALREADY_ANSWERED");
  const [m] = await sql`select template from app.email_outbox where template = 'COMPLAINT_ANSWER' and reference = ${item.folio}`;
  assert.ok(m);
});

test("privacidad: iniciar y concluir; no se concluye dos veces", async () => {
  const list = await call("GET", "/staff/privacy/requests?size=100", undefined, admin);
  const item = list.json.items.find((r) => r.status === "RECEIVED");
  assert.ok(item);
  const st = await call("POST", `/staff/privacy/requests/${item.id}/start`, {}, admin, ifm(item.version));
  assert.equal(st.json.status, "IN_PROGRESS");
  const done = await call("POST", `/staff/privacy/requests/${item.id}/conclude`, { accepted: true, resolutionNote: "Atendida en prueba sintética." }, admin, ifm(st.json.version));
  assert.equal(done.json.status, "RESOLVED");
  assert.equal((await call("POST", `/staff/privacy/requests/${item.id}/conclude`, { accepted: true, resolutionNote: "Otra vez sintética." }, admin, ifm(done.json.version))).status, 409);
});

test("consulta: responder con nota encola el correo de respuesta", async () => {
  const list = await call("GET", "/staff/inquiries?size=100", undefined, sales);
  const item = list.json.items.find((r) => r.status === "RECEIVED");
  assert.ok(item);
  const d = (await call("GET", `/staff/inquiries/${item.id}`, undefined, sales)).json;
  const r = await call("POST", `/staff/inquiries/${item.id}/status`, { status: "ANSWERED", note: "Respuesta sintética" }, sales, ifm(d.version));
  assert.equal(r.status, 200);
  const [m] = await sql`select 1 from app.email_outbox where template = 'INQUIRY_ANSWER' and reference = ${item.folio}`;
  assert.ok(m);
});

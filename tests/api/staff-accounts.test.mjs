import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { call, sql, staffLogin } from "./helpers.mjs";

const ADMIN = { id: "00000000-0000-4000-8000-0000000000a1", email: "qa.staff@example.test" };
let admin;
before(async () => {
  await sql`delete from app.rate_limits`;
  admin = (await staffLogin(ADMIN.email, ADMIN.id)).accessToken;
});
after(() => sql.end());
const ifm = (v) => ({ "If-Match": `"${v}"` });

test("directorio, ficha con ETag, estadísticas y actividad", async () => {
  const l = await call("GET", "/staff/accounts?kind=STAFF&sort=name&desc=false&size=50", undefined, admin);
  assert.equal(l.status, 200, JSON.stringify(l.json));
  assert.ok(l.json.items.some((u) => u.email === ADMIN.email));
  assert.equal(typeof l.json.statusCounts.all, "number");
  assert.equal((await call("GET", "/staff/accounts?range=1y", undefined, admin)).json.errors[0].code, "INVALID_FILTER");
  const search = await call("GET", "/staff/accounts?q=sintetica", undefined, admin);
  assert.ok(search.json.items.some((u) => u.email === ADMIN.email), "busca sin tildes");
  const one = await call("GET", `/staff/accounts/${ADMIN.id}`, undefined, admin);
  assert.equal(one.headers.get("etag"), `"${one.json.version}"`);
  const s = await call("GET", "/staff/accounts/stats?range=30d", undefined, admin);
  assert.equal(s.status, 200, JSON.stringify(s.json));
  assert.equal(s.json.series.length, 30);
  const a = await call("GET", "/staff/accounts/activity?type=LOGIN", undefined, admin);
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.ok(a.json.items.length > 0);
});

test("invitar personal, cambiar roles, notas, desactivar, reactivar y eliminar", async () => {
  await sql`delete from app.user_roles where user_id in (select id from app.user_accounts where email = 'qa.invitado@example.test')`;
  await sql`update app.user_accounts set email = 'old-' || id || '@example.test', status = 'DELETED' where email = 'qa.invitado@example.test'`;
  const inv = await call("POST", "/staff/users", { email: "qa.invitado@example.test", fullName: "Invitado Sintético", roles: ["READ_ONLY"] }, admin);
  assert.equal(inv.status, 201, JSON.stringify(inv.json));
  assert.equal(inv.json.status, "PENDING_VERIFICATION");
  assert.equal((await call("POST", "/staff/users", { email: "qa.invitado@example.test", fullName: "Otra vez", roles: ["READ_ONLY"] }, admin)).json.code, "EMAIL_IN_USE");
  assert.equal((await call("POST", "/staff/users", { email: "x@example.test", fullName: "Cliente", roles: ["CUSTOMER"] }, admin)).json.errors[0].code, "INVALID_ROLE");
  const id = inv.json.id;
  const roles = await call("PUT", `/staff/users/${id}/roles`, { roles: ["SALES", "LEGAL_SUPPORT"] }, admin, ifm(inv.json.version));
  assert.equal(roles.status, 200);
  assert.deepEqual(roles.json.roles, ["LEGAL_SUPPORT", "SALES"]);
  assert.ok(roles.json.permissions.includes("complaint:manage"));
  const notes = await call("PUT", `/staff/accounts/${id}/notes`, { notes: "Nota sintética" }, admin);
  assert.equal(notes.json.notes, "Nota sintética");
  const dis = await call("POST", `/staff/accounts/${id}/disable`, {}, admin, ifm(roles.json.version));
  assert.equal(dis.json.status, "DISABLED");
  assert.equal((await call("POST", `/staff/accounts/${id}/disable`, {}, admin, ifm(dis.json.version))).json.code, "ALREADY_DISABLED");
  const en = await call("POST", `/staff/accounts/${id}/enable`, {}, admin, ifm(dis.json.version));
  assert.equal(en.json.status, "PENDING_VERIFICATION");
  assert.equal((await call("DELETE", `/staff/accounts/${id}`, undefined, admin, ifm(en.json.version))).status, 204);
  assert.equal((await call("GET", `/staff/accounts/${id}`, undefined, admin)).status, 404);
  const [row] = await sql`select email, full_name from app.user_accounts where id = ${id}`;
  assert.match(row.email, /@cuentas-eliminadas\.invalid$/);
});

test("reglas de administración: no desactivarse, no quitarse el rol de administrador", async () => {
  const me = (await call("GET", `/staff/accounts/${ADMIN.id}`, undefined, admin)).json;
  assert.equal((await call("POST", `/staff/accounts/${ADMIN.id}/disable`, {}, admin, ifm(me.version))).json.code, "CANNOT_DISABLE_SELF");
  assert.equal((await call("PUT", `/staff/users/${ADMIN.id}/roles`, { roles: ["SALES"] }, admin, ifm(me.version))).json.code, "CANNOT_DEMOTE_SELF");
  assert.equal((await call("DELETE", `/staff/accounts/${ADMIN.id}`, undefined, admin, ifm(me.version))).json.code, "CANNOT_DELETE_SELF");
});

test("el cambio de roles invalida el token anterior (sello de seguridad)", async () => {
  const SALES = { id: "00000000-0000-4000-8000-0000000000a2", email: "qa.ventas@example.test" };
  const t = (await staffLogin(SALES.email, SALES.id)).accessToken;
  assert.equal((await call("GET", "/staff/profile", undefined, t)).status, 200);
  const cur = (await call("GET", `/staff/accounts/${SALES.id}`, undefined, admin)).json;
  await call("PUT", `/staff/users/${SALES.id}/roles`, { roles: ["SALES"] }, admin, ifm(cur.version));
  assert.equal((await call("GET", "/staff/profile", undefined, t)).status, 401);
});

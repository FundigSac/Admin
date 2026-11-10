import { test, after } from "node:test";
import assert from "node:assert/strict";
import { call, forceCode, sql, staffLogin } from "./helpers.mjs";

const QA = { id: "00000000-0000-4000-8000-0000000000a1", email: "qa.staff@example.test" };
after(() => sql.end());

test("pedir código responde 202 igual exista o no la cuenta", async () => {
  await sql`delete from app.rate_limits where bucket like '%nadie@example.test'`;
  const a = await call("POST", "/auth/staff/code", { email: "nadie@example.test" });
  assert.equal(a.status, 202);
  assert.deepEqual(Object.keys(a.json).sort(), ["expiresInSeconds", "message", "resendAfterSeconds"]);
});

test("código incorrecto: INVALID_CODE y descuenta intento; correcto abre sesión", async () => {
  await sql`delete from app.staff_login_codes where user_id = ${QA.id}`;
  await sql`delete from app.rate_limits where bucket like ${"%" + QA.email}`;
  assert.equal((await call("POST", "/auth/staff/code", { email: QA.email })).status, 202);
  await forceCode(QA.id, "654321");
  const bad = await call("POST", "/auth/staff/code/verify", { email: QA.email, code: "000000" });
  assert.equal(bad.status, 401);
  assert.equal(bad.json.code, "INVALID_CODE");
  const [c] = await sql`select attempts_left from app.staff_login_codes where user_id = ${QA.id} and used_at is null`;
  assert.equal(c.attempts_left, 4);
  const ok = await call("POST", "/auth/staff/code/verify", { email: QA.email, code: "654321" });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.tokenType, "Bearer");
  // El mismo código no sirve dos veces.
  const again = await call("POST", "/auth/staff/code/verify", { email: QA.email, code: "654321" });
  assert.equal(again.status, 401);
});

test("refresh rota y la reutilización revoca la familia", async () => {
  const t = await staffLogin(QA.email, QA.id);
  const r1 = await call("POST", "/auth/refresh", { refreshToken: t.refreshToken });
  assert.equal(r1.status, 200);
  const reuse = await call("POST", "/auth/refresh", { refreshToken: t.refreshToken });
  assert.equal(reuse.status, 401);
  const r2 = await call("POST", "/auth/refresh", { refreshToken: r1.json.refreshToken });
  assert.equal(r2.status, 401, "la familia quedó revocada");
});

test("sin token: 401; token alterado: 401", async () => {
  assert.equal((await call("GET", "/staff/profile")).status, 401);
  const t = await staffLogin(QA.email, QA.id);
  assert.equal((await call("GET", "/staff/profile", undefined, t.accessToken.slice(0, -2) + "xx")).status, 401);
});

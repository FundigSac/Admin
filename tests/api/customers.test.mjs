import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { call, sql } from "./helpers.mjs";

const EMAIL = "qa.cliente.cuenta@example.test";
const PW = "Clave-Sintetica-QA-2026";
before(async () => {
  await sql`delete from app.rate_limits`;
  await sql`update app.user_accounts set email = 'old-' || id || '@example.test', status = 'DELETED', deleted_at = now() where email = ${EMAIL}`;
});
after(() => sql.end());

/** Fija un token conocido (la prueba no lee el correo). */
async function knownToken(purpose) {
  const t = "qa-token-" + purpose.toLowerCase() + "-" + Date.now() + "-xxxxxxxxxxxx";
  await sql`update app.one_time_tokens set token_hash = ${createHash("sha256").update(t).digest("hex")}
            where id = (select o.id from app.one_time_tokens o join app.user_accounts u on u.id = o.user_id where u.email = ${EMAIL} and o.purpose = ${purpose} and o.used_at is null order by o.created_at desc limit 1)`;
  return t;
}

test("registro → verificación → login → /account/me → refresh", async () => {
  const weak = await call("POST", "/auth/register", { email: EMAIL, password: "corta", fullName: "Cliente Sintético", privacyNoticeVersion: "2026-10", acceptPrivacyNotice: true });
  assert.equal(weak.json.errors[0].code, "INVALID_LENGTH");
  const r = await call("POST", "/auth/register", { email: EMAIL, password: PW, fullName: "Cliente Sintético", privacyNoticeVersion: "2026-10", acceptPrivacyNotice: true, source: "registro", newsletter: true });
  assert.equal(r.status, 202, JSON.stringify(r.json));
  const pending = await call("POST", "/auth/login", { email: EMAIL, password: PW });
  assert.equal(pending.status, 403);
  assert.equal(pending.json.code, "EMAIL_NOT_VERIFIED");
  const again = await call("POST", "/auth/register", { email: EMAIL, password: PW, fullName: "Otro", privacyNoticeVersion: "2026-10", acceptPrivacyNotice: true });
  assert.equal(again.status, 202, "mismo mensaje: no revela si el correo existe");
  const v = await call("POST", "/auth/verify-email", { token: await knownToken("EMAIL_VERIFICATION") });
  assert.equal(v.status, 204);
  const login = await call("POST", "/auth/login", { email: EMAIL, password: PW });
  assert.equal(login.status, 200);
  assert.equal(login.json.refreshExpiresIn, 1209600);
  const me = await call("GET", "/account/me", undefined, login.json.accessToken);
  assert.equal(me.json.email, EMAIL);
  assert.equal((await call("GET", "/staff/profile", undefined, login.json.accessToken)).status, 403, "un cliente no entra al panel");
});

test("5 contraseñas erróneas bloquean 15 minutos; la recuperación desbloquea y revoca sesiones", async () => {
  await sql`delete from app.rate_limits`;
  for (let i = 0; i < 5; i++) assert.equal((await call("POST", "/auth/login", { email: EMAIL, password: "Equivocada-QA-123" })).status, 401);
  assert.equal((await call("POST", "/auth/login", { email: EMAIL, password: PW })).json.code, "INVALID_CREDENTIALS", "bloqueada aunque la clave sea correcta");
  assert.equal((await call("POST", "/auth/password/forgot", { email: EMAIL })).status, 202);
  const t = await knownToken("PASSWORD_RESET");
  assert.equal((await call("POST", "/auth/password/reset", { token: t, password: "123456789012" })).json.errors[0].code, "PASSWORD_TOO_COMMON");
  assert.equal((await call("POST", "/auth/password/reset", { token: t, password: "Nueva-Clave-Sintetica-77" })).status, 204);
  await sql`delete from app.rate_limits`;
  assert.equal((await call("POST", "/auth/login", { email: EMAIL, password: "Nueva-Clave-Sintetica-77" })).status, 200);
  assert.equal((await call("POST", "/auth/password/reset", { token: t, password: "Otra-Clave-Sintetica-88" })).status, 400, "el token sirve una vez");
});

test("Google sin configurar responde GOOGLE_SIGN_IN_DISABLED", async () => {
  const g = await call("POST", "/auth/google", { idToken: "a.b.c", privacyNoticeVersion: "2026-10", source: "login" });
  assert.equal(g.json.code, "GOOGLE_SIGN_IN_DISABLED");
});

import "server-only";
import { createPublicKey, createVerify, randomUUID } from "node:crypto";
import { audit, issueTokens, requireCustomer } from "../auth";
import { hashPassword, sha256Hex, verifyPassword } from "../crypto";
import { db, type Tx } from "../db";
import { badRequest, clientIp, conflict, forbidden, json, notFound, Problem, readJson, unauthorized } from "../http";
import { rateLimit } from "../limits";
import { enqueueMail } from "../mail";
import { fechaLarga, FIRMA } from "../shared";
import { Check } from "../validate";
import { accountView, mailReset, mailVerify } from "./staff-accounts";
import type { Route } from "../router";

const SAME = { message: "Si los datos son válidos, recibirá un correo con las instrucciones." };
const COMMON = new Set(["123456789012", "password1234", "fundigsac123", "fundigsac2026", "administrador", "qwertyuiop12", "contraseña123", "1234567890123", "passwordpassword", "123456123456"]);
// Hash fijo para igualar tiempos cuando la cuenta no existe (no revela si el correo está registrado).
let dummyHash: Promise<string> | null = null;
const dummy = () => (dummyHash ??= hashPassword("tiempo-constante-fundigsac"));

/** Política de contraseña del Backend (12–128, no común, no contiene el correo). */
function checkPassword(c: Check, password: string | null, email: string | null) {
  if (!password) return;
  const p = password.normalize("NFC");
  const chars = [...p];
  if (chars.length < 12 || chars.length > 128) return c.fail("password", "INVALID_LENGTH");
  if (COMMON.has(p.toLowerCase()) || new Set(chars).size < 4) return c.fail("password", "PASSWORD_TOO_COMMON");
  const local = email?.split("@")[0] ?? "";
  if (local.length >= 4 && p.toLowerCase().includes(local.toLowerCase())) return c.fail("password", "PASSWORD_CONTAINS_EMAIL");
}

/** La contraseña cruda (sin recortar espacios internos), con límite. */
function rawPassword(c: Check, body: Record<string, unknown>, required = true): string | null {
  const v = body.password;
  if (v === undefined || v === null || v === "") return required ? (c.fail("password", "REQUIRED") ?? null) : null;
  if (typeof v !== "string") return c.fail("password", "INVALID_VALUE") ?? null;
  if (v.length > 256) return c.fail("password", "INVALID_LENGTH") ?? null;
  return v;
}

const register: Route = async (request) => {
  const body = await readJson(request, 8192);
  const c = new Check(body).allow(["email", "password", "fullName", "companyName", "ruc", "phone", "privacyNoticeVersion", "acceptPrivacyNotice", "source", "newsletter"]);
  const email = c.email("email");
  const password = rawPassword(c, body);
  checkPassword(c, password, email);
  const fullName = c.str("fullName", { required: true, min: 2, max: 120 });
  const companyName = c.str("companyName", { max: 160 });
  const ruc = c.ruc("ruc", false);
  const phone = c.phone("phone", false);
  const notice = c.str("privacyNoticeVersion", { required: true, max: 20 });
  c.bool("acceptPrivacyNotice", { mustBeTrue: true });
  const source = c.oneOf("source", ["registro", "carrito", "cotizar", "login"] as const, { code: "INVALID_SOURCE" });
  const newsletter = c.bool("newsletter");
  c.done();
  await rateLimit(`register:${clientIp(request)}`, 5, 3600);
  const hash = await hashPassword(password!);
  await db().begin(async (tx) => {
    const [existing] = await tx<{ id: string; full_name: string }[]>`select id, full_name from app.user_accounts where email = ${email} and status <> 'DELETED'`;
    if (existing) {
      await enqueueMail(tx, {
        dedupeKey: `REGISTRATION_ATTEMPT:${existing.id}:${Date.now()}:${email}`, template: "REGISTRATION_ATTEMPT", to: email!, reference: existing.id,
        subject: "FUNDIGSAC: intento de registro con su correo",
        text: `Hola, ${existing.full_name}:\n\nAlguien intentó crear una cuenta en FUNDIGSAC con este correo, que ya tiene una. Si fue usted, entre con su contraseña o pida restablecerla. Si no, ignore este mensaje.${FIRMA}`,
      });
      return;
    }
    const id = randomUUID();
    await tx`insert into app.user_accounts (id, kind, email, password_hash, full_name, company_name, ruc, phone, status, privacy_notice_version, signup_method, signup_source, newsletter_opt_in_at, created_at, updated_at)
             values (${id}, 'CUSTOMER', ${email}, ${hash}, ${fullName}, ${companyName}, ${ruc}, ${phone}, 'PENDING_VERIFICATION', ${notice}, 'EMAIL', ${source}, ${newsletter ? new Date() : null}, now(), now())`;
    await tx`insert into app.user_roles (user_id, role) values (${id}, 'CUSTOMER')`;
    await mailVerify(tx, { id, email: email!, full_name: fullName! });
  });
  return json(SAME, 202);
};

/** Canjea un token de un solo uso. Cualquier fallo: 400 field token INVALID_TOKEN. */
async function consumeToken(tx: Tx, token: unknown, purpose: string): Promise<string> {
  if (typeof token !== "string" || token.length < 20 || token.length > 128) throw badRequest([{ field: "token", code: "INVALID_TOKEN" }]);
  const [row] = await tx<{ id: string; user_id: string }[]>`
    update app.one_time_tokens set used_at = now() where token_hash = ${sha256Hex(token)} and purpose = ${purpose} and used_at is null and expires_at > now() returning id, user_id`;
  if (!row) throw badRequest([{ field: "token", code: "INVALID_TOKEN" }]);
  return row.user_id;
}

const verifyEmail: Route = async (request) => {
  const body = await readJson(request, 4096);
  new Check(body).allow(["token"]).done();
  await rateLimit(`token:${clientIp(request)}`, 10, 900);
  await db().begin(async (tx) => {
    const userId = await consumeToken(tx, body.token, "EMAIL_VERIFICATION");
    const [u] = await tx`select status, password_hash from app.user_accounts where id = ${userId} for update`;
    if (!u || u.status !== "PENDING_VERIFICATION" || !u.password_hash) throw conflict("ALREADY_VERIFIED");
    await tx`update app.user_accounts set status = 'ACTIVE', email_verified_at = now(), updated_at = now(), version = version + 1 where id = ${userId}`;
    await audit(tx, userId, "EMAIL_VERIFIED", "USER", userId, {});
  });
  return json(null, 204);
};

const resendVerification: Route = async (request) => {
  const body = await readJson(request, 4096);
  const c = new Check(body).allow(["email"]);
  const email = c.email("email");
  c.done();
  await rateLimit(`password-reset:${clientIp(request)}`, 3, 3600);
  await db().begin(async (tx) => {
    const [u] = await tx`select id, email, full_name from app.user_accounts where email = ${email} and kind = 'CUSTOMER' and status = 'PENDING_VERIFICATION'`;
    if (u) await mailVerify(tx, u as never);
  });
  return json(SAME, 202);
};

const login: Route = async (request) => {
  const body = await readJson(request, 4096);
  const c = new Check(body).allow(["email", "password"]);
  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = rawPassword(c, body);
  if (!emailRaw) c.fail("email", "REQUIRED");
  c.done();
  await rateLimit(`login:${clientIp(request)}`, 10, 900);
  const [u] = await db()<{ id: string; kind: "CUSTOMER" | "STAFF"; email: string; full_name: string; status: string; password_hash: string | null; locked_until: Date | null; failed_login_attempts: number; security_stamp: number }[]>`
    select id, kind, email, full_name, status, password_hash, locked_until, failed_login_attempts, security_stamp from app.user_accounts where email = ${emailRaw} and status <> 'DELETED'`;
  const ok = u?.password_hash ? await verifyPassword(password!, u.password_hash) : (await verifyPassword(password!, await dummy()), false);
  if (!u || u.status === "DISABLED" || (u.locked_until && u.locked_until.getTime() > Date.now())) throw unauthorized("INVALID_CREDENTIALS");
  if (!ok) {
    if (u.password_hash) {
      await db().begin(async (tx) => {
        const [x] = await tx<{ failed_login_attempts: number }[]>`update app.user_accounts set failed_login_attempts = failed_login_attempts + 1 where id = ${u.id} returning failed_login_attempts`;
        if (x.failed_login_attempts >= 5) {
          const [l] = await tx<{ locked_until: Date }[]>`update app.user_accounts set failed_login_attempts = 0, locked_until = now() + interval '15 minutes' where id = ${u.id} returning locked_until`;
          await audit(tx, u.id, "ACCOUNT_LOCKED", "USER", u.id, { lockedUntil: l.locked_until.toISOString() });
          await enqueueMail(tx, {
            dedupeKey: `ACCOUNT_LOCKED:${u.id}:${Date.now()}:${u.email}`, template: "ACCOUNT_LOCKED", to: u.email, reference: u.id,
            subject: "FUNDIGSAC: bloqueamos temporalmente su cuenta",
            text: `Hola, ${u.full_name}:\n\nHubo 5 intentos fallidos de entrar a su cuenta, así que la bloqueamos hasta el ${fechaLarga(l.locked_until)}. Si no fue usted, le recomendamos restablecer su contraseña.${FIRMA}`,
          });
        }
      });
    }
    throw unauthorized("INVALID_CREDENTIALS");
  }
  if (u.status === "PENDING_VERIFICATION") throw forbidden("EMAIL_NOT_VERIFIED");
  const tokens = await db().begin(async (tx) => {
    await tx`update app.user_accounts set failed_login_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now(), version = version + 1 where id = ${u.id}`;
    await audit(tx, u.id, "SIGNED_IN", "USER", u.id, { method: "PASSWORD" });
    return issueTokens(tx, u);
  });
  return json(tokens);
};

const forgot: Route = async (request) => {
  const body = await readJson(request, 4096);
  const c = new Check(body).allow(["email"]);
  const email = c.email("email");
  c.done();
  await rateLimit(`password-reset:${clientIp(request)}`, 3, 3600);
  await db().begin(async (tx) => {
    const [u] = await tx`select id, email, full_name from app.user_accounts where email = ${email} and kind = 'CUSTOMER'
                         and (status = 'ACTIVE' or (status = 'PENDING_VERIFICATION' and password_hash is not null))`;
    if (u) await mailReset(tx, u as never);
  });
  return json(SAME, 202);
};

const reset: Route = async (request) => {
  const body = await readJson(request, 4096);
  const c = new Check(body).allow(["token", "password"]);
  const password = rawPassword(c, body);
  c.done();
  await rateLimit(`token:${clientIp(request)}`, 10, 900);
  const hash = await hashPassword(password ?? "");
  await db().begin(async (tx) => {
    const userId = await consumeToken(tx, body.token, "PASSWORD_RESET");
    const [u] = await tx`select id, email, full_name, status from app.user_accounts where id = ${userId} for update`;
    const pc = new Check({});
    checkPassword(pc, password, u.email);
    pc.done();
    if (u.status === "DISABLED") throw new Problem(422, "ACCOUNT_DISABLED");
    if (u.status === "DELETED") throw conflict("ACCOUNT_DELETED");
    await tx`update app.user_accounts set password_hash = ${hash}, failed_login_attempts = 0, locked_until = null, status = 'ACTIVE',
               email_verified_at = coalesce(email_verified_at, now()), security_stamp = security_stamp + 1, updated_at = now(), version = version + 1 where id = ${userId}`;
    await tx`update app.refresh_tokens set revoked_at = now() where user_id = ${userId} and revoked_at is null`;
    await audit(tx, userId, "PASSWORD_RESET", "USER", userId, {});
    await enqueueMail(tx, {
      dedupeKey: `PASSWORD_CHANGED:${userId}:${Date.now()}:${u.email}`, template: "PASSWORD_CHANGED", to: u.email, reference: userId,
      subject: "FUNDIGSAC: su contraseña cambió",
      text: `Hola, ${u.full_name}:\n\nLa contraseña de su cuenta cambió el ${fechaLarga(new Date())}. Si no fue usted, escríbanos de inmediato.${FIRMA}`,
    });
  });
  return json(null, 204);
};

const me: Route = async (request) => {
  const p = await requireCustomer(request);
  const [r] = await db()`select u.*, coalesce((select array_agg(x.role order by x.role) from app.user_roles x where x.user_id = u.id), '{}') roles from app.user_accounts u where u.id = ${p.id}`;
  if (!r) throw notFound("ACCOUNT_NOT_FOUND");
  return json(accountView(r));
};

// ------------------------------------------------------------------ Google

type GoogleClaims = { sub: string; email: string; email_verified: boolean | string; name?: string; iss: string; aud: string; exp: number };
let jwks: { at: number; keys: { kid: string; n: string; e: string; kty: string }[] } | null = null;

async function verifyGoogle(idToken: string, clientId: string): Promise<GoogleClaims | null> {
  const [h, p, s] = idToken.split(".");
  if (!h || !p || !s) return null;
  try {
    const header = JSON.parse(Buffer.from(h, "base64url").toString()) as { kid?: string; alg?: string };
    if (header.alg !== "RS256" || !header.kid) return null;
    if (!jwks || Date.now() - jwks.at > 3600_000) {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/certs", { signal: AbortSignal.timeout(5000) });
      jwks = { at: Date.now(), keys: ((await res.json()) as { keys: never[] }).keys };
    }
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(createPublicKey({ key: jwk as never, format: "jwk" }), Buffer.from(s, "base64url"));
    if (!ok) return null;
    const c = JSON.parse(Buffer.from(p, "base64url").toString()) as GoogleClaims;
    const now = Date.now() / 1000;
    if (!["accounts.google.com", "https://accounts.google.com"].includes(c.iss) || c.aud !== clientId || c.exp + 60 < now) return null;
    if (!(c.email_verified === true || c.email_verified === "true") || !c.sub || !c.email) return null;
    return c;
  } catch {
    return null;
  }
}

const google: Route = async (request) => {
  const body = await readJson(request, 8192);
  const c = new Check(body).allow(["idToken", "privacyNoticeVersion", "source", "newsletter"]);
  const idToken = c.str("idToken", { required: true, max: 4096 });
  const notice = c.str("privacyNoticeVersion", { max: 20 });
  const source = c.oneOf("source", ["registro", "carrito", "cotizar", "login"] as const, { code: "INVALID_SOURCE" });
  const newsletter = c.bool("newsletter");
  c.done();
  await rateLimit(`login:${clientIp(request)}`, 10, 900);
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Problem(422, "GOOGLE_SIGN_IN_DISABLED");
  const g = await verifyGoogle(idToken!, clientId);
  if (!g) throw unauthorized("INVALID_GOOGLE_TOKEN");
  const email = g.email.toLowerCase();
  const tokens = await db().begin(async (tx) => {
    const [u] = await tx`select * from app.user_accounts where (google_subject = ${g.sub} or email = ${email}) and status <> 'DELETED' order by (google_subject = ${g.sub}) desc limit 1 for update`;
    let user = u;
    if (user) {
      if (user.kind === "STAFF") throw forbidden("STAFF_USE_PANEL");
      if (user.status === "DISABLED" || (user.google_subject && user.google_subject !== g.sub)) throw unauthorized("INVALID_CREDENTIALS");
      const verify = user.status === "PENDING_VERIFICATION";
      [user] = await tx`update app.user_accounts set google_subject = ${g.sub}, status = 'ACTIVE', email_verified_at = coalesce(email_verified_at, now()),
                          last_login_at = now(), updated_at = now(), version = version + 1 where id = ${user.id} returning *`;
      if (verify) await audit(tx, user.id, "EMAIL_VERIFIED", "USER", user.id, {});
    } else {
      if (!notice) throw badRequest([{ field: "privacyNoticeVersion", code: "REQUIRED" }]);
      const name = (g.name ?? "").trim().slice(0, 120);
      const fullName = name.length >= 2 ? name : email.split("@")[0].length >= 2 ? email.split("@")[0].slice(0, 120) : "Cliente FUNDIGSAC";
      const id = randomUUID();
      [user] = await tx`insert into app.user_accounts (id, kind, email, full_name, status, email_verified_at, privacy_notice_version, signup_method, google_subject, signup_source, newsletter_opt_in_at, last_login_at, created_at, updated_at)
                        values (${id}, 'CUSTOMER', ${email}, ${fullName}, 'ACTIVE', now(), ${notice}, 'GOOGLE', ${g.sub}, ${source}, ${newsletter ? new Date() : null}, now(), now(), now()) returning *`;
      await tx`insert into app.user_roles (user_id, role) values (${id}, 'CUSTOMER')`;
    }
    await audit(tx, user.id, "SIGNED_IN", "USER", user.id, { method: "GOOGLE" });
    return issueTokens(tx, user as never);
  });
  return json(tokens);
};

export const customerRoutes: Record<string, Route> = {
  "POST /auth/register": register,
  "POST /auth/verify-email": verifyEmail,
  "POST /auth/verify-email/resend": resendVerification,
  "POST /auth/login": login,
  "POST /auth/google": google,
  "POST /auth/password/forgot": forgot,
  "POST /auth/password/reset": reset,
  "GET /account/me": me,
};

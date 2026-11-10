import "server-only";
import { randomUUID } from "node:crypto";
import { audit, issueTokens, requireStaff, revokeRefresh, rotateRefresh } from "../auth";
import { loginCodeHash, sixDigitCode } from "../crypto";
import { db } from "../db";
import { badRequest, clientIp, json, readJson, unauthorized } from "../http";
import { rateLimit } from "../limits";
import { enqueueMail } from "../mail";
import type { Route } from "../router";

const CODE_TTL_SECONDS = 600;
const RESEND_SECONDS = 60;
const ATTEMPTS = 5;

const invalidCode = () => unauthorized("INVALID_CODE");
const normEmail = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const validEmail = (e: string) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

type StaffRow = { id: string; email: string; full_name: string; status: string; kind: "STAFF"; security_stamp: number };

/** Cuenta del personal que puede pedir código: activa o invitada que todavía no entró. */
async function findStaff(email: string): Promise<StaffRow | null> {
  if (!validEmail(email)) return null;
  const [row] = await db()<StaffRow[]>`
    select id, email, full_name, status, kind, security_stamp from app.user_accounts
     where email = ${email} and kind = 'STAFF' and status in ('ACTIVE', 'PENDING_VERIFICATION')`;
  return row ?? null;
}

/** POST /auth/staff/code — siempre 202 con el mismo cuerpo, exista o no la cuenta. */
const requestCode: Route = async (request) => {
  const body = await readJson(request, 4096);
  const email = normEmail(body.email);
  if (!email) throw badRequest([{ field: "email", code: "REQUIRED" }]);
  await rateLimit(`login-code:ip:${clientIp(request)}`, 10, 600);
  await rateLimit(`login-code:email:${email}`, 5, 600);
  const response = json({ message: "Si el correo pertenece al personal, recibirá un código de acceso.", expiresInSeconds: CODE_TTL_SECONDS, resendAfterSeconds: RESEND_SECONDS }, 202);
  const account = await findStaff(email);
  if (!account) return response;
  await db().begin(async (tx) => {
    const [latest] = await tx<{ created_at: Date }[]>`
      select created_at from app.staff_login_codes
       where user_id = ${account.id} and used_at is null and attempts_left > 0 and expires_at > now()
       order by created_at desc limit 1 for update`;
    if (latest && latest.created_at.getTime() + RESEND_SECONDS * 1000 > Date.now()) return;
    await tx`update app.staff_login_codes set used_at = now() where user_id = ${account.id} and used_at is null`;
    const code = sixDigitCode();
    await tx`insert into app.staff_login_codes (id, user_id, code_hash, created_at, expires_at, attempts_left)
             values (${randomUUID()}, ${account.id}, ${loginCodeHash(account.id, code)}, now(), now() + make_interval(secs => ${CODE_TTL_SECONDS}), ${ATTEMPTS})`;
    await enqueueMail(tx, {
      dedupeKey: `STAFF_LOGIN_CODE:${account.id}:${Date.now()}`,
      template: "STAFF_LOGIN_CODE",
      to: account.email,
      subject: `${code} es tu código para entrar al panel de FUNDIGSAC`,
      text: `Hola, ${account.full_name}:\n\nTu código para entrar al panel de FUNDIGSAC es ${code}.\nVence en 10 minutos y sirve una sola vez.\n\nSi no lo pediste, ignora este correo: nadie puede entrar sin el código.`,
      reference: account.id,
    });
  });
  return response;
};

/** POST /auth/staff/code/verify — cualquier fallo responde INVALID_CODE; tras 5 intentos el código deja de servir. */
const verifyCode: Route = async (request) => {
  const body = await readJson(request, 4096);
  const email = normEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  await rateLimit(`token:ip:${clientIp(request)}`, 30, 600);
  const account = await findStaff(email);
  if (!account) throw invalidCode();
  const result = await db().begin(async (tx) => {
    const [current] = await tx<{ id: string; code_hash: string; attempts_left: number }[]>`
      select id, code_hash, attempts_left from app.staff_login_codes
       where user_id = ${account.id} and used_at is null and attempts_left > 0 and expires_at > now()
       order by created_at desc limit 1 for update`;
    if (!current) return null;
    if (!/^\d{6}$/.test(code) || current.code_hash !== loginCodeHash(account.id, code)) {
      await tx`update app.staff_login_codes set attempts_left = attempts_left - 1 where id = ${current.id}`;
      return null;
    }
    await tx`update app.staff_login_codes set used_at = now() where id = ${current.id}`;
    const [user] = await tx<StaffRow[]>`
      update app.user_accounts set last_login_at = now(), updated_at = now(), version = version + 1,
             status = 'ACTIVE', email_verified_at = coalesce(email_verified_at, now())
       where id = ${account.id} returning id, email, full_name, status, kind, security_stamp`;
    await audit(tx, account.id, "SIGNED_IN", "USER", account.id, { method: "STAFF_CODE" });
    return issueTokens(tx, user);
  });
  if (!result) throw invalidCode();
  return json(result);
};

const refresh: Route = async (request) => {
  const body = await readJson(request, 4096);
  await rateLimit(`token:ip:${clientIp(request)}`, 60, 600);
  return json(await rotateRefresh(body.refreshToken));
};

const logout: Route = async (request) => {
  const body = await readJson(request, 4096);
  await revokeRefresh(body.refreshToken);
  return json(null, 204);
};

/** GET /staff/profile — quién es la persona del personal y qué puede hacer. */
const profile: Route = async (request) => {
  const p = await requireStaff(request);
  return json({ id: p.id, fullName: p.fullName, email: p.email, kind: p.kind, roles: p.roles, permissions: p.permissions });
};

export const staffAccessRoutes: Record<string, Route> = {
  "GET /staff/profile": profile,
  "POST /auth/staff/code": requestCode,
  "POST /auth/staff/code/verify": verifyCode,
  "POST /auth/refresh": refresh,
  "POST /auth/logout": logout,
};

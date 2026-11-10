// Utilidades de las pruebas de integración de la API. Usan la base configurada en .env.development.local y solo
// datos sintéticos (@example.test); cada prueba borra lo que crea.
import fs from "node:fs";
import { createHmac } from "node:crypto";
import postgres from "postgres";

export function env() {
  const out = {};
  for (const line of fs.readFileSync(new URL("../../.env.development.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}
export const E = env();
// Candado: desde el 10/11/2026 la base de .env.development.local es producción. Estas pruebas crean y borran datos,
// así que solo corren contra una base de pruebas declarada con TEST_DATABASE_URL (y la API levantada con esa base).
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Pruebas de API bloqueadas: define TEST_DATABASE_URL con una base de pruebas (nunca la de producción).");
}
E.DATABASE_URL = process.env.TEST_DATABASE_URL;
export const BASE = process.env.API_BASE ?? "http://127.0.0.1:3100/api/v1";
export const sql = postgres(E.DATABASE_URL, { prepare: false, max: 1, max_pipeline: 1, infer: true, ssl: "require" });

export async function call(method, path, body, token, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}

/** Fija un código conocido para la cuenta (la prueba no puede leer el correo). */
export async function forceCode(userId, code) {
  const hash = createHmac("sha256", E.API_JWT_SECRET).update(`${userId}:${code}`).digest("hex");
  await sql`update app.staff_login_codes set code_hash = ${hash} where user_id = ${userId} and used_at is null`;
}

export async function staffLogin(email, userId) {
  await sql`delete from app.rate_limits where bucket like ${"%" + email}`;
  const r1 = await call("POST", "/auth/staff/code", { email });
  if (r1.status !== 202) throw new Error("code " + r1.status);
  await forceCode(userId, "123456");
  const r2 = await call("POST", "/auth/staff/code/verify", { email, code: "123456" });
  if (r2.status !== 200) throw new Error("verify " + r2.status + JSON.stringify(r2.json));
  return r2.json;
}

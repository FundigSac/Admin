import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Problem } from "./http";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

function secret(): string {
  const s = process.env.API_JWT_SECRET?.trim();
  if (!s || s.length < 32) throw new Problem(503, "API_NOT_CONFIGURED");
  return s;
}

/** Hash del código de acceso ligado a la cuenta (igual idea que el Backend: SHA-256 con el id de la cuenta). */
export const loginCodeHash = (userId: string, code: string) => createHmac("sha256", secret()).update(`${userId}:${code}`).digest("hex");

const b64 = (data: string | Buffer) => Buffer.from(data).toString("base64url");

export type AccessClaims = { sub: string; kind: "STAFF" | "CUSTOMER"; stamp: number; iat: number; exp: number; iss: string };
const ISSUER = "fundigsac-api";
export const ACCESS_TTL_SECONDS = 15 * 60;

/** JWT HS256 de acceso (15 minutos). El `stamp` invalida tokens viejos cuando se desactiva la cuenta o cambian sus roles. */
export function signAccessToken(sub: string, kind: AccessClaims["kind"], stamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64(JSON.stringify({ sub, kind, stamp, iat: now, exp: now + ACCESS_TTL_SECONDS, iss: ISSUER } satisfies AccessClaims));
  const mac = createHmac("sha256", secret()).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${mac}`;
}

export function verifyAccessToken(token: string): AccessClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 2048) return null;
  const [header, payload, mac] = parts;
  const expected = createHmac("sha256", secret()).update(`${header}.${payload}`).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const h = JSON.parse(Buffer.from(header, "base64url").toString()) as { alg?: string };
    if (h.alg !== "HS256") return null;
    const c = JSON.parse(Buffer.from(payload, "base64url").toString()) as AccessClaims;
    if (c.iss !== ISSUER || typeof c.sub !== "string" || typeof c.exp !== "number" || c.exp <= Date.now() / 1000) return null;
    return c;
  } catch {
    return null;
  }
}

/** Contraseñas de clientes: scrypt (N=2^15, r=8, p=1) con sal de 16 bytes. Formato `scrypt$N$r$p$sal$hash`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, n, r, p, salt, hash] = stored.split("$");
  const expected = Buffer.from(hash, "base64url");
  const got = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

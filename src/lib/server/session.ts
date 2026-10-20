import { callBackend } from "./backend";

/**
 * Sesión del panel con el Backend. Dos cookies httpOnly firmadas con HMAC-SHA256 (ADMIN_AUTH_SECRET, 32+ caracteres):
 * - `fa-session` (ruta /): quién es (id, nombre, correo, roles y permisos) para el proxy y el layout del panel;
 * - `fa-api` (ruta /api): tokens de la API (acceso de 15 min y refresh rotativo); solo la leen las rutas del BFF.
 * El JavaScript de la página no puede leer ninguna de las dos.
 */
export const SESSION_COOKIE = "fa-session";
export const API_COOKIE = "fa-api";
const API_PATH = "/api";
const SKEW_SECONDS = 30;

export type PanelUser = { id: string; name: string; email: string; roles: string[]; permissions: string[] };
export type ApiTokens = { accessToken: string; expiresIn: number; refreshToken: string; refreshExpiresIn: number };
type StoredTokens = { a: string; r: string; x: number; p: boolean };
export type CookieWrite = { name: string; value: string; path: string; maxAge?: number } | { name: string; path: string; clear: true };

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function authSecret(): string | null {
  const secret = process.env.ADMIN_AUTH_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

const key = (secret: string, usage: "sign" | "verify") =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);

export async function sign(data: object, maxAgeSeconds: number): Promise<string | null> {
  const secret = authSecret();
  if (!secret) return null;
  const payload = b64url(encoder.encode(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds })));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret, "sign"), encoder.encode(payload)));
  return `${payload}.${b64url(mac)}`;
}

export async function verify<T>(token: string | undefined): Promise<T | null> {
  const secret = authSecret();
  if (!secret || !token || token.length > 4096) return null;
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await key(secret, "verify"), fromB64url(mac), encoder.encode(payload)))) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as T & { exp?: number };
    return typeof data.exp === "number" && data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

/** Usuario del panel a partir de la cookie firmada, o null si falta, está alterada o venció. */
export async function readPanelUser(value: string | undefined): Promise<PanelUser | null> {
  const data = await verify<PanelUser>(value);
  return data && typeof data.id === "string" && typeof data.name === "string" && typeof data.email === "string" && Array.isArray(data.roles)
    ? { id: data.id, name: data.name, email: data.email, roles: data.roles, permissions: Array.isArray(data.permissions) ? data.permissions : [] }
    : null;
}

/** Cookies de una sesión nueva. Sin «mantener la sesión», ambas duran hasta cerrar el navegador. */
export async function sessionCookies(user: PanelUser, tokens: ApiTokens, remember: boolean): Promise<CookieWrite[] | null> {
  const ttl = tokens.refreshExpiresIn;
  const session = await sign(user, ttl);
  const api = await sign({ a: tokens.accessToken, r: tokens.refreshToken, x: Math.floor(Date.now() / 1000) + tokens.expiresIn, p: remember } satisfies StoredTokens, ttl);
  if (!session || !api) return null;
  const maxAge = remember ? ttl : undefined;
  return [
    { name: SESSION_COOKIE, value: session, path: "/", maxAge },
    { name: API_COOKIE, value: api, path: API_PATH, maxAge },
  ];
}

export const clearSessionCookies = (): CookieWrite[] => [
  { name: SESSION_COOKIE, path: "/", clear: true },
  { name: API_COOKIE, path: API_PATH, clear: true },
];

/** Escribe las cookies en una respuesta (httpOnly, SameSite=Strict, Secure en https). */
export function applyCookies(response: Response, writes: CookieWrite[], request: Request): Response {
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  for (const w of writes) {
    const base = `${w.name}=${"clear" in w ? "" : w.value}; Path=${w.path}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
    const age = "clear" in w ? "; Max-Age=0" : w.maxAge ? `; Max-Age=${w.maxAge}` : "";
    response.headers.append("Set-Cookie", base + age);
  }
  return response;
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

/** La API rota el refresh en cada uso: dos peticiones simultáneas comparten una sola renovación. */
const inflight = new Map<string, { at: number; promise: ReturnType<typeof callBackend<ApiTokens>> }>();

function refreshOnce(refreshToken: string, request: Request) {
  const now = Date.now();
  for (const [k, entry] of inflight) if (now - entry.at > 15_000) inflight.delete(k);
  const existing = inflight.get(refreshToken);
  if (existing) return existing.promise;
  const promise = callBackend<ApiTokens>("/api/v1/auth/refresh", { body: { refreshToken }, request });
  inflight.set(refreshToken, { at: now, promise });
  return promise;
}

/**
 * Token de acceso vigente (renovado si hace falta) y las cookies a reescribir. `expired`: la sesión ya no sirve
 * (refresh vencido o revocado, cuenta desactivada) y hay que volver a ingresar.
 */
export async function accessToken(request: Request): Promise<{ token: string | null; writes: CookieWrite[]; expired: boolean }> {
  const stored = await verify<StoredTokens>(cookieValue(request, API_COOKIE));
  if (!stored || typeof stored.a !== "string" || typeof stored.r !== "string") return { token: null, writes: [], expired: true };
  if (stored.x - SKEW_SECONDS > Date.now() / 1000) return { token: stored.a, writes: [], expired: false };
  const refreshed = await refreshOnce(stored.r, request);
  if (!refreshed.ok) return { token: null, writes: refreshed.reason === "http" ? clearSessionCookies() : [], expired: refreshed.reason === "http" };
  const user = await readPanelUser(cookieValue(request, SESSION_COOKIE));
  const writes = user ? await sessionCookies(user, refreshed.data, stored.p === true) : null;
  return { token: refreshed.data.accessToken, writes: writes ?? [], expired: false };
}

export const storedRefreshToken = async (request: Request) => (await verify<StoredTokens>(cookieValue(request, API_COOKIE)))?.r ?? null;

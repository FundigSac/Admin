import { STAFF } from "@/data/demo-account";
import { BACKEND_MODE } from "@/lib/backend-mode";

// Acceso sin contraseña con un código de un solo uso enviado al correo (fase de diseño).
//
// Reglas que el Backend deberá aplicar igual (aquí se simulan en el navegador):
// - el código tiene 6 dígitos aleatorios, vence a los 10 minutos y sirve una sola vez;
// - se permiten 5 intentos por código; al agotarlos hay que pedir otro;
// - reenviar exige esperar 60 segundos;
// - la respuesta a "enviar código" es la misma exista o no la cuenta, para no revelar quién es del personal.
//
// Una cookie marca que se inició sesión para que src/proxy.ts proteja el panel sin parpadeo. Con el Backend, la
// sesión será un JWT en una cookie HttpOnly emitida por un BFF; esta cookie de diseño no lleva secretos.

export const SESSION_COOKIE = "fa-session";
export const CODE_TTL_MS = 10 * 60_000;
export const RESEND_COOLDOWN_MS = 60_000;
export const MAX_ATTEMPTS = 5;

/** Con Backend llegan también el id y los roles del personal (de la cookie firmada); en la demostración, solo nombre y correo. */
export type SessionUser = { name: string; email: string; id?: string; roles?: string[] };

type Challenge = { email: string; code: string | null; expiresAt: number; attemptsLeft: number; sentAt: number };

let challenge: Challenge | null = null;

function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

export function findStaff(email: string) {
  const e = email.trim().toLowerCase();
  return STAFF.find((s) => s.email === e) ?? null;
}

/** Pide un código. Devuelve el código solo para la bandeja de demostración; el Backend nunca lo devolverá. */
export function requestCode(email: string): { expiresAt: number; sentAt: number; demoCode: string | null } {
  const staff = findStaff(email);
  const now = Date.now();
  challenge = { email: email.trim().toLowerCase(), code: staff ? randomCode() : null, expiresAt: now + CODE_TTL_MS, attemptsLeft: MAX_ATTEMPTS, sentAt: now };
  return { expiresAt: challenge.expiresAt, sentAt: now, demoCode: challenge.code };
}

export type VerifyResult = { ok: true; user: SessionUser } | { ok: false; reason: "expired" | "locked" | "wrong"; attemptsLeft: number };

export function verifyCode(code: string): VerifyResult {
  if (!challenge || Date.now() > challenge.expiresAt) return { ok: false, reason: "expired", attemptsLeft: 0 };
  if (challenge.attemptsLeft <= 0) return { ok: false, reason: "locked", attemptsLeft: 0 };
  const staff = findStaff(challenge.email);
  if (challenge.code && staff && code === challenge.code) {
    challenge = null;
    return { ok: true, user: { name: staff.name, email: staff.email } };
  }
  challenge.attemptsLeft -= 1;
  return challenge.attemptsLeft <= 0 ? { ok: false, reason: "locked", attemptsLeft: 0 } : { ok: false, reason: "wrong", attemptsLeft: challenge.attemptsLeft };
}

export function startSession(user: SessionUser, remember: boolean) {
  const value = encodeURIComponent(JSON.stringify(user));
  const maxAge = remember ? "; Max-Age=2592000" : "";
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${value}; Path=/; SameSite=Strict${maxAge}${secure}`;
}

/** Cierra la sesión. Con Backend, el BFF revoca el refresh token en la API y borra las cookies httpOnly. */
export async function endSession() {
  if (BACKEND_MODE) {
    await fetch("/api/session/logout", { method: "POST" }).catch(() => null);
    return;
  }
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict`;
}

export function parseSession(raw: string | undefined | null): SessionUser | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Partial<SessionUser>;
    return typeof data.name === "string" && typeof data.email === "string" ? { name: data.name, email: data.email } : null;
  } catch {
    return null;
  }
}

/** a***n@fundigsac.local: confirma el destino sin mostrar el correo completo en pantalla. */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return user.length <= 2 ? `${user[0]}***@${domain}` : `${user[0]}***${user[user.length - 1]}@${domain}`;
}

import { ADMIN_EMAIL, ADMIN_NAME, DEMO_PASSWORD } from "@/data/demo-account";

// Sesión de demostración (fase de diseño). Una cookie marca que se inició sesión para que src/proxy.ts proteja las
// rutas del panel sin parpadeo. Al conectar el Backend se reemplaza por su login (/api/v1/auth/login) detrás de un
// BFF que guarde el JWT en una cookie HttpOnly; esta cookie no lleva secretos.

export const SESSION_COOKIE = "fa-session";

export type SessionUser = { name: string; email: string };

export function checkDemoCredentials(email: string, password: string): SessionUser | null {
  if (email.trim().toLowerCase() === ADMIN_EMAIL && password === DEMO_PASSWORD) return { name: ADMIN_NAME, email: ADMIN_EMAIL };
  return null;
}

export function startSession(user: SessionUser, remember: boolean) {
  const value = encodeURIComponent(JSON.stringify(user));
  const maxAge = remember ? "; Max-Age=2592000" : "";
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${value}; Path=/; SameSite=Lax${maxAge}${secure}`;
}

export function endSession() {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
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

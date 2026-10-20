import { callBackend, relay } from "@/lib/server/backend";
import { applyCookies, clearSessionCookies, sessionCookies, storedRefreshToken, type ApiTokens, type PanelUser } from "@/lib/server/session";

/**
 * Acceso del personal sin contraseña (BFF): pedir el código, ingresar con él y salir. La API responde igual exista o
 * no la cuenta; aquí solo se abre la sesión cuando la API confirma el código y el perfil es del personal.
 */
const noStore = { "Cache-Control": "no-store" };

type Profile = { id: string; fullName: string; email: string; kind: string; roles: string[]; permissions: string[] };

function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return false;
  }
}

async function body(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return {};
  const text = await request.text();
  if (text.length > 4096) return {};
  try {
    const data = JSON.parse(text) as unknown;
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const text = (data: Record<string, unknown>, k: string, max: number) => (typeof data[k] === "string" ? (data[k] as string).trim().slice(0, max) : undefined);

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!sameOrigin(request)) return Response.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  const data = await body(request);

  if (action === "code") {
    return relay(await callBackend("/api/v1/auth/staff/code", { body: { email: text(data, "email", 254) }, request }));
  }

  if (action === "verify") {
    const login = await callBackend<ApiTokens>("/api/v1/auth/staff/code/verify", { body: { email: text(data, "email", 254), code: text(data, "code", 12) }, request });
    if (!login.ok) return relay(login);
    const profile = await callBackend<Profile>("/api/v1/staff/profile", { token: login.data.accessToken, request });
    if (!profile.ok || profile.data.kind !== "STAFF") return relay(profile.ok ? { ok: false, status: 403, problem: { code: "NOT_STAFF" }, reason: "http" } : profile);
    const user: PanelUser = {
      id: profile.data.id,
      name: profile.data.fullName,
      email: profile.data.email,
      roles: profile.data.roles.map((r) => r.toLowerCase()),
      permissions: profile.data.permissions,
    };
    const writes = await sessionCookies(user, login.data, data.remember === true);
    if (!writes) return Response.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503, headers: noStore });
    return applyCookies(Response.json({ user: { name: user.name, email: user.email } }, { headers: noStore }), writes, request);
  }

  if (action === "logout") {
    const refreshToken = await storedRefreshToken(request);
    if (refreshToken) await callBackend("/api/v1/auth/logout", { body: { refreshToken }, request });
    return applyCookies(Response.json({ ok: true }, { headers: noStore }), clearSessionCookies(), request);
  }

  return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });
}

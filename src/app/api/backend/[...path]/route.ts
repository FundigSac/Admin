import { callBackend, relay } from "@/lib/server/backend";
import { accessToken, applyCookies, clearSessionCookies } from "@/lib/server/session";

/**
 * Proxy del panel hacia la API del personal: /api/backend/staff/... → /api/v1/staff/... con el token de la sesión
 * (cookie httpOnly) y la versión (If-Match) para los cambios. Solo rutas del personal; los permisos finos los exige la
 * API en cada endpoint. Una sesión vencida responde 401 SESSION_EXPIRED y borra las cookies.
 */
const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const noStore = { "Cache-Control": "no-store" };

async function forward(request: Request, path: string[], method: string): Promise<Response> {
  if (path[0] !== "staff" || path.length > 8 || !path.every((s) => SEGMENT.test(s))) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });
  }
  if (method !== "GET") {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return Response.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  }
  const session = await accessToken(request);
  if (!session.token) {
    const response = Response.json({ error: session.expired ? "SESSION_EXPIRED" : "UNREACHABLE" }, { status: session.expired ? 401 : 503, headers: noStore });
    return session.expired ? applyCookies(response, clearSessionCookies(), request) : response;
  }
  let body: unknown;
  if (method !== "GET" && method !== "DELETE") {
    const text = await request.text();
    if (text.length > 64 * 1024) return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413, headers: noStore });
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return Response.json({ error: "INVALID_BODY" }, { status: 400, headers: noStore });
    }
  }
  const headers: Record<string, string> = {};
  const ifMatch = request.headers.get("if-match");
  if (ifMatch && /^"?\d{1,12}"?$/.test(ifMatch)) headers["If-Match"] = ifMatch;
  const query = new URL(request.url).search;
  const result = await callBackend(`/api/v1/${path.join("/")}${query.length <= 1024 ? query : ""}`, { method, body, token: session.token, request, headers });
  return applyCookies(relay(result), session.writes, request);
}

type Ctx = { params: Promise<{ path: string[] }> };

export const GET = async (request: Request, { params }: Ctx) => forward(request, (await params).path, "GET");
export const POST = async (request: Request, { params }: Ctx) => forward(request, (await params).path, "POST");
export const PUT = async (request: Request, { params }: Ctx) => forward(request, (await params).path, "PUT");
export const PATCH = async (request: Request, { params }: Ctx) => forward(request, (await params).path, "PATCH");
export const DELETE = async (request: Request, { params }: Ctx) => forward(request, (await params).path, "DELETE");

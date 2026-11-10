/**
 * Cliente del Backend FUNDIGSAC para el servidor del panel (BFF). Solo lo importan rutas de src/app/api, el proxy y
 * los layouts: el navegador nunca habla con la API ni ve sus tokens.
 */

export type BackendProblem = { code?: string; detail?: string; errors?: { field?: string; code?: string; message?: string }[] };

export type BackendResult<T> =
  | { ok: true; status: number; data: T; etag: string | null }
  | { ok: false; status: number; problem: BackendProblem; reason: "not_configured" | "unreachable" | "http"; retryAfter?: string };

const TIMEOUT_MS = 10_000;

const SELF = "self";

async function inProcess(path: string, init: RequestInit): Promise<Response> {
  const [{ dispatch }, { routes }] = await Promise.all([import("@/server/api/router"), import("@/server/api/routes")]);
  const url = new URL(path, "http://api.internal");
  const segments = url.pathname.replace(/^\/api\/v1\//, "").split("/").filter(Boolean);
  const response = await dispatch(routes, new Request(url, init), segments);
  if (init.method !== "GET") {
    const [{ after }, { dispatchOutbox, mailConfigured }] = await Promise.all([import("next/server"), import("@/server/api/mail")]);
    if (mailConfigured()) after(() => dispatchOutbox(10).catch(() => undefined));
  }
  return response;
}

/** URL base de la API (BACKEND_URL), `self` si la API corre en este proyecto, o null si falta o no es http(s). */
export function backendUrl(): string | null {
  const raw = process.env.BACKEND_URL?.trim().replace(/\/+$/, "");
  if (!raw) return null;
  if (raw === SELF) return SELF;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin + url.pathname.replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

/** IP del visitante solo detrás de un proxy que la reescribe (Vercel) o con TRUST_PROXY=1. */
function clientIp(request: Request | undefined): string | null {
  if (!request || (process.env.VERCEL !== "1" && process.env.TRUST_PROXY !== "1")) return null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

type CallOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  request?: Request;
  headers?: Record<string, string>;
};

/** Llama a la API (`path` empieza con /api/v1/) y devuelve el JSON, el ETag y el problema (RFC 9457) ya leídos. */
export async function callBackend<T>(path: string, options: CallOptions = {}): Promise<BackendResult<T>> {
  const base = backendUrl();
  if (!base) return { ok: false, status: 503, problem: { code: "BACKEND_NOT_CONFIGURED" }, reason: "not_configured" };
  const headers = new Headers({ Accept: "application/json", "Accept-Language": "es-PE", ...options.headers });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  const ip = clientIp(options.request);
  if (ip) headers.set("X-Forwarded-For", ip);
  let response: Response;
  const init: RequestInit = {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  try {
    // La API vive en este mismo proyecto (BACKEND_URL=self): se atiende en el proceso, sin salir a la red.
    response = base === SELF ? await inProcess(path, init) : await fetch(`${base}${path}`, init);
  } catch {
    return { ok: false, status: 503, problem: { code: "BACKEND_UNREACHABLE" }, reason: "unreachable" };
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (response.ok) return { ok: true, status: response.status, data: json as T, etag: response.headers.get("ETag") };
  const problem = (json && typeof json === "object" ? json : {}) as BackendProblem;
  return { ok: false, status: response.status, problem, reason: "http", retryAfter: response.headers.get("Retry-After") ?? undefined };
}

/** Respuesta del BFF al navegador: el JSON de la API (o su código de error y errores de campo, sin detalles internos). */
export function relay(result: BackendResult<unknown>, okBody?: unknown): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (result.ok) {
    if (result.etag) headers.ETag = result.etag;
    return Response.json(okBody ?? result.data ?? { ok: true }, { status: result.status === 204 ? 200 : result.status, headers });
  }
  if (result.retryAfter) headers["Retry-After"] = result.retryAfter;
  const body = {
    error: result.reason === "http" ? (result.problem.code ?? "ERROR") : result.reason.toUpperCase(),
    message: result.problem.detail,
    errors: (result.problem.errors ?? []).map((e) => ({ field: e.field, code: e.code, message: e.message })),
  };
  return Response.json(body, { status: result.reason === "http" ? result.status : 503, headers });
}

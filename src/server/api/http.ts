import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Error de negocio que termina en una respuesta RFC 9457 con el mismo `code` que usa el Backend Java. */
export class Problem extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: string,
    public errors: { field?: string; code?: string; message?: string }[] = [],
    public headers: Record<string, string> = {},
  ) {
    super(code);
  }
}

export const badRequest = (errors: { field: string; code: string; message?: string }[]) => new Problem(400, "VALIDATION_ERROR", "Revise los campos indicados.", errors);
export const notFound = (code = "NOT_FOUND") => new Problem(404, code);
export const forbidden = (code = "FORBIDDEN") => new Problem(403, code);
export const unauthorized = (code = "UNAUTHORIZED") => new Problem(401, code);
export const conflict = (code: string, detail?: string) => new Problem(409, code, detail);

export function problemResponse(p: Problem): Response {
  return Response.json(
    { type: "about:blank", title: p.code, status: p.status, code: p.code, detail: p.detail, errors: p.errors },
    { status: p.status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store", ...p.headers } },
  );
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  if (status === 204) return new Response(null, { status, headers: { "Cache-Control": "no-store", ...headers } });
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** Lee un cuerpo JSON con límite de tamaño. Un cuerpo ausente o vacío cuenta como `{}`. */
export async function readJson(request: Request, max = 64 * 1024): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > max) throw new Problem(413, "PAYLOAD_TOO_LARGE");
  if (!text.trim()) return {};
  try {
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new Problem(400, "MALFORMED_REQUEST", "El cuerpo no es JSON válido.");
  }
}

/**
 * IP del visitante, solo para límites de frecuencia. El BFF del sitio la manda en X-Client-IP con el secreto compartido
 * (Vercel reescribe X-Forwarded-For entre proyectos); sin ese secreto vale la IP que pone Vercel.
 */
export function clientIp(request: Request): string {
  const shared = process.env.API_CLIENT_SECRET?.trim();
  const given = request.headers.get("x-client-auth") ?? "";
  const trusted = !!shared && given.length === shared.length && timingSafeEqual(Buffer.from(given), Buffer.from(shared));
  const ip = (trusted && request.headers.get("x-client-ip")?.trim()) || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : "unknown";
}

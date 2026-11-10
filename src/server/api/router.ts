import "server-only";
import { ApiNotConfigured, databaseConfigured } from "./db";
import { Problem, problemResponse } from "./http";

export type Route = (request: Request, params: Record<string, string>) => Promise<Response>;

type Compiled = { method: string; parts: string[]; handler: Route };

/** Rutas tipo "GET /staff/complaints/:id". Las literales ganan a los parámetros cuando ambas encajan. */
export function compile(table: Record<string, Route>): Compiled[] {
  return Object.entries(table)
    .map(([key, handler]) => {
      const [method, path] = key.split(" ");
      return { method, parts: path.split("/").filter(Boolean), handler };
    })
    .sort((a, b) => a.parts.filter((p) => p.startsWith(":")).length - b.parts.filter((p) => p.startsWith(":")).length);
}

const SEGMENT = /^[A-Za-z0-9_.@-]{1,128}$/;

export async function dispatch(routes: Compiled[], request: Request, segments: string[]): Promise<Response> {
  try {
    if (!segments.every((s) => SEGMENT.test(s))) throw new Problem(404, "NOT_FOUND");
    let methodMismatch = false;
    for (const r of routes) {
      if (r.parts.length !== segments.length) continue;
      const params: Record<string, string> = {};
      const match = r.parts.every((p, i) => (p.startsWith(":") ? ((params[p.slice(1)] = segments[i]), true) : p === segments[i]));
      if (!match) continue;
      if (r.method !== request.method) {
        methodMismatch = true;
        continue;
      }
      if (!databaseConfigured()) throw new Problem(503, "API_NOT_CONFIGURED");
      return await r.handler(request, params);
    }
    throw new Problem(methodMismatch ? 405 : 404, methodMismatch ? "METHOD_NOT_ALLOWED" : "NOT_FOUND");
  } catch (e) {
    if (e instanceof Problem) return problemResponse(e);
    if (e instanceof ApiNotConfigured) return problemResponse(new Problem(503, "API_NOT_CONFIGURED"));
    const pg = e as { code?: string; message?: string };
    // Violaciones de restricciones de la base: datos que el dominio no admite (no se exponen detalles internos).
    if (pg.code === "23505") return problemResponse(new Problem(409, "CONFLICT"));
    if (pg.code?.startsWith("23")) return problemResponse(new Problem(422, "INTEGRITY_VIOLATION"));
    console.error("[api] error no controlado", pg.code ?? "", (pg.message ?? "").slice(0, 200));
    return problemResponse(new Problem(500, "INTERNAL_ERROR", "Ocurrió un error. Inténtalo de nuevo."));
  }
}

import "server-only";
import { db } from "../db";
import { json } from "../http";
import { mailConfigured } from "../mail";
import type { Route } from "../router";

/**
 * GET /health — para monitoreo de disponibilidad. Responde 200 si la base contesta y 503 si no. Solo conteos de la
 * bandeja de correo (sin destinatarios ni contenido) para detectar envíos atascados.
 */
const health: Route = async () => {
  const started = Date.now();
  try {
    const [row] = await db()<{ pending: number; failed: number; oldest_min: number | null }[]>`
      select count(*) filter (where status = 'PENDING')::int pending,
             count(*) filter (where status = 'FAILED' and created_at > now() - interval '1 day')::int failed,
             (extract(epoch from now() - min(created_at) filter (where status = 'PENDING')) / 60)::int oldest_min
        from app.email_outbox`;
    const stuck = (row.oldest_min ?? 0) > 60;
    return json(
      { status: stuck ? "degraded" : "ok", db: { ok: true, ms: Date.now() - started }, mail: { configured: mailConfigured(), pending: row.pending, failedLastDay: row.failed, oldestPendingMinutes: row.oldest_min } },
      200,
    );
  } catch {
    return json({ status: "down", db: { ok: false, ms: Date.now() - started } }, 503);
  }
};

export const healthRoutes: Record<string, Route> = { "GET /health": health };

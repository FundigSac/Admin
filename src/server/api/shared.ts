import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Tx } from "./db";
import { badRequest, conflict, Problem } from "./http";
import { limaYear } from "./lima";

/** Folio correlativo PPP-AAAA-NNNNNN por prefijo y año de Lima, atómico en la misma transacción del alta. */
export async function nextFolio(tx: Tx, prefix: "COT" | "REQ" | "CON" | "REC" | "ARC"): Promise<string> {
  const [row] = await tx<{ f: string }[]>`select app.next_folio(${prefix}, ${limaYear()}) as f`;
  return row.f;
}

/** If-Match obligatorio en escrituras del personal: acepta `"7"`, `7` o `W/"7"`. */
export function ifMatch(request: Request): number {
  const raw = request.headers.get("if-match");
  if (!raw) throw new Problem(428, "IF_MATCH_REQUIRED", "Falta la versión del registro (If-Match).");
  const m = /^(?:W\/)?"?(\d{1,12})"?$/.exec(raw.trim());
  if (!m) throw badRequest([{ field: "If-Match", code: "INVALID_ETAG" }]);
  return Number(m[1]);
}

export const stale = () => new Problem(412, "STALE_VERSION", "Alguien cambió este registro. Vuelve a abrirlo.");
export const etag = (version: number | bigint | string) => ({ ETag: `"${String(version)}"` });

/** Token de constancia determinista: base64url(HMAC-SHA256(RECEIPT_KEY, "<propósito>:<folio>")). */
export function receiptToken(purpose: "quote" | "complaint", folio: string): string {
  const key = process.env.RECEIPT_KEY?.trim() || process.env.API_JWT_SECRET?.trim();
  if (!key) throw new Problem(503, "API_NOT_CONFIGURED");
  return createHmac("sha256", key).update(`${purpose}:${folio}`).digest("base64url");
}

export function receiptMatches(purpose: "quote" | "complaint", folio: string, given: string | null): boolean {
  if (!given) return false;
  const a = Buffer.from(receiptToken(purpose, folio));
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Idempotencia (24 h) por scope y clave, como el Backend: reserva la clave en la transacción del alta; un reintento con
 * el mismo cuerpo devuelve el folio guardado, otro cuerpo con la misma clave responde 409.
 */
export async function reserveIdempotency(tx: Tx, scope: string, key: string | null, command: unknown): Promise<{ replayFolio: string | null; finish: (folio: string) => Promise<void> }> {
  const noop = { replayFolio: null, finish: async () => undefined };
  if (!key) return noop;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw badRequest([{ field: "Idempotency-Key", code: "INVALID_IDEMPOTENCY_KEY" }]);
  const fingerprint = createHash("sha256").update(`${scope}:${JSON.stringify(command)}`).digest("hex");
  const reserved = await tx`
    insert into app.idempotency_records (scope, idem_key, fingerprint, resource_ref, created_at, expires_at)
    values (${scope}, ${key}, ${fingerprint}, null, now(), now() + interval '24 hours')
    on conflict (scope, idem_key) do update set fingerprint = excluded.fingerprint, resource_ref = null, created_at = excluded.created_at, expires_at = excluded.expires_at
      where app.idempotency_records.expires_at < excluded.created_at
    returning idem_key`;
  if (reserved.length === 0) {
    const [existing] = await tx<{ fingerprint: string; resource_ref: string | null }[]>`
      select fingerprint, resource_ref from app.idempotency_records where scope = ${scope} and idem_key = ${key} for update`;
    if (existing.fingerprint !== fingerprint) throw conflict("IDEMPOTENCY_KEY_REUSED", "Esta clave ya se usó con otros datos.");
    if (!existing.resource_ref) throw conflict("REQUEST_IN_PROGRESS");
    return { replayFolio: existing.resource_ref, finish: async () => undefined };
  }
  return {
    replayFolio: null,
    finish: async (folio: string) => {
      await tx`update app.idempotency_records set resource_ref = ${folio} where scope = ${scope} and idem_key = ${key}`;
    },
  };
}

/** Fecha y hora para correos: «10 de noviembre de 2026, 15:04 h» en hora de Lima. */
export function fechaLarga(d: Date): string {
  const s = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${s.replace(/,? (\d{2}:\d{2})$/, ", $1")} h`;
}

export const FIRMA = "\n\nAtentamente,\nFUNDIGSAC - Fundición y Desarrollo de Ingeniería y Gestión S.A.C.\nEste es un mensaje automático; no responda a este correo.";

/** Bandejas internas (ventas, legal, privacidad). Sin configurar, el aviso interno no se encola. */
export const inbox = (name: "SALES_INBOX" | "LEGAL_INBOX" | "PRIVACY_INBOX") => process.env[name]?.trim() || null;

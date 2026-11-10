import "server-only";
import { randomUUID } from "node:crypto";
import { db, type Tx } from "./db";

/**
 * Correos transaccionales con bandeja de salida (outbox), igual que el Backend: se encolan en la misma transacción que
 * el cambio y se envían después con reintentos. El proveedor es Resend (RESEND_API_KEY + MAIL_FROM). Sin proveedor el
 * correo queda PENDIENTE en `app.email_outbox`, nunca se pierde ni se da por enviado.
 */
export type OutboxMail = { dedupeKey: string; template: string; to: string; subject: string; text: string; reference?: string };

export async function enqueueMail(tx: Tx, mail: OutboxMail): Promise<void> {
  await tx`
    insert into app.email_outbox (id, dedupe_key, template, recipient, subject, body, status, attempts, next_attempt_at, reference, created_at)
    values (${randomUUID()}, ${mail.dedupeKey.slice(0, 200)}, ${mail.template}, ${mail.to}, ${mail.subject.slice(0, 200)}, ${mail.text}, 'PENDING', 0, now(), ${mail.reference ?? null}, now())
    on conflict (dedupe_key) do nothing`;
}

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());

/** Envía hasta `limit` correos pendientes. Espera exponencial; a los 8 intentos queda FAILED. El cuerpo se borra al enviar. */
export async function dispatchOutbox(limit = 10): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!mailConfigured()) return { sent: 0, failed: 0, skipped: true };
  const sql = db();
  const rows = await sql<{ id: string; recipient: string; subject: string; body: string; attempts: number }[]>`
    update app.email_outbox set next_attempt_at = now() + interval '2 minutes'
     where id in (select id from app.email_outbox where status = 'PENDING' and next_attempt_at <= now()
                  order by next_attempt_at limit ${limit} for update skip locked)
    returning id, recipient, subject, body, attempts`;
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json", "Idempotency-Key": row.id },
        body: JSON.stringify({ from: process.env.MAIL_FROM!.trim(), to: [row.recipient], subject: row.subject, text: row.body }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await sql`update app.email_outbox set status = 'SENT', sent_at = now(), body = null, attempts = attempts + 1, last_error = null where id = ${row.id}`;
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      const final = attempts >= 8;
      await sql`update app.email_outbox set attempts = ${attempts}, last_error = ${String((e as Error).message).slice(0, 500)},
        status = ${final ? "FAILED" : "PENDING"}, body = case when ${final} then null else body end,
        next_attempt_at = now() + make_interval(secs => ${Math.min(3600, 30 * 2 ** attempts)}) where id = ${row.id}`;
      failed++;
    }
  }
  return { sent, failed, skipped: false };
}

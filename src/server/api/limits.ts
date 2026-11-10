import "server-only";
import { db } from "./db";
import { Problem } from "./http";

/**
 * Límite de frecuencia en ventana fija guardado en Postgres (las funciones de Vercel no comparten memoria).
 * Al pasarse responde 429 con Retry-After, como el Backend Java.
 */
export async function rateLimit(bucket: string, max: number, windowSeconds: number): Promise<void> {
  const [row] = await db()`select app.hit_rate_limit(${bucket.slice(0, 160)}, ${windowSeconds}) as hits`;
  if (Number(row.hits) > max) {
    throw new Problem(429, "RATE_LIMITED", "Demasiados intentos. Espera un momento y vuelve a intentarlo.", [], { "Retry-After": String(windowSeconds) });
  }
  // Limpieza oportunista de ventanas viejas (una de cada ~50 llamadas).
  if (Math.random() < 0.02) await db()`delete from app.rate_limits where window_start < now() - interval '1 day'`;
}

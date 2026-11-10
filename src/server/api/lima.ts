import "server-only";

/**
 * Fechas en hora de Lima (UTC−5, sin horario de verano) independientes de la zona del servidor (Vercel corre en UTC).
 * Los plazos legales se cuentan en días hábiles: lunes a viernes sin feriados nacionales, desde el día siguiente.
 */
const HOLIDAYS = new Set([
  "2026-01-01", "2026-04-02", "2026-04-03", "2026-05-01", "2026-06-07", "2026-06-29", "2026-07-23", "2026-07-28",
  "2026-07-29", "2026-08-06", "2026-08-30", "2026-10-08", "2026-11-01", "2026-12-08", "2026-12-09", "2026-12-25",
  "2027-01-01", "2027-03-25", "2027-03-26", "2027-05-01", "2027-06-07", "2027-06-29", "2027-07-23", "2027-07-28",
  "2027-07-29", "2027-08-06", "2027-08-30", "2027-10-08", "2027-11-01", "2027-12-08", "2027-12-09", "2027-12-25",
]);

/** Fecha (AAAA-MM-DD) de Lima para un instante. */
export function limaDate(instant: Date = new Date()): string {
  return new Date(instant.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
}

export const limaYear = (instant: Date = new Date()) => Number(limaDate(instant).slice(0, 4));

function plusDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isBusinessDate(date: string): boolean {
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(date);
}

/** Último día del plazo: n días hábiles contados desde el día siguiente a `from`. */
export function addBusinessDays(from: string, n: number): string {
  let d = from;
  for (let left = n; left > 0; ) {
    d = plusDays(d, 1);
    if (isBusinessDate(d)) left--;
  }
  return d;
}

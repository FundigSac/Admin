// Días hábiles en el Perú: de lunes a viernes, sin feriados nacionales. Los plazos legales del panel (15 días para
// el Libro de Reclamaciones, 10 para la supresión de datos) se cuentan así, desde el día siguiente a la recepción.

/** Feriados nacionales (Ley 31788 y D.L. 713 con sus modificaciones). Revisar cada año los feriados movibles. */
const HOLIDAYS = new Set([
  // 2026 (Semana Santa: 2 y 3 de abril)
  "2026-01-01", "2026-04-02", "2026-04-03", "2026-05-01", "2026-06-07", "2026-06-29", "2026-07-23", "2026-07-28",
  "2026-07-29", "2026-08-06", "2026-08-30", "2026-10-08", "2026-11-01", "2026-12-08", "2026-12-09", "2026-12-25",
  // 2027 (Semana Santa: 25 y 26 de marzo)
  "2027-01-01", "2027-03-25", "2027-03-26", "2027-05-01", "2027-06-07", "2027-06-29", "2027-07-23", "2027-07-28",
  "2027-07-29", "2027-08-06", "2027-08-30", "2027-10-08", "2027-11-01", "2027-12-08", "2027-12-09", "2027-12-25",
]);

const DAY = 86_400_000;

function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isBusinessDay(t: number) {
  const d = new Date(t);
  const wd = d.getDay();
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(key(d));
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const nextDay = (t: number) => startOfDay(t + DAY + 3_600_000);

/** Fin (23:59) del n-ésimo día hábil contado desde el día siguiente a `from`. */
export function addBusinessDays(from: number, n: number) {
  let t = startOfDay(from);
  for (let left = n; left > 0; ) {
    t = nextDay(t);
    if (isBusinessDay(t)) left -= 1;
  }
  return t + DAY - 1;
}

/** Días hábiles que faltan hasta `due`: 0 si vence hoy, negativo si ya venció. */
export function businessDaysLeft(due: number, now = Date.now()) {
  const today = startOfDay(now);
  const end = startOfDay(due);
  let n = 0;
  if (end >= today) {
    for (let t = nextDay(today); t <= end; t = nextDay(t)) if (isBusinessDay(t)) n += 1;
    return n;
  }
  for (let t = nextDay(end); t <= today; t = nextDay(t)) if (isBusinessDay(t)) n -= 1;
  return Math.min(-1, n);
}

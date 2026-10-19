// Formatos de fecha, número e iniciales. Todo pasa por Intl con el locale del idioma activo.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatDate(t: number, locale: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat(locale, opts).format(t);
}

export function formatDateTime(t: number, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(t);
}

export function formatTime(t: number, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(t);
}

export function relativeTime(t: number, locale: string, now = Date.now()) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diff = t - now;
  const abs = Math.abs(diff);
  if (abs < MIN) return rtf.format(0, "second");
  if (abs < HOUR) return rtf.format(Math.round(diff / MIN), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  if (abs < 365 * DAY) return rtf.format(Math.round(diff / (30 * DAY)), "month");
  return rtf.format(Math.round(diff / (365 * DAY)), "year");
}

export function formatNumber(n: number, locale: string) {
  return new Intl.NumberFormat(locale).format(n);
}

export function formatPercent(n: number, locale: string, digits = 0) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: digits }).format(n);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Tono estable por persona para el avatar (misma persona, mismo color en todo el panel). */
export function avatarHue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return [204, 192, 216, 172, 228, 24, 152, 262][h % 8];
}

export function dayKey(t: number) {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Valida el RUC con el dígito verificador de SUNAT. */
export function isValidRuc(ruc: string) {
  if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(ruc[i]), 0);
  return (11 - (sum % 11)) % 10 === Number(ruc[10]);
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

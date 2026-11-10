import "server-only";
import { badRequest } from "./http";
import { limaDate } from "./lima";

/**
 * Validación con los mismos códigos que el Backend (Bean Validation → REQUIRED, INVALID_LENGTH, INVALID_EMAIL,
 * INVALID_FORMAT, OUT_OF_RANGE, MUST_ACCEPT, INVALID_DATE, INVALID_VALUE; dominio → INVALID_RUC, INVALID_PHONE, …).
 * JSON estricto: un campo no declarado responde 400 UNKNOWN_FIELD.
 */
type Err = { field: string; code: string; message?: string };

export class Check {
  errors: Err[] = [];
  constructor(
    private data: Record<string, unknown>,
    private prefix = "",
  ) {}

  private f = (k: string) => (this.prefix ? `${this.prefix}.${k}` : k);
  fail(field: string, code: string, message?: string) {
    this.errors.push({ field: this.f(field), code, message });
    return undefined;
  }

  allow(keys: string[]) {
    for (const k of Object.keys(this.data)) if (!keys.includes(k)) this.errors.push({ field: this.f(k), code: "UNKNOWN_FIELD" });
    return this;
  }

  /** Texto normalizado (sin caracteres de control, espacios colapsados salvo `multiline`). Vacío cuenta como ausente. */
  str(k: string, opts: { required?: boolean; min?: number; max: number; multiline?: boolean; pattern?: RegExp }): string | null {
    const raw = this.data[k];
    if (raw === undefined || raw === null) return opts.required ? (this.fail(k, "REQUIRED") ?? null) : null;
    if (typeof raw !== "string") return this.fail(k, "INVALID_VALUE") ?? null;
    let v = raw.replace(/\u0000/g, "");
    v = opts.multiline ? v.replace(/[^\S\n]+/g, " ").replace(/[\u0001-\u0008\u000b-\u001f\u007f]/g, "").trim() : v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    if (!v) return opts.required ? (this.fail(k, "REQUIRED") ?? null) : null;
    if (v.length > opts.max || (opts.min !== undefined && v.length < opts.min)) return this.fail(k, "INVALID_LENGTH") ?? null;
    if (opts.pattern && !opts.pattern.test(v)) return this.fail(k, "INVALID_FORMAT") ?? null;
    return v;
  }

  oneOf<T extends string>(k: string, values: readonly T[], opts: { required?: boolean; code?: string } = {}): T | null {
    const v = this.data[k];
    if (v === undefined || v === null || v === "") return opts.required ? (this.fail(k, "REQUIRED") ?? null) : null;
    if (typeof v !== "string" || !values.includes(v as T)) return this.fail(k, opts.code ?? "INVALID_FORMAT") ?? null;
    return v as T;
  }

  bool(k: string, opts: { mustBeTrue?: boolean; required?: boolean } = {}): boolean {
    const v = this.data[k];
    if (v === undefined || v === null) {
      if (opts.required || opts.mustBeTrue) this.fail(k, opts.mustBeTrue ? "MUST_ACCEPT" : "REQUIRED");
      return false;
    }
    if (typeof v !== "boolean") return this.fail(k, "INVALID_VALUE") ?? false;
    if (opts.mustBeTrue && !v) this.fail(k, "MUST_ACCEPT");
    return v;
  }

  email(k: string, required = true): string | null {
    const v = this.str(k, { required, max: 254 });
    if (v === null) return null;
    const e = v.toLowerCase();
    const [local, domain] = e.split("@");
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(e) || local.length > 64 || !domain) return this.fail(k, "INVALID_EMAIL") ?? null;
    return e;
  }

  /** Teléfono `^\+?[0-9 ().-]{7,24}$` normalizado a `^\+?[0-9]{7,15}$`. */
  phone(k: string, required = true): string | null {
    const v = this.str(k, { required, max: 24 });
    if (v === null) return null;
    if (!/^\+?[0-9 ().-]{7,24}$/.test(v)) return this.fail(k, "INVALID_PHONE") ?? null;
    const n = (v.startsWith("+") ? "+" : "") + v.replace(/\D/g, "");
    if (!/^\+?[0-9]{7,15}$/.test(n)) return this.fail(k, "INVALID_PHONE") ?? null;
    return n;
  }

  ruc(k: string, required: boolean): string | null {
    const v = this.str(k, { required, max: 11 });
    if (v === null) return null;
    if (!validRuc(v)) return this.fail(k, "INVALID_RUC") ?? null;
    return v;
  }

  /** Fecha AAAA-MM-DD; `min`/`max` también en AAAA-MM-DD (Lima). */
  date(k: string, opts: { required?: boolean; min?: string; max?: string }): string | null {
    const v = this.data[k];
    if (v === undefined || v === null || v === "") return opts.required ? (this.fail(k, "REQUIRED") ?? null) : null;
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) return this.fail(k, "INVALID_VALUE") ?? null;
    if ((opts.min && v < opts.min) || (opts.max && v > opts.max)) return this.fail(k, "INVALID_DATE") ?? null;
    return v;
  }

  honeypot(k = "website") {
    const v = this.data[k];
    if (typeof v === "string" && v.length > 0) this.fail(k, "INVALID_LENGTH");
  }

  done() {
    if (this.errors.length) throw badRequest(this.errors);
  }
}

/** RUC SUNAT: 11 dígitos, prefijo 10/15/16/17/20 y dígito verificador módulo 11 (pesos 5-4-3-2-7-6-5-4-3-2). */
export function validRuc(ruc: string): boolean {
  if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((s, x, i) => s + x * Number(ruc[i]), 0);
  const check = (11 - (sum % 11)) % 10;
  return check === Number(ruc[10]);
}

/** Documento por tipo (se quitan espacios, puntos y guiones; mayúsculas). */
export function normDocument(type: string, raw: string): string | null {
  const v = raw.replace(/[\s.-]/g, "").toUpperCase();
  if (type === "DNI") return /^\d{8}$/.test(v) ? v : null;
  if (type === "CE") return /^[A-Z0-9]{9,12}$/.test(v) ? v : null;
  if (type === "PASSPORT") return /^[A-Z0-9]{6,12}$/.test(v) ? v : null;
  if (type === "RUC") return validRuc(v) ? v : null;
  return null;
}

export const todayLima = () => limaDate();

export function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Página y tamaño de las listas: page ≥ 0 (def. 0), size 1–100 (def. 20). */
export function paging(url: URL): { page: number; size: number } {
  const page = Number(url.searchParams.get("page") ?? 0);
  const size = Number(url.searchParams.get("size") ?? 20);
  const errs: Err[] = [];
  if (!Number.isInteger(page) || page < 0) errs.push({ field: "page", code: "OUT_OF_RANGE" });
  if (!Number.isInteger(size) || size < 1 || size > 100) errs.push({ field: "size", code: "OUT_OF_RANGE" });
  if (errs.length) throw badRequest(errs);
  return { page, size };
}

export const pageResult = <T,>(items: T[], page: number, size: number, total: number) => ({ items, page, size, totalItems: total, totalPages: total === 0 ? 0 : Math.ceil(total / size) });

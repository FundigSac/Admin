"use client";

import { useState } from "react";
import type { CaseMap, CaseModule, CaseSort } from "@/lib/api";
import { useCaseList } from "@/lib/api/queries";

/** Ruta de cada bandeja. Las rutas no cambian: el menú las reúne en Solicitudes. */
export const BASE: Record<CaseModule, string> = { quotes: "/cotizaciones", inquiries: "/consultas", claims: "/reclamaciones", privacy: "/privacidad" };

/**
 * Qué es "la siguiente" en cada bandeja (brief de diseño §6.4): los plazos legales mandan, así que en reclamos y
 * datos personales es la abierta que vence antes; en cotizaciones y consultas, la nueva que lleva más tiempo esperando.
 */
const NEXT: Record<CaseModule, { status: string; sort: CaseSort; waiting: readonly string[] }> = {
  quotes: { status: "new", sort: "oldest", waiting: ["new"] },
  inquiries: { status: "new", sort: "oldest", waiting: ["new"] },
  claims: { status: "all", sort: "due", waiting: ["received", "in_progress"] },
  privacy: { status: "all", sort: "due", waiting: ["received", "identity", "processing"] },
};

/** Primera solicitud que espera atención, sin contar la que ya está abierta en pantalla. */
export function useNextRequest<M extends CaseModule>(module: M, skipId?: string) {
  const cfg = NEXT[module];
  const list = useCaseList(module, { page: 0, size: 2, status: cfg.status, sort: cfg.sort });
  const item = list.data?.items.find((x) => x.id !== skipId && cfg.waiting.includes((x as { status: string }).status)) ?? null;
  return { item: item as CaseMap[M] | null, ready: list.data !== undefined, error: list.isError };
}

/**
 * Verdadero desde el segundo valor distinto de `key`. Sirve para animar lo que cambia por una acción (otro filtro,
 * otro estado) sin animar la llegada a la pantalla, que el brief pide quieta (§6.7).
 */
export function useChanged(key: string | null) {
  const [seen, setSeen] = useState<{ key: string | null; changes: number }>({ key: null, changes: 0 });
  if (key !== null && key !== seen.key) setSeen({ key, changes: seen.key === null ? 0 : seen.changes + 1 });
  return seen.changes > 0;
}

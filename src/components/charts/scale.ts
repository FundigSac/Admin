// Escalas compartidas por los gráficos del panel.

/** Marcas redondas (1, 2, 2.5 o 5 × 10^n) con el tope por encima del máximo; enteros para conteos. */
export function niceTicks(max: number, count = 4) {
  const top = Math.max(1, max);
  const raw = top / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag);
  const intStep = Math.ceil(step);
  let hi = Math.ceil(top / intStep) * intStep;
  if (hi <= max) hi += intStep;
  const out: number[] = [];
  for (let v = 0; v <= hi; v += intStep) out.push(v);
  return out;
}

/** Índices a rotular con un paso fijo (4 a 8 etiquetas): termina en el último si algún paso lo permite; si no,
 *  el final queda sin rótulo antes que romper el paso con una etiqueta forzada. */
export function xPicks(n: number, width: number, labelWidth: number) {
  if (n <= 1) return n ? [0] : [];
  const cap = Math.max(2, Math.min(8, Math.floor(width / (labelWidth + 24))));
  if (n <= cap) return [...Array(n).keys()];
  const minK = Math.ceil((n - 1) / (cap - 1));
  const steps = (k: number) => Math.floor((n - 1) / k) + 1;
  for (let k = minK; steps(k) >= Math.min(4, cap); k += 1) {
    if ((n - 1) % k === 0) return Array.from({ length: steps(k) }, (_, i) => i * k);
  }
  return Array.from({ length: steps(minK) }, (_, i) => i * minK);
}

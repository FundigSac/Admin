"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// Línea de una serie según las reglas de app-screens (tasteskill §6): segmentos rectos de 2px, sin marcadores,
// relleno plano al 12%, 4-5 líneas guía horizontales, escala redonda cuyo tope supera el máximo, sin eje Y dibujado,
// etiquetas X con un paso fijo y un tooltip simple. El color sale de --chart-1.

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
function xPicks(n: number, width: number, labelWidth: number) {
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

type Props = {
  points: { x: string; y: number; full: string }[];
  height?: number;
  label: string;
  valueLabel: (n: number) => string;
};

export function LineChart({ points, height = 220, label, valueLabel }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...points.map((p) => p.y));
  const ticks = useMemo(() => niceTicks(max, max <= 4 ? max || 1 : 4), [max]);
  const top = ticks[ticks.length - 1];
  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 26;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const n = points.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join("");
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const picks = width ? xPicks(n, plotW, Math.max(...points.map((p) => p.x.length)) * 6.5) : [];

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div ref={wrap} className="chart" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <defs>
            <clipPath id={clipId}>
              <rect x={padL} y={0} width={plotW} height={height} />
            </clipPath>
          </defs>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={padL} x2={width - padR} y1={y(tk)} y2={y(tk)} stroke="var(--grid)" strokeWidth={tk === 0 ? 1.5 : 1} />
              <text x={padL - 8} y={y(tk)} dy="0.32em" textAnchor="end" className="chart__tick">
                {tk}
              </text>
            </g>
          ))}
          {picks.map((i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="chart__tick">
              {points[i].x}
            </text>
          ))}
          <g clipPath={`url(#${clipId})`} key={label}>
            <path d={area} fill="var(--chart-fill)" className="fade-area" />
            <path d={line} pathLength={1} className="draw-line" fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </g>
          {hp && hover !== null && (
            <g aria-hidden="true">
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={y(0)} stroke="var(--control)" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(hp.y)} r={4} fill="var(--surface)" stroke="var(--chart-1)" strokeWidth={2} />
            </g>
          )}
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {hp && hover !== null && (
        <div className="chart__tip" style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: Math.max(0, y(hp.y) - 46) }} aria-hidden="true">
          <span>{hp.full}</span>
          <strong>{valueLabel(hp.y)}</strong>
        </div>
      )}
    </div>
  );
}

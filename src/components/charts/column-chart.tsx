"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { niceTicks, xPicks } from "./scale";

// Columnas para conteos por día: un conteo entero se lee como una barra, no como una pendiente entre días. Barras
// planas de --chart-1 con 2px de redondeo arriba, la media como línea discontinua, 4-5 guías horizontales, el día
// señalado se marca con la columna en tinta y un tooltip simple. Al llegar, las columnas crecen desde la base en
// cascada corta (motion.css: .grow-y).

type Props = {
  points: { x: string; y: number; full: string }[];
  height?: number;
  label: string;
  valueLabel: (n: number) => string;
  /** Texto de la línea de la media ("media 1,4"); sin él no se dibuja. */
  meanLabel?: string;
};

export function ColumnChart({ points, height = 220, label, valueLabel, meanLabel }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

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
  const padL = 28;
  const padR = 4;
  const padT = 10;
  const padB = 26;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const n = points.length;
  const slot = n ? plotW / n : 0;
  const barW = Math.max(2, Math.min(14, slot * 0.5));
  const cx = (i: number) => padL + slot * i + slot / 2;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const mean = n ? points.reduce((a, p) => a + p.y, 0) / n : 0;
  const picks = width ? xPicks(n, plotW, Math.max(...points.map((p) => p.x.length)) * 6.5) : [];
  // La cascada completa nunca pasa de ~360 ms aunque haya 90 columnas.
  const step = n > 1 ? Math.min(14, 360 / n) : 0;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - rect.left) / rect.width) * n))));
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div ref={wrap} className="chart" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={padL} x2={width - padR} y1={y(tk)} y2={y(tk)} stroke={tk === 0 ? "var(--rule-strong)" : "var(--grid)"} strokeWidth={1} />
              <text x={padL - 8} y={y(tk)} dy="0.32em" textAnchor="end" className="chart__tick">
                {tk}
              </text>
            </g>
          ))}
          {picks.map((i) => (
            <text key={i} x={cx(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="chart__tick">
              {points[i].x}
            </text>
          ))}
          <g key={`${label}-${n}`}>
            {points.map((p, i) =>
              p.y > 0 ? (
                <rect
                  key={p.full}
                  className="grow-y"
                  style={{ animationDelay: `${Math.round(i * step)}ms` }}
                  x={cx(i) - barW / 2}
                  y={y(p.y)}
                  width={barW}
                  height={y(0) - y(p.y)}
                  rx={Math.min(2, barW / 3)}
                  fill={hover === i ? "var(--rule-strong)" : "var(--chart-1)"}
                />
              ) : null,
            )}
          </g>
          {meanLabel && mean > 0 && (
            <g className="fade-area" aria-hidden="true">
              <line x1={padL} x2={width - padR} y1={y(mean)} y2={y(mean)} stroke="var(--text)" strokeWidth={1} strokeDasharray="3 4" opacity={0.55} />
              <text x={padL + 6} y={y(mean) - 6} className="chart__tick chart__tick--mean">
                {meanLabel}
              </text>
            </g>
          )}
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {hp && hover !== null && (
        <div className="chart__tip" style={{ left: Math.min(Math.max(cx(hover), 70), width - 70), top: Math.max(0, y(hp.y) - 50) }} aria-hidden="true">
          <span>{hp.full}</span>
          <strong>{valueLabel(hp.y)}</strong>
        </div>
      )}
    </div>
  );
}

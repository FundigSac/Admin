"use client";

import Link from "next/link";
import { useState } from "react";
import { ColumnChart } from "@/components/charts/column-chart";
import { Avatar, MethodIcon, Skeleton, StatusBadge } from "@/components/ui/bits";
import { IconChevronRight, IconRefresh } from "@/components/ui/icons";
import type { SignupMethod } from "@/data/types";
import type { DashboardStats, RangeKey } from "@/lib/api";
import { useStats } from "@/lib/api/queries";
import { formatDate, formatNumber, formatPercent, formatTime, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { useHomeCopy } from "./home-copy";

// "Ver números del mes": las cifras de registros que antes eran la portada. Se carga aparte (dynamic import) y solo
// al abrir el desplegable. Sin conteos animados ni gráficos que crecen (brief §6.7): cada bloque explica en una frase
// qué muestra, en lugar de la ayuda (i).

const RANGES: RangeKey[] = ["7d", "30d", "90d", "all"];
const METHODS: SignupMethod[] = ["google", "email", "facebook"];

export default function MonthNumbers() {
  const { t } = usePrefs();
  const c = useHomeCopy().numbers;
  const [range, setRange] = useState<RangeKey>("30d");
  const stats = useStats(range);
  const s = stats.data;

  return (
    <div className="numbers__body">
      <div className="numbers__scope">
        <div className="segmented" role="group" aria-label={c.rangeLabel}>
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {c.range[r]}
            </button>
          ))}
        </div>
        <span className="stamp">
          {s ? c.updated(formatTime(s.generatedAt, t.locale)) : null}
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => stats.refetch()} aria-label={c.refresh} title={c.refresh} disabled={stats.isFetching}>
            {stats.isFetching ? <span className="spinner" aria-hidden="true" /> : <IconRefresh size={14} aria-hidden="true" />}
          </button>
        </span>
      </div>

      <Figures s={s} range={range} />
      <Trend s={s} range={range} />
      <div className="numbers__pair">
        <Funnel s={s} range={range} />
        <Mix s={s} range={range} />
      </div>
      <Latest s={s} />
    </div>
  );
}

function Figures({ s, range }: { s?: DashboardStats; range: RangeKey }) {
  const { t } = usePrefs();
  const c = useHomeCopy().numbers;
  const n = (v: number) => formatNumber(v, t.locale);
  const delta = s ? s.newInRange - s.newPrevRange : 0;
  const deltaText = !s ? null : range === "all" ? (
    c.noPrev
  ) : s.newPrevRange === 0 && s.newInRange > 0 ? (
    c.prevNew(s.newInRange)
  ) : (
    <>
      <span className={delta > 0 ? "is-good" : delta < 0 ? "is-bad" : undefined}>{delta > 0 ? `+${n(delta)}` : delta < 0 ? `−${n(-delta)}` : "0"}</span>
      {c.vsPrev("", c.prevRange[range])}
    </>
  );

  const cells = [
    { label: c.newUsers, value: s?.newInRange, lead: true, caption: deltaText },
    { label: c.total, value: s?.total, caption: c.totalHint },
    { label: c.pending, value: s?.pending, caption: s ? <span className={s.pendingOver48h > 0 ? "is-bad" : undefined}>{c.pendingHint(s.pendingOver48h)}</span> : null },
    { label: c.activeWeek, value: s?.activeWeek, caption: s ? c.activeHint(formatPercent(s.activeWeek / Math.max(1, s.total), t.locale)) : null },
  ];

  return (
    <section className="kpis" aria-label={c.figures}>
      {cells.map((cell) => (
        <div key={cell.label} className="kpi">
          <p className="kpi__label">{cell.label}</p>
          <span className={`kpi__value num${cell.lead ? " kpi__value--lead" : ""}`}>{cell.value === undefined ? <Skeleton w={56} h={cell.lead ? 30 : 24} /> : n(cell.value)}</span>
          <p className="kpi__caption">{cell.caption ?? <Skeleton w={120} h={12} />}</p>
        </div>
      ))}
    </section>
  );
}

function Trend({ s, range }: { s?: DashboardStats; range: RangeKey }) {
  const { t } = usePrefs();
  const c = useHomeCopy().numbers;
  const [asTable, setAsTable] = useState(false);
  const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const points = (s?.series ?? []).map((p) => ({ x: formatDate(p.day, t.locale, short), y: p.count, full: formatDate(p.day, t.locale, { weekday: "short", day: "numeric", month: "long" }) }));
  const peak = Math.max(0, ...points.map((p) => p.y));
  const peakIndex = points.findIndex((p) => p.y === peak);
  const avg = new Intl.NumberFormat(t.locale, { maximumFractionDigits: 1 }).format(points.length ? points.reduce((a, p) => a + p.y, 0) / points.length : 0);
  const summary = s && peak > 0 && peakIndex >= 0 ? c.trendSummary(avg, peak, formatDate(s.series[peakIndex].day, t.locale, { day: "numeric", month: "long" })) : null;

  return (
    <section className="panel" aria-labelledby="trend-title">
      <div className="panel__head">
        <div>
          <h3 id="trend-title" className="panel__title">
            {c.trendTitle}
          </h3>
          <p className="panel__meta">{s ? c.trendMeta(s.newInRange, c.rangeLong[range]) : <Skeleton w={260} h={12} />}</p>
        </div>
        <button type="button" className="card-link numbers__toggle" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? c.asChart : c.asTable}
        </button>
      </div>
      {!s ? (
        <Skeleton h={220} />
      ) : asTable ? (
        <div className="chart-table">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{c.day}</th>
                <th scope="col" className="n">
                  {c.count}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.full}>
                  <td>{p.full}</td>
                  <td className="n num">{p.y}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ColumnChart points={points} label={c.trendAria(s.newInRange, c.rangeLong[range], peak)} valueLabel={c.trendPoint} meanLabel={c.trendMean(avg)} />
      )}
      {!asTable && <p className="chart-summary">{summary ?? (s ? null : <Skeleton w="70%" h={12} />)}</p>}
    </section>
  );
}

const pct = (part: number, whole: number, locale: string) => formatPercent(whole ? part / whole : 0, locale);

function Funnel({ s, range }: { s?: DashboardStats; range: RangeKey }) {
  const { t } = usePrefs();
  const c = useHomeCopy().numbers;
  const f = s?.funnel;
  const steps = f
    ? [
        { key: "registered", label: c.funnel.registered, value: f.registered, cls: "barlist__fill--lead" },
        { key: "verified", label: c.funnel.verified, value: f.verified, cls: "barlist__fill--lead" },
        { key: "quoted", label: c.funnel.quoted, value: f.quoted, cls: "barlist__fill--accent" },
      ]
    : [];
  return (
    <section className="panel" aria-labelledby="funnel-title">
      <div className="panel__head">
        <div>
          <h3 id="funnel-title" className="panel__title">
            {c.funnelTitle}
          </h3>
          <p className="panel__meta">{c.funnelMeta(c.rangeLong[range])}</p>
        </div>
      </div>
      {!f ? (
        <FakeBars />
      ) : f.registered === 0 ? (
        <p className="empty">{c.empty}</p>
      ) : (
        <ol className="barlist">
          {steps.map((step) => (
            <li key={step.key} className="barlist__row">
              <span className="barlist__label">{step.label}</span>
              <span className="barlist__value num">
                {formatNumber(step.value, t.locale)}
                {step.key !== "registered" && <small>{pct(step.value, f.registered, t.locale)}</small>}
              </span>
              <span className="barlist__track" aria-hidden="true">
                <span className={`barlist__fill ${step.cls}`} style={{ display: "block", width: `${(step.value / f.registered) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {f && f.registered > 0 && <p className="chart-summary">{c.funnelSummary(new Intl.NumberFormat(t.locale, { maximumFractionDigits: 0 }).format((f.quoted / f.registered) * 10))}</p>}
    </section>
  );
}

function Mix({ s, range }: { s?: DashboardStats; range: RangeKey }) {
  const { t } = usePrefs();
  const c = useHomeCopy().numbers;
  const [view, setView] = useState<"method" | "source">("method");
  const total = s?.newInRange ?? 0;
  const rows = !s
    ? []
    : view === "method"
      ? METHODS.map((m) => ({ key: m, label: t.method[m], value: s.byMethod[m], icon: <MethodIcon method={m} /> })).sort((a, b) => b.value - a.value)
      : s.bySource.map((x) => ({ key: x.source, label: t.source[x.source as keyof typeof t.source] ?? x.source, value: x.count, icon: null }));
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <section className="panel" aria-labelledby="mix-title">
      <div className="panel__head">
        <div>
          <h3 id="mix-title" className="panel__title">
            {c.mixTitle}
          </h3>
          <p className="panel__meta">{c.mixMeta(c.rangeLong[range])}</p>
        </div>
        <div className="segmented segmented--sm" role="group" aria-label={c.mixTitle}>
          <button type="button" aria-pressed={view === "method"} onClick={() => setView("method")}>
            {c.mixMethod}
          </button>
          <button type="button" aria-pressed={view === "source"} onClick={() => setView("source")}>
            {c.mixSource}
          </button>
        </div>
      </div>
      {!s ? (
        <FakeBars />
      ) : total === 0 ? (
        <p className="empty">{c.empty}</p>
      ) : (
        <ul className="barlist">
          {rows.slice(0, 4).map((r, i) => (
            <li key={r.key} className="barlist__row">
              <span className="barlist__label">
                {r.icon}
                {r.label}
              </span>
              <span className="barlist__value num">
                {formatNumber(r.value, t.locale)}
                <small>{pct(r.value, total, t.locale)}</small>
              </span>
              <span className="barlist__track" aria-hidden="true">
                <span className={`barlist__fill${i === 0 ? " barlist__fill--lead" : ""}`} style={{ display: "block", width: `${(r.value / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Latest({ s }: { s?: DashboardStats }) {
  const { t } = usePrefs();
  const c = useHomeCopy().numbers;
  return (
    <section className="panel" aria-labelledby="latest-title">
      <div className="panel__head">
        <div>
          <h3 id="latest-title" className="panel__title">
            {c.latestTitle}
          </h3>
          <p className="panel__meta">{c.latestMeta}</p>
        </div>
        <Link href="/usuarios" className="card-link">
          {c.viewAll}
          <IconChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {!s ? (
        <div className="rows" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="row">
              <Skeleton w={32} h={32} />
              <span className="row__main">
                <Skeleton w="60%" h={14} />
                <Skeleton w="40%" h={12} />
              </span>
            </div>
          ))}
        </div>
      ) : s.latest.length === 0 ? (
        <p className="empty">{c.empty}</p>
      ) : (
        <ul className="rows numbers__latest">
          {s.latest.slice(0, 6).map((u) => (
            <li key={u.id} className="row">
              <Avatar name={u.name} />
              <span className="row__main">
                <Link href={`/usuarios/${u.id}`}>{u.name}</Link>
                <span className="row__sub">{u.company ?? u.email}</span>
              </span>
              <span className="row__end numbers__latest-end">
                {u.status === "pending" ? <StatusBadge status="pending" /> : <MethodIcon method={u.method} />}
                <span className="numbers__time">{relativeTime(u.registeredAt, t.locale)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FakeBars() {
  return (
    <div className="barlist" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="barlist__row">
          <Skeleton w={140} h={14} />
          <Skeleton w={40} h={14} />
          <span className="barlist__track" />
        </div>
      ))}
    </div>
  );
}

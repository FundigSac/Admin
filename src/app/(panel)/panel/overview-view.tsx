"use client";

import { IconRefresh } from "@/components/ui/icons";
import Link from "next/link";
import { useState } from "react";
import { LineChart } from "@/components/charts/line-chart";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Avatar, MethodIcon, Skeleton, StatusBadge, TitleRow } from "@/components/ui/bits";
import { useToast } from "@/components/ui/toast";
import type { DashboardStats, RangeKey } from "@/lib/api";
import { useResendVerification, useStats } from "@/lib/api/queries";
import { formatDate, formatNumber, formatPercent, formatTime, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import type { SignupMethod } from "@/data/types";
import "./overview.css";

const RANGES: RangeKey[] = ["7d", "30d", "90d", "all"];
const METHODS: SignupMethod[] = ["google", "email", "facebook"];

export function OverviewView() {
  const { t, lang } = usePrefs();
  const [range, setRange] = useState<RangeKey>("30d");
  const stats = useStats(range);
  const s = stats.data;
  const o = t.overview;

  return (
    <>
      <TitleRow
        title={o.title}
        sub={s ? (s.pendingOver48h > 0 ? o.finding(s.pendingOver48h) : o.findingNone) : <Skeleton w={360} h={16} />}
        actions={
          <Link href="/usuarios?estado=pending" className="btn btn--primary">
            {o.review}
            {s && s.pending > 0 ? <span className="btn__count num">{s.pending}</span> : null}
          </Link>
        }
      />

      <div className="scope-row">
        <div className="segmented" role="group" aria-label={o.rangeLabel}>
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {o.range[r]}
            </button>
          ))}
        </div>
        <span className="stamp">
          {s ? o.updated(formatTime(s.generatedAt, t.locale)) : null}
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => stats.refetch()} aria-label={o.refresh} title={o.refresh} disabled={stats.isFetching}>
            <IconRefresh size={14} aria-hidden="true" className={stats.isFetching ? "is-spinning" : undefined} />
          </button>
        </span>
      </div>

      <div className="overview">
        <div className="overview__main stagger">
          <Kpis s={s} range={range} />
          <TrendCard s={s} range={range} />
          <div className="overview__pair">
            <FunnelCard s={s} range={range} />
            <MixCard s={s} range={range} />
          </div>
        </div>
        <aside className="overview__rail stagger" aria-label={`${o.pendingTitle} · ${o.latestTitle}`}>
          <PendingList s={s} />
          <LatestList s={s} lang={lang} />
        </aside>
      </div>
    </>
  );
}

function Kpis({ s, range }: { s?: DashboardStats; range: RangeKey }) {
  const { t } = usePrefs();
  const o = t.overview;
  const n = (v: number) => formatNumber(v, t.locale);
  const delta = s ? s.newInRange - s.newPrevRange : 0;
  const deltaText = !s ? null : range === "all" ? (
    o.noPrev
  ) : s.newPrevRange === 0 && s.newInRange > 0 ? (
    o.prevNew(s.newInRange)
  ) : (
    <>
      <span className={delta > 0 ? "is-good" : delta < 0 ? "is-bad" : undefined}>{delta > 0 ? `+${n(delta)}` : delta < 0 ? `−${n(-delta)}` : "0"}</span>
      {o.vsPrev(o.prevRange[range])}
    </>
  );

  const cells = [
    { label: o.newUsers, value: s?.newInRange, lead: true, caption: deltaText },
    { label: o.total, value: s?.total, caption: o.totalHint },
    {
      label: o.pending,
      value: s?.pending,
      caption: s ? <span className={s.pendingOver48h > 0 ? "is-bad" : undefined}>{o.pendingHint(s.pendingOver48h)}</span> : null,
    },
    { label: o.activeWeek, value: s?.activeWeek, caption: s ? o.activeHint(formatPercent(s.activeWeek / Math.max(1, s.total), t.locale)) : null },
  ];

  return (
    <section className="kpis" aria-label={o.title}>
      {cells.map((c) => (
        <div key={c.label} className="kpi">
          <p className="kpi__label">{c.label}</p>
          {c.value === undefined ? (
            <span className={`kpi__value${c.lead ? " kpi__value--lead" : ""}`}>
              <Skeleton w={56} h={c.lead ? 30 : 24} />
            </span>
          ) : (
            <span className={`kpi__value num${c.lead ? " kpi__value--lead" : ""}`}>
              <AnimatedNumber value={c.value} format={n} />
            </span>
          )}
          <p className="kpi__caption">{c.caption ?? <Skeleton w={120} h={12} />}</p>
        </div>
      ))}
    </section>
  );
}

function TrendCard({ s, range }: { s?: DashboardStats; range: RangeKey }) {
  const { t } = usePrefs();
  const o = t.overview;
  const [asTable, setAsTable] = useState(false);
  const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const points = (s?.series ?? []).map((p) => ({ x: formatDate(p.day, t.locale, short), y: p.count, full: formatDate(p.day, t.locale, { weekday: "short", day: "numeric", month: "long" }) }));
  const peak = Math.max(0, ...points.map((p) => p.y));

  return (
    <section className="panel" aria-labelledby="trend-title">
      <div className="panel__head">
        <div>
          <h2 id="trend-title" className="panel__title">
            {o.chartTitle}
          </h2>
          <p className="panel__meta">{s ? o.chartDesc(s.newInRange, o.rangeLong[range]) : <Skeleton w={160} h={12} />}</p>
        </div>
        <button type="button" className="card-link" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? o.chartHide : o.chartTable}
        </button>
      </div>
      {!s ? (
        <Skeleton h={220} />
      ) : asTable ? (
        <div className="chart-table">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{o.day}</th>
                <th scope="col" className="n">
                  {o.count}
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
        <LineChart points={points} label={o.chartAria(s.newInRange, o.rangeLong[range], peak)} valueLabel={o.chartPoint} />
      )}
    </section>
  );
}

function pct(part: number, whole: number, locale: string) {
  return formatPercent(whole ? part / whole : 0, locale);
}

/** Elemento propio de FUNDIGSAC: cuántas cuentas nuevas llegan a pedir una cotización de válvulas. */
function FunnelCard({ s, range }: { s?: DashboardStats; range: RangeKey }) {
  const { t } = usePrefs();
  const o = t.overview;
  const f = s?.funnel;
  const steps = f
    ? [
        { key: "registered", label: o.funnel.registered, value: f.registered, cls: "barlist__fill--lead" },
        { key: "verified", label: o.funnel.verified, value: f.verified, cls: "barlist__fill--lead" },
        { key: "quoted", label: o.funnel.quoted, value: f.quoted, cls: "barlist__fill--accent" },
      ]
    : [];
  return (
    <section className="panel" aria-labelledby="funnel-title">
      <div className="panel__head">
        <div>
          <h2 id="funnel-title" className="panel__title">
            {o.funnelTitle}
          </h2>
          <p className="panel__meta">{o.funnelDesc(o.rangeLong[range])}</p>
        </div>
      </div>
      {!f ? (
        <FakeBars />
      ) : f.registered === 0 ? (
        <p className="empty">{o.empty}</p>
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
                <span className={`grow-x barlist__fill ${step.cls}`} style={{ display: "block", width: `${(step.value / f.registered) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MixCard({ s, range }: { s?: DashboardStats; range: RangeKey }) {
  const { t } = usePrefs();
  const o = t.overview;
  const [view, setView] = useState<"method" | "source">("method");
  const total = s?.newInRange ?? 0;
  const rows = !s
    ? []
    : view === "method"
      ? METHODS.map((m) => ({ key: m, label: t.method[m], value: s.byMethod[m], icon: <MethodIcon method={m} /> })).sort((a, b) => b.value - a.value)
      : s.bySource.map((x) => ({ key: x.source, label: t.source[x.source as keyof typeof t.source], value: x.count, icon: null }));
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <section className="panel" aria-labelledby="mix-title">
      <div className="panel__head">
        <div>
          <h2 id="mix-title" className="panel__title">
            {o.mixTitle}
          </h2>
          <p className="panel__meta">{o.mixDesc(o.rangeLong[range])}</p>
        </div>
        <div className="segmented segmented--sm" role="group" aria-label={o.mixTitle}>
          <button type="button" aria-pressed={view === "method"} onClick={() => setView("method")}>
            {o.mixMethod}
          </button>
          <button type="button" aria-pressed={view === "source"} onClick={() => setView("source")}>
            {o.mixSource}
          </button>
        </div>
      </div>
      {!s ? (
        <FakeBars />
      ) : total === 0 ? (
        <p className="empty">{o.empty}</p>
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
                <span className={`grow-x barlist__fill${i === 0 ? " barlist__fill--lead" : ""}`} style={{ display: "block", width: `${(r.value / max) * 100}%` }} />
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

function PendingList({ s }: { s?: DashboardStats }) {
  const { t } = usePrefs();
  const o = t.overview;
  const toast = useToast();
  const resend = useResendVerification();
  const [sent, setSent] = useState<string[]>([]);

  return (
    <section aria-labelledby="pending-title">
      <div className="panel panel--list">
        <div className="panel__head panel__head--list">
          <h2 id="pending-title" className="panel__title">
            {o.pendingTitle}
          </h2>
        </div>
        {!s ? (
          <RowSkeletons n={3} />
        ) : s.pendingOldest.length === 0 ? (
          <p className="empty">{o.allVerified}</p>
        ) : (
          <ul className="rows">
            {s.pendingOldest.map((u) => (
              <li key={u.id} className="row">
                <Avatar name={u.name} />
                <span className="row__main">
                  <Link href={`/usuarios/${u.id}`}>{u.name}</Link>
                  <span className="row__sub">{o.waiting(relativeTime(u.registeredAt, t.locale))}</span>
                </span>
                <button
                  type="button"
                  className="btn"
                  aria-label={o.resendFor(u.name)}
                  disabled={sent.includes(u.id) || (resend.isPending && resend.variables === u.id)}
                  onClick={() =>
                    resend.mutate(u.id, {
                      onSuccess: () => {
                        setSent((list) => [...list, u.id]);
                        toast.success(t.toast.resent);
                      },
                    })
                  }
                >
                  {resend.isPending && resend.variables === u.id ? <span className="spinner" aria-hidden="true" /> : null}
                  {sent.includes(u.id) ? o.resent : o.resend}
                </button>
              </li>
            ))}
          </ul>
        )}
        {s && s.pending > s.pendingOldest.length && (
          <Link href="/usuarios?estado=pending" className="btn btn--block panel__foot-btn">
            {o.viewPending(s.pending)}
          </Link>
        )}
      </div>
    </section>
  );
}

function LatestList({ s, lang }: { s?: DashboardStats; lang: string }) {
  const { t } = usePrefs();
  const o = t.overview;
  return (
    <section aria-labelledby="latest-title" lang={lang === "es" ? "es" : "en"}>
      <div className="panel panel--list">
        <div className="panel__head panel__head--list">
          <h2 id="latest-title" className="panel__title">
            {o.latestTitle}
          </h2>
        </div>
        {!s ? (
          <RowSkeletons n={5} />
        ) : s.latest.length === 0 ? (
          <p className="empty">{o.empty}</p>
        ) : (
          <ul className="rows">
            {s.latest.slice(0, 5).map((u) => (
              <li key={u.id} className="row">
                <Avatar name={u.name} />
                <span className="row__main">
                  <Link href={`/usuarios/${u.id}`}>{u.name}</Link>
                  <span className="row__sub">{u.company ?? u.email}</span>
                </span>
                <span className="row__end">
                  {u.status === "pending" ? <StatusBadge status="pending" /> : <MethodIcon method={u.method} />}
                  <span className="row__time">{relativeTime(u.registeredAt, t.locale)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/usuarios" className="btn btn--block panel__foot-btn">
          {o.viewAll}
        </Link>
      </div>
    </section>
  );
}

function RowSkeletons({ n }: { n: number }) {
  return (
    <div className="rows" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="row">
          <Skeleton w={32} h={32} />
          <span className="row__main">
            <Skeleton w="60%" h={14} />
            <Skeleton w="40%" h={12} />
          </span>
        </div>
      ))}
    </div>
  );
}

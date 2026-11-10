"use client";

import { IconChevronRight, IconClose, IconFilter, IconRefresh } from "@/components/ui/icons";
import Link from "next/link";
import { useState } from "react";
import { ColumnChart } from "@/components/charts/column-chart";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { InfoTip } from "@/components/ui/info-tip";
import { Avatar, MethodIcon, RelTime, Skeleton, StatusBadge, TitleCount, TitleRow } from "@/components/ui/bits";
import { useToast } from "@/components/ui/toast";
import type { DashboardStats, RangeKey, StatsSegment } from "@/lib/api";
import { useCaseList, useQueueCounts, useResendVerification, useStats } from "@/lib/api/queries";
import { businessDaysLeft } from "@/lib/business-days";
import { DeadlineChip } from "@/components/cases/case-ui";
import { formatDate, formatNumber, formatPercent, formatTime, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import type { QuoteStatus, SignupMethod } from "@/data/types";
import "./overview.css";

const RANGES: RangeKey[] = ["7d", "30d", "90d", "all"];
const METHODS: SignupMethod[] = ["google", "email", "facebook"];

export function OverviewView() {
  const { t, lang } = usePrefs();
  const [range, setRange] = useState<RangeKey>("30d");
  // B4-1: un KPI pulsado limita el gráfico y los últimos registros a su subconjunto.
  const [segment, setSegment] = useState<StatsSegment | null>(null);
  const clearSegment = () => {
    const was = segment;
    setSegment(null);
    // El botón «Quitar filtro» desaparece: el foco vuelve al KPI que aplicó el filtro.
    if (was) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-segment="${was}"]`)?.focus());
  };
  const stats = useStats(range);
  const s = stats.data;
  const o = t.overview;
  const queues = useQueueCounts();
  // Un plazo legal a 3 días hábiles o menos manda sobre todo lo demás: es el hallazgo y la acción de la pantalla.
  const urgent = queues.data?.due.find((d) => businessDaysLeft(d.dueAt) <= 3) ?? null;
  const urgentHref = urgent ? `/${urgent.module === "claims" ? "reclamaciones" : "privacidad"}/${urgent.id}` : null;

  return (
    <>
      <TitleRow
        className="overview-head"
        title={o.title}
        sub={
          urgent ? (
            <span className={businessDaysLeft(urgent.dueAt) < 0 ? "is-bad-soft" : "is-warn-soft"}>{o.dueFinding(urgent.code, t.cases.nav[urgent.module], businessDaysLeft(urgent.dueAt))}</span>
          ) : s ? (
            s.pendingOver48h > 0 ? o.finding(s.pendingOver48h) : o.findingNone
          ) : (
            <Skeleton w={360} h={16} />
          )
        }
        actions={
          urgent && urgentHref ? (
            <Link href={urgentHref} className="btn btn--primary">
              {o.openCase}
            </Link>
          ) : (
            <Link href="/usuarios?estado=pending" className="btn btn--primary">
              {o.review}
              {s && s.pending > 0 ? <span className="btn__count num">{s.pending}</span> : null}
            </Link>
          )
        }
      />

      <TodayStrip pending={s?.pending} />

      <div className="scope-row">
        <div className="segmented" role="group" aria-label={o.rangeLabel}>
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {o.range[r]}
            </button>
          ))}
        </div>
        <div className="seg-filter" role="status">
          {segment && (
            <>
              <span className="seg-filter__label">
                <IconFilter size={14} />
                {o.filterOn(o.segment[segment])}
              </span>
              <button type="button" className="btn seg-filter__clear" onClick={clearSegment}>
                <IconClose size={14} />
                {o.clearFilter}
              </button>
            </>
          )}
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
          <Kpis s={s} range={range} segment={segment} onSegment={(seg) => (seg === segment ? clearSegment() : setSegment(seg))} />
          <TrendCard s={s} range={range} segment={segment} />
          <div className="overview__pair">
            <FunnelCard s={s} range={range} />
            <MixCard s={s} range={range} />
          </div>
          <QuoteStagesCard />
        </div>
        <aside className="overview__rail stagger" aria-label={`${o.pendingTitle} · ${o.latestTitle}`}>
          <DueList />
          <PendingList s={s} />
          <LatestList s={s} lang={lang} segment={segment} />
        </aside>
      </div>
    </>
  );
}

function Kpis({ s, range, segment, onSegment }: { s?: DashboardStats; range: RangeKey; segment: StatsSegment | null; onSegment: (seg: StatsSegment) => void }) {
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

  const cells: { label: string; help: string; value?: number; lead?: boolean; caption: React.ReactNode; seg?: StatsSegment }[] = [
    { label: o.newUsers, help: o.help.newUsers, value: s?.newInRange, lead: true, caption: deltaText },
    { label: o.total, help: o.help.total, value: s?.total, caption: o.totalHint },
    {
      label: o.pending,
      help: o.help.pending,
      value: s?.pending,
      seg: "pending",
      caption: s ? <span className={s.pendingOver48h > 0 ? "is-bad" : undefined}>{o.pendingHint(s.pendingOver48h)}</span> : null,
    },
    { label: o.activeWeek, help: o.help.activeWeek, value: s?.activeWeek, seg: "active", caption: s ? o.activeHint(formatPercent(s.activeWeek / Math.max(1, s.total), t.locale)) : null },
  ];

  return (
    <section className="kpis" aria-label={o.title}>
      {cells.map((c) => {
        const body = (
          <>
            {c.value === undefined ? (
              <span className={`kpi__value${c.lead ? " kpi__value--lead" : ""}`}>
                <Skeleton w={56} h={c.lead ? 30 : 24} />
              </span>
            ) : (
              <span className={`kpi__value num${c.lead ? " kpi__value--lead" : ""}`}>
                <AnimatedNumber value={c.value} format={n} />
              </span>
            )}
            <span className="kpi__caption">{c.caption ?? <Skeleton w={120} h={12} />}</span>
          </>
        );
        const on = !!c.seg && segment === c.seg;
        return (
          <div key={c.label} className={`kpi${c.seg ? " kpi--filter" : ""}${on ? " is-on" : ""}`}>
            <p className="kpi__label">
              {c.label} <InfoTip label={o.what(c.label)} text={c.help} />
            </p>
            {c.seg ? (
              // La cifra y su texto son el botón; la etiqueta queda fuera porque lleva su propio botón de ayuda.
              <button type="button" className="kpi__filter" aria-pressed={on} data-segment={c.seg} disabled={!s} onClick={() => onSegment(c.seg!)}>
                <span className="sr-only">{o.kpiFilter(c.label)}: </span>
                {body}
                {/* Siempre presente (misma altura pulsado o no): «Filtrar» invita, «Filtro aplicado» confirma. */}
                <span className={`kpi__state${on ? " is-on" : ""}`} aria-hidden="true">
                  <IconFilter size={12} />
                  {on ? o.filtering : o.filterHint}
                </span>
              </button>
            ) : (
              body
            )}
          </div>
        );
      })}
    </section>
  );
}

function TrendCard({ s, range, segment }: { s?: DashboardStats; range: RangeKey; segment: StatsSegment | null }) {
  const { t } = usePrefs();
  const o = t.overview;
  const [asTable, setAsTable] = useState(false);
  const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const series = (segment ? s?.segments[segment].series : s?.series) ?? [];
  const total = segment ? series.reduce((a, p) => a + p.count, 0) : (s?.newInRange ?? 0);
  const points = series.map((p) => ({ x: formatDate(p.day, t.locale, short), y: p.count, full: formatDate(p.day, t.locale, { weekday: "short", day: "numeric", month: "long" }) }));
  const peak = Math.max(0, ...points.map((p) => p.y));
  const peakIndex = points.findIndex((p) => p.y === peak);
  const avg = new Intl.NumberFormat(t.locale, { maximumFractionDigits: 1 }).format(points.length ? points.reduce((a, p) => a + p.y, 0) / points.length : 0);
  const summary = s && peak > 0 && peakIndex >= 0 ? o.chartSummary(avg, peak, formatDate(series[peakIndex].day, t.locale, { day: "numeric", month: "long" })) : null;

  return (
    <section className="panel" aria-labelledby="trend-title">
      <div className="panel__head">
        <div>
          <h2 id="trend-title" className="panel__title">
            {o.chartTitle} <InfoTip label={o.what(o.chartTitle)} text={o.help.chart} />
          </h2>
          <p className="panel__meta" data-segment-meta={segment ?? undefined}>
            {!s ? <Skeleton w={160} h={12} /> : segment ? o.chartDescSeg(total, o.segment[segment], o.rangeLong[range]) : o.chartDesc(total, o.rangeLong[range])}
          </p>
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
        <ColumnChart points={points} label={o.chartAria(total, o.rangeLong[range], peak)} valueLabel={o.chartPoint} meanLabel={o.chartMean(avg)} />
      )}
      {!asTable && <p className="chart-summary">{summary ?? (s ? null : <Skeleton w="70%" h={12} />)}</p>}
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
            {o.funnelTitle} <InfoTip label={o.what(o.funnelTitle)} text={o.help.funnel} />
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
      {f && f.registered > 0 && <p className="chart-summary">{o.funnelSummary(new Intl.NumberFormat(t.locale, { maximumFractionDigits: 0 }).format((f.quoted / f.registered) * 10))}</p>}
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
            {o.mixTitle} <InfoTip label={o.what(o.mixTitle)} text={o.help.mix} />
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

const QUOTE_STAGES: QuoteStatus[] = ["new", "reviewing", "sent", "won"];

/**
 * B2-2: las cotizaciones de hoy en cada etapa (Nueva, En revisión, Cotizada, Ganada), con su conteo y su parte del
 * total. Sale de los estados que ya existen; no muestra montos en S/ porque el pedido de cotización no los guarda.
 */
function QuoteStagesCard() {
  const { t } = usePrefs();
  const o = t.overview;
  const q = t.cases.quotes;
  const list = useCaseList("quotes", { page: 0, size: 1 });
  if (list.isError) return null;
  const counts = list.data?.statusCounts;
  const all = counts?.all ?? 0;
  return (
    <section className="panel" aria-labelledby="stages-title">
      <div className="panel__head">
        <div>
          <h2 id="stages-title" className="panel__title">
            {o.quoteStagesTitle}
            <TitleCount n={counts ? all : undefined} /> <InfoTip label={o.what(o.quoteStagesTitle)} text={o.help.quoteStages} />
          </h2>
          <p className="panel__meta">{o.quoteStagesDesc}</p>
        </div>
      </div>
      {!counts ? (
        <FakeBars />
      ) : all === 0 ? (
        <p className="empty">{q.empty.title}</p>
      ) : (
        <>
          <ol className="barlist stages">
            {QUOTE_STAGES.map((st, i) => {
              const v = counts[st] ?? 0;
              return (
                <li key={st} className="barlist__row" data-stage={st}>
                  <Link className="barlist__label stages__link" href={`/cotizaciones?estado=${st}`} title={o.quoteStagesOpen(q.status[st])}>
                    <span className="stages__step num" aria-hidden="true">
                      {i + 1}
                    </span>
                    {q.status[st]}
                  </Link>
                  <span className="barlist__value num">
                    {formatNumber(v, t.locale)}
                    <small>{o.quoteStagesOf(pct(v, all, t.locale))}</small>
                  </span>
                  <span className="barlist__track" aria-hidden="true">
                    <span className={`grow-x barlist__fill${st === "won" ? " barlist__fill--accent" : " barlist__fill--lead"}`} style={{ display: "block", width: `${(v / all) * 100}%` }} />
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="chart-summary">
            {o.quoteStagesSummary(new Intl.NumberFormat(t.locale, { maximumFractionDigits: 0 }).format(((counts.won ?? 0) / all) * 10))}{" "}
            <Link className="link" href="/cotizaciones?estado=lost">
              {o.quoteStagesLost(counts.lost ?? 0)}
            </Link>
          </p>
        </>
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

/** Lo pendiente en palabras simples, cada cosa con su enlace: se entiende sin leer ninguna cifra más.
 *  Siempre muestra las cinco colas (las que están en 0 se ven atenuadas): así la lista mide lo mismo cargando y
 *  cargada, y el resto del resumen no salta cuando llegan los datos. */
function TodayStrip({ pending }: { pending?: number }) {
  const { t } = usePrefs();
  const o = t.overview;
  const q = useQueueCounts().data;
  const ready = !!q && pending !== undefined;
  const items = [
    { key: "pending", n: pending ?? 0, text: o.today.pending, href: "/usuarios?estado=pending" },
    { key: "claims", n: q?.claims ?? 0, text: o.today.claims, href: "/reclamaciones" },
    { key: "quotes", n: q?.quotes ?? 0, text: o.today.quotes, href: "/cotizaciones?estado=new" },
    { key: "inquiries", n: q?.inquiries ?? 0, text: o.today.inquiries, href: "/consultas?estado=new" },
    { key: "privacy", n: q?.privacy ?? 0, text: o.today.privacy, href: "/privacidad" },
  ];
  const allClear = ready && items.every((i) => i.n === 0);
  return (
    <nav className="today" aria-label={o.today.title} aria-busy={!ready}>
      <p className="today__title">
        <span className="label-caps">{o.today.title}</span>
        {allClear && <span className="today__none">{o.today.none}</span>}
      </p>
      <ul className="today__list">
        {items.map(({ key, n, text, href }) => (
          <li key={key}>
            {ready ? (
              // La cifra va en su columna: el texto la repite solo para lectores de pantalla.
              <Link href={href} className={`today__item${n === 0 ? " today__item--zero" : ""}`}>
                <span className="today__n num" aria-hidden="true">{n}</span>
                <span>
                  <span className="sr-only">{n} </span>
                  {text(n).slice(String(n).length + 1)}
                </span>
                <IconChevronRight size={14} className="today__go" />
              </Link>
            ) : (
              <span className="today__item" aria-hidden="true">
                <Skeleton w={16} h={20} />
                <Skeleton w="55%" h={14} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DueList() {
  const { t } = usePrefs();
  const o = t.overview;
  const queues = useQueueCounts();
  const due = queues.data?.due ?? [];
  if (queues.data && due.length === 0) return null;
  return (
    <section aria-labelledby="due-title">
      <div className="panel panel--list">
        <div className="panel__head panel__head--list">
          <h2 id="due-title" className="panel__title">
            {o.dueTitle}
            <TitleCount n={queues.data?.due.length} /> <InfoTip label={o.what(o.dueTitle)} text={o.help.due} />
          </h2>
        </div>
        {!queues.data ? (
          <RowSkeletons n={2} />
        ) : (
          <ul className="rows">
            {due.slice(0, 4).map((d) => (
              <li key={d.id} className="row">
                <span className="row__main">
                  <Link href={`/${d.module === "claims" ? "reclamaciones" : "privacidad"}/${d.id}`}>{d.name}</Link>
                  <span className="row__sub">
                    {t.cases.nav[d.module]} · <span className="code">{d.code}</span>
                  </span>
                </span>
                <DeadlineChip dueAt={d.dueAt} closed={false} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
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
            <TitleCount n={s?.pending} /> <InfoTip label={o.what(o.pendingTitle)} text={o.help.pendingList} />
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

function LatestList({ s, lang, segment }: { s?: DashboardStats; lang: string; segment: StatsSegment | null }) {
  const { t } = usePrefs();
  const o = t.overview;
  const latest = (segment ? s?.segments[segment].latest : s?.latest) ?? [];
  return (
    <section aria-labelledby="latest-title" lang={lang === "es" ? "es" : "en"}>
      <div className="panel panel--list">
        <div className="panel__head panel__head--list">
          <h2 id="latest-title" className="panel__title">
            {segment ? o.latestTitleSeg[segment] : o.latestTitle} <InfoTip label={o.what(o.latestTitle)} text={o.help.latest} />
          </h2>
        </div>
        {!s ? (
          <RowSkeletons n={5} />
        ) : latest.length === 0 ? (
          <p className="empty">{segment ? o.emptySeg : o.empty}</p>
        ) : (
          <ul className="rows">
            {latest.slice(0, 5).map((u) => (
              <li key={u.id} className="row">
                <Avatar name={u.name} />
                <span className="row__main">
                  <Link href={`/usuarios/${u.id}`}>{u.name}</Link>
                  <span className="row__sub">{u.company ?? u.email}</span>
                </span>
                <span className="row__end">
                  {u.status === "pending" ? <StatusBadge status="pending" /> : <MethodIcon method={u.method} />}
                  <RelTime className="row__time" at={u.registeredAt} />
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

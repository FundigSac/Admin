"use client";

import { IconAlert, IconChevronLeft, IconChevronRight, IconClock } from "@/components/ui/icons";
import type { CaseEvent } from "@/data/types";
import { businessDaysLeft } from "@/lib/business-days";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { useT } from "@/lib/prefs";
import "./cases.css";

export type Tone = "todo" | "progress" | "done" | "muted";

/** Estado del caso: tinte pálido con tinta del mismo tono; el texto siempre acompaña al color. */
export function CasePill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`pill pill--${tone}`}>
      <span className="pill__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Plazo legal en días hábiles: gris si sobra tiempo, ámbar a 3 días o menos, rojo si venció. */
export function DeadlineChip({ dueAt, closed, compact }: { dueAt: number; closed: boolean; compact?: boolean }) {
  const t = useT();
  const d = t.cases.due;
  if (closed) return <span className="deadline deadline--closed">{compact ? "—" : d.dueOn(formatDate(dueAt, t.locale))}</span>;
  const left = businessDaysLeft(dueAt);
  const tone = left < 0 ? "late" : left <= 3 ? "soon" : "ok";
  const label = left < 0 ? d.overdue(left) : left === 0 ? d.today : d.left(left);
  return (
    <span className={`deadline deadline--${tone}`} title={d.dueOn(formatDate(dueAt, t.locale))}>
      {tone === "ok" ? <IconClock size={14} /> : <IconAlert size={14} />}
      {label}
    </span>
  );
}

export function Timeline({ events }: { events: CaseEvent[] }) {
  const t = useT();
  const sorted = [...events].sort((a, b) => b.at - a.at);
  return (
    <ol className="timeline">
      {sorted.map((e, i) => {
        const tpl = t.cases.events[e.label];
        const label = typeof tpl === "function" ? tpl(e.note ?? "") : (tpl ?? e.label);
        return (
          <li key={`${e.at}-${i}`} className="timeline__item">
            <span className="timeline__dot" aria-hidden="true" />
            <div>
              <p className="timeline__label">{label}</p>
              {e.label === "note" && e.note && <p className="timeline__note">{e.note}</p>}
              <p className="timeline__meta">
                <time dateTime={new Date(e.at).toISOString()} title={formatDateTime(e.at, t.locale)}>
                  {relativeTime(e.at, t.locale)}
                </time>
                {" · "}
                {e.actor ?? t.cases.common.system}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Par etiqueta-valor; un valor ausente se muestra como un guion gris. */
export function Field({ label, children, wide }: { label: string; children?: React.ReactNode; wide?: boolean }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className={`kv${wide ? " kv--wide" : ""}`}>
      <dt>{label}</dt>
      <dd className={empty ? "kv__empty" : undefined}>{empty ? "—" : children}</dd>
    </div>
  );
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const t = useT();
  if (totalPages <= 1) return null;
  return (
    <nav className="pager" aria-label={t.cases.common.page(page + 1, totalPages)}>
      <button type="button" className="icon-btn icon-btn--outline" onClick={() => onPage(page - 1)} disabled={page === 0} aria-label={t.cases.common.prev}>
        <IconChevronLeft size={16} />
      </button>
      <span className="pager__label">{t.cases.common.page(page + 1, totalPages)}</span>
      <button type="button" className="icon-btn icon-btn--outline" onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1} aria-label={t.cases.common.next}>
        <IconChevronRight size={16} />
      </button>
    </nav>
  );
}

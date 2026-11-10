"use client";

import { IconChevronLeft, IconChevronRight, IconOnTime, IconOverdue, IconWarning } from "@/components/ui/icons";
import type { CaseEvent } from "@/data/types";
import { businessDaysLeft } from "@/lib/business-days";
import { RelTime } from "@/components/ui/bits";
import { formatDate } from "@/lib/format";
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

export type DeadlineState = "ok" | "soon" | "late";

/** En plazo con más de 3 días hábiles, vence pronto a 3 o menos (incluido el último día), vencido después. */
export function deadlineState(left: number): DeadlineState {
  return left < 0 ? "late" : left <= 3 ? "soon" : "ok";
}

const DEADLINE_ICON = { ok: IconOnTime, soon: IconWarning, late: IconOverdue } as const;

/**
 * Plazo legal en días hábiles (X12-1): "En plazo / Vence pronto / Vencido" con ícono de forma propia (círculo,
 * triángulo, octágono), un marco que crece con la urgencia (sin marco, contorno, relleno) y el texto. El color
 * refuerza, pero quien no lo distingue lee el mismo estado.
 */
export function DeadlineChip({ dueAt, closed, compact }: { dueAt: number; closed: boolean; compact?: boolean }) {
  const t = useT();
  const d = t.cases.due;
  if (closed) return <span className="deadline deadline--closed">{compact ? "—" : d.dueOn(formatDate(dueAt, t.locale))}</span>;
  const left = businessDaysLeft(dueAt);
  const state = deadlineState(left);
  const detail = left < 0 ? d.overdue(left) : left === 0 ? d.today : d.left(left);
  const short = left < 0 ? d.overdueShort(left) : left === 0 ? d.todayShort : d.leftShort(left);
  const Icon = DEADLINE_ICON[state];
  return (
    <span className={`deadline deadline--${state}`} data-state={state} title={`${d.state[state]}: ${detail}. ${d.dueOn(formatDate(dueAt, t.locale))}`}>
      <Icon size={14} className="deadline__icon" />
      <span className="deadline__state">{d.state[state]}</span>
      {/* Separador en el texto (no en CSS) para que el lector de pantalla no junte las dos partes. */}
      <span className="deadline__detail">· {compact ? short : detail}</span>
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
                <RelTime at={e.at} />
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

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { CasePill, Pager, type Tone } from "@/components/cases/case-ui";
import { Skeleton } from "@/components/ui/bits";
import { IconArrowRight, IconLegal, IconSearch } from "@/components/ui/icons";
import type { CaseMap, CaseModule, CaseSort } from "@/lib/api";
import { useCaseList } from "@/lib/api/queries";
import { usePrefs } from "@/lib/prefs";
import { useRequestsCopy } from "./copy";
import { BASE, useChanged, useNextRequest } from "./queues";
import "./requests.css";

export type RequestColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Identidad de la fila: en teléfono encabeza la tarjeta a todo el ancho. */
  primary?: boolean;
  /** En teléfono se antepone el rótulo ("Plazo: …"). */
  labelled?: boolean;
  /** Se oculta cuando la tabla es angosta (tableta) y en la tarjeta del teléfono. */
  optional?: boolean;
  className?: string;
};

export type Stage = { value: string; label: string; hint: string; tone: Tone };

type Props<M extends CaseModule> = {
  module: M;
  title: string;
  purpose: string;
  stages: Stage[];
  columns: RequestColumn<CaseMap[M]>[];
  defaultSort?: CaseSort;
  /** La siguiente por atender: quién, qué pide y desde cuándo espera o cuándo vence. */
  next: (row: CaseMap[M]) => { who: React.ReactNode; what: React.ReactNode; when: React.ReactNode };
  none: string;
  /** Base legal y plazos: quedan a la vista bajo la lista. */
  legal?: React.ReactNode;
};

/**
 * Bandeja de solicitudes. De arriba abajo responde tres preguntas: qué es esta lista, cuál atiendo ahora (un solo
 * botón principal, "Atender la siguiente") y en qué etapa está cada una. La tabla pasa a tarjetas en teléfono.
 */
export function RequestList<M extends CaseModule>({ module, title, purpose, stages, columns, defaultSort = "newest", next, none, legal }: Props<M>) {
  const { t } = usePrefs();
  const c = useRequestsCopy().common;
  const base = BASE[module];
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("estado") ?? "all";
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<CaseSort>(defaultSort);
  const [page, setPage] = useState(0);
  const query = useDeferredValue(q.trim());
  const list = useCaseList(module, { page, size: 12, q: query || undefined, status, sort });
  const data = list.data;
  const upNext = useNextRequest(module);

  // Las filas nuevas se asientan cuando cambian por un filtro, una búsqueda u otra página; al llegar, quietas.
  const rowsKey = data ? `${data.page}:${data.items.map((x) => x.id).join(",")}` : null;
  const settle = useChanged(rowsKey);

  const all: Stage = { value: "all", label: c.all, hint: c.allHint, tone: "muted" };
  const options = [all, ...stages];
  const current = options.find((s) => s.value === status) ?? all;

  const setStatus = (value: string) => {
    setPage(0);
    router.replace(value === "all" ? base : `${base}?estado=${value}`, { scroll: false });
  };
  const reset = () => {
    setQ("");
    setStatus("all");
  };

  const n = upNext.item ? { ...next(upNext.item), code: upNext.item.code } : null;

  return (
    <div className="rq">
      <header className="rq-head">
        <h1 className="rq-head__title">{title}</h1>
        <p className="rq-head__purpose">{purpose}</p>
      </header>

      <section className={`rq-next${upNext.item ? "" : " rq-next--clear"}`} aria-labelledby={`${module}-next`}>
        <div className="rq-next__body">
          <h2 id={`${module}-next`} className="rq-next__title">
            {c.nextTitle}
          </h2>
          {n ? (
            <div className="rq-next__item">
              <p className="rq-next__who">
                <span className="code">{n.code}</span>
                <strong>{n.who}</strong>
              </p>
              <p className="rq-next__what">{n.what}</p>
              <p className="rq-next__when">{n.when}</p>
            </div>
          ) : upNext.ready ? (
            <p className="rq-next__none">{none}</p>
          ) : (
            <div className="rq-next__item" aria-hidden="true">
              <Skeleton w="min(420px, 80%)" h={18} />
              <Skeleton w="min(300px, 60%)" h={14} />
            </div>
          )}
        </div>
        {upNext.item && (
          <Link href={`${base}/${upNext.item.id}`} className="btn btn--primary btn--lg rq-next__go">
            {c.attendNext}
            <IconArrowRight size={18} />
          </Link>
        )}
      </section>

      <div className="rq-stages" role="group" aria-label={c.stagesLabel}>
        {options.map((s) => (
          <button key={s.value} type="button" className="rq-stage" aria-pressed={status === s.value} onClick={() => setStatus(s.value)}>
            <span className="rq-stage__label">{s.value === "all" ? <span className="rq-stage__plain">{s.label}</span> : <CasePill tone={s.tone}>{s.label}</CasePill>}</span>
            <span className="rq-stage__count num">{data ? (data.statusCounts[s.value] ?? 0) : "·"}</span>
            <span className="rq-stage__hint">{s.hint}</span>
          </button>
        ))}
      </div>
      <p className="rq-stage-note" aria-live="polite">
        {current.value === "all" ? c.allHint : `${current.label}: ${current.hint}`}
      </p>

      <div className="rq-tools">
        <label className="rq-tools__search">
          <span className="sr-only">{c.search}</span>
          <IconSearch size={16} className="rq-tools__icon" />
          <input
            className="input"
            type="search"
            name="q"
            placeholder={c.search}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <div className="rq-tools__end">
          <span className="rq-tools__count" aria-live="polite">
            {data ? c.results(data.totalItems) : ""}
          </span>
          <label className="sr-only" htmlFor={`${module}-sort`}>
            {c.sort}
          </label>
          <select id={`${module}-sort`} className="select" value={sort} onChange={(e) => setSort(e.target.value as CaseSort)}>
            {(Object.keys(t.cases.common.sortOpt) as CaseSort[]).map((k) => (
              <option key={k} value={k}>
                {t.cases.common.sortOpt[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {list.isError && !data ? (
        <div className="empty rq-empty" role="alert">
          <strong>{c.loadError}</strong>
          <button type="button" className="btn" onClick={() => list.refetch()}>
            {c.retry}
          </button>
        </div>
      ) : !data ? (
        <div className="rq-skel" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rq-skel__row">
              <Skeleton w="34%" h={16} />
              <Skeleton w="22%" h={14} />
              <Skeleton w={84} h={14} />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="empty rq-empty">
          <strong>{c.emptyTitle}</strong>
          <p>{c.emptyText}</p>
          <button type="button" className="btn" onClick={reset}>
            {c.showAll}
          </button>
        </div>
      ) : (
        <>
          <div className="rq-table-wrap">
            <table className="table table--cards rq-table" role="table" aria-label={title}>
              <thead role="rowgroup">
                <tr role="row">
                  {columns.map((col) => (
                    <th key={col.key} scope="col" role="columnheader" className={[col.className, col.optional ? "rq-optional" : ""].filter(Boolean).join(" ") || undefined}>
                      {col.header}
                    </th>
                  ))}
                  <th scope="col" role="columnheader" className="rq-table__action">
                    <span className="sr-only">{c.actionsCol}</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup" key={rowsKey ?? "rows"} data-settle={settle ? "" : undefined}>
                {data.items.map((row, i) => {
                  const href = `${base}/${row.id}`;
                  return (
                    <tr key={row.id} role="row" className="rq-row" style={{ "--i": Math.min(i, 4) } as React.CSSProperties} onClick={() => router.push(href)}>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          role="cell"
                          className={[col.className, col.optional ? "rq-optional" : ""].filter(Boolean).join(" ") || undefined}
                          data-primary={col.primary ? "" : undefined}
                          data-label={col.labelled ? col.header : undefined}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                      <td role="cell" data-action="" className="rq-table__action">
                        <Link href={href} className="btn" aria-label={c.openLabel(row.code)} onClick={(e) => e.stopPropagation()}>
                          {c.open}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </>
      )}

      {legal && (
        // El texto aprobado ya empieza con "Base legal:"; el rótulo queda para lectores de pantalla.
        <aside className="rq-legal" aria-label={c.legalTitle}>
          <IconLegal size={20} />
          <div>{legal}</div>
        </aside>
      )}
    </div>
  );
}

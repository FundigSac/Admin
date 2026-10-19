"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { Skeleton, TitleRow } from "@/components/ui/bits";
import { IconInfo, IconSearch } from "@/components/ui/icons";
import type { CaseMap, CaseModule, CaseSort } from "@/lib/api";
import { useCaseList } from "@/lib/api/queries";
import { usePrefs } from "@/lib/prefs";
import { Pager } from "./case-ui";
import "./cases.css";

export type Column<T> = { key: string; header: string; className?: string; render: (row: T) => React.ReactNode };

type Props<M extends CaseModule> = {
  module: M;
  base: string;
  title: string;
  lead: string;
  finding?: React.ReactNode;
  statuses: { value: string; label: string }[];
  columns: Column<CaseMap[M]>[];
  /** Fila en dos líneas para teléfono: identidad y estado arriba, el resto abajo. */
  mobile: (row: CaseMap[M]) => { title: React.ReactNode; end: React.ReactNode; sub: React.ReactNode };
  defaultSort?: CaseSort;
  actions?: React.ReactNode;
  /** Referencia bajo la lista (procedimiento, base legal): lo que el equipo consulta mientras atiende. */
  after?: React.ReactNode;
  /** Qué significa cada estado, en una frase; se muestra al filtrar por ese estado. */
  hints?: Record<string, string>;
};

/** Pantalla de cola: pestañas por estado con conteos, búsqueda, orden, tabla en escritorio y lista en teléfono. */
export function CaseList<M extends CaseModule>({ module, base, title, lead, finding, statuses, columns, mobile, defaultSort = "newest", actions, after, hints }: Props<M>) {
  const { t } = usePrefs();
  const c = t.cases.common;
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("estado") ?? "all";
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<CaseSort>(defaultSort);
  const [page, setPage] = useState(0);
  const query = useDeferredValue(q.trim());
  const list = useCaseList(module, { page, size: 12, q: query || undefined, status, sort });
  const data = list.data;

  const setStatus = (value: string) => {
    setPage(0);
    router.replace(value === "all" ? base : `${base}?estado=${value}`, { scroll: false });
  };

  return (
    <>
      <TitleRow title={title} sub={finding ?? lead} actions={actions} />

      <label className="sr-only" htmlFor={`${module}-status`}>
        {c.status}
      </label>
      <select id={`${module}-status`} className="select status-select" value={status} onChange={(e) => setStatus(e.target.value)}>
        {[{ value: "all", label: c.all }, ...statuses].map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
            {data ? ` (${data.statusCounts[s.value] ?? 0})` : ""}
          </option>
        ))}
      </select>

      <div className="tabs status-tabs" role="tablist" aria-label={c.status}>
        {[{ value: "all", label: c.all }, ...statuses].map((s) => (
          <button key={s.value} type="button" role="tab" className="tabs__tab" aria-selected={status === s.value} onClick={() => setStatus(s.value)}>
            {s.label}
            <span className="tabs__count">{data ? (data.statusCounts[s.value] ?? 0) : "·"}</span>
          </button>
        ))}
      </div>

      {status !== "all" && hints?.[status] && (
        <p className="status-hint fade-in" key={status}>
          <IconInfo size={16} />
          {hints[status]}
        </p>
      )}

      <div className="toolbar">
        <label className="toolbar__search">
          <span className="sr-only">{c.search}</span>
          <IconSearch size={15} className="toolbar__icon" />
          <input
            className="input input--sm"
            type="search"
            placeholder={c.search}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <div className="toolbar__end">
          <span className="toolbar__count" aria-live="polite">
            {data ? c.results(data.totalItems) : ""}
          </span>
          <label className="sr-only" htmlFor={`${module}-sort`}>
            {c.sort}
          </label>
          <select id={`${module}-sort`} className="select select--sm" value={sort} onChange={(e) => setSort(e.target.value as CaseSort)}>
            {(Object.keys(c.sortOpt) as CaseSort[]).map((k) => (
              <option key={k} value={k}>
                {c.sortOpt[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!data ? (
        <div className="case-table" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="case-skel">
              <Skeleton w={110} h={14} />
              <Skeleton w="36%" h={14} />
              <Skeleton w={90} h={22} />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="empty case-empty">
          <strong>{c.emptyTitle}</strong>
          <span>{c.emptyText}</span>
        </div>
      ) : (
        <>
          <div className="table-frame case-table">
          <table className="table" key={`${status}-${page}-${query}`}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} scope="col" className={col.className}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="fade-in">
              {data.items.map((row) => (
                <tr key={row.id} className="case-row" onClick={() => router.push(`${base}/${row.id}`)}>
                  {columns.map((col, i) => (
                    <td key={col.key} className={col.className}>
                      {i === 0 ? (
                        <Link href={`${base}/${row.id}`} className="case-row__link" onClick={(e) => e.stopPropagation()}>
                          {col.render(row)}
                        </Link>
                      ) : (
                        col.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <ul className="case-cards fade-in">
            {data.items.map((row) => {
              const m = mobile(row);
              return (
                <li key={row.id}>
                  <Link href={`${base}/${row.id}`} className="case-card">
                    <span className="case-card__top">
                      <strong>{m.title}</strong>
                      {m.end}
                    </span>
                    <span className="case-card__sub">{m.sub}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </>
      )}
      {after && <div className="case-after">{after}</div>}
    </>
  );
}

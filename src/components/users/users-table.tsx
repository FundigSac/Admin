"use client";

import { createColumnHelper, rowSelectionFeature, rowSortingFeature, tableFeatures, useTable, type RowSelectionState, type SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { Avatar } from "@/components/ui/bits";
import { IconArrowRight, IconSortDown, IconSortUp } from "@/components/ui/icons";
import type { User } from "@/data/types";
import { formatDate, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { AccountStatus, useJobLabel } from "./account-bits";
import { useUsersCopy } from "./users-copy";

// Tabla de Cuentas (brief de diseño §6.5). Desde 721 px es una tabla semántica de filas de 56 px con el botón
// "Abrir" al final; hasta 720 px cada fila se dibuja como tarjeta con cuatro datos (persona, estado, puesto y fecha)
// sin duplicar el marcado. TanStack Table resuelve selección y orden; el orden y las páginas los aplica el origen de
// datos (manualSorting), así la misma tabla sirve con miles de cuentas del Backend.

type Meta = {
  className?: string;
  /** Rótulo que la tarjeta antepone al valor en teléfono. */
  label?: string;
  /** Papel de la celda en la tarjeta: identidad, selección, botón o dato. Sin "card", el dato no sale en la tarjeta. */
  role?: "primary" | "select" | "action";
  card?: boolean;
};

const features = tableFeatures({ rowSelectionFeature, rowSortingFeature, columnMeta: {} as Meta });
const helper = createColumnHelper<typeof features, User>();
const EMPTY: User[] = [];

type Props = {
  rows: User[] | undefined;
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  selection: RowSelectionState;
  onSelectionChange: (s: RowSelectionState) => void;
  meEmail: string;
};

export function UsersTable({ rows, sorting, onSortingChange, selection, onSelectionChange, meEmail }: Props) {
  const { t } = usePrefs();
  const c = useUsersCopy();
  const l = c.list;
  const job = useJobLabel();
  const data = rows ?? EMPTY;
  // Columnas vacías en todas las filas no se muestran (brief §6.5): por ejemplo, la última entrada si nadie entró.
  const hasLastActive = data.some((x) => x.lastActiveAt);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "select",
          enableSorting: false,
          meta: { className: "col-check", role: "select" },
          header: ({ table }) => (
            <input
              type="checkbox"
              className="checkbox"
              aria-label={l.selectAll}
              checked={table.getIsAllPageRowsSelected()}
              ref={(el) => {
                if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
              }}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
            />
          ),
          cell: ({ row }) => (
            <input type="checkbox" className="checkbox" aria-label={l.selectRow(row.original.name)} checked={row.getIsSelected()} onChange={(e) => row.toggleSelected(e.target.checked)} />
          ),
        }),
        helper.accessor("name", {
          header: l.col.person,
          meta: { className: "col-person", role: "primary" },
          cell: ({ row }) => {
            const x = row.original;
            return (
              <span className="person">
                <Avatar name={x.name} />
                <span className="person__text">
                  <Link href={`/usuarios/${x.id}`} className="person__name">
                    {x.name}
                  </Link>
                  {x.email === meEmail && <span className="you-tag">{c.you}</span>}
                  <span className="person__email">{x.email}</span>
                </span>
              </span>
            );
          },
        }),
        helper.accessor("roles", {
          header: l.col.job,
          enableSorting: false,
          meta: { className: "col-job", label: l.col.job, card: true },
          // El cliente lleva su empresa debajo: una columna menos y la fila se lee igual.
          cell: ({ row }) =>
            row.original.kind === "staff" ? (
              <span className="job job--staff">{job(row.original)}</span>
            ) : (
              <span className="job">
                {job(row.original)}
                <span className="job__company">{row.original.company ?? c.naturalPerson}</span>
              </span>
            ),
        }),
        helper.accessor("status", {
          header: l.col.status,
          meta: { label: l.col.status, card: true },
          cell: ({ row }) => <AccountStatus status={row.original.status} />,
        }),
        helper.accessor("registeredAt", {
          header: l.col.registered,
          meta: { className: "n", label: l.col.registered, card: true },
          cell: ({ row }) => (
            <time className="num cell-soft" dateTime={new Date(row.original.registeredAt).toISOString()}>
              {formatDate(row.original.registeredAt, t.locale)}
            </time>
          ),
        }),
        ...(hasLastActive
          ? [
              helper.accessor("lastActiveAt", {
                header: l.col.lastActive,
                meta: { className: "n col-optional" },
                cell: ({ row }) => <span className="cell-soft">{row.original.lastActiveAt ? relativeTime(row.original.lastActiveAt, t.locale) : c.never}</span>,
              }),
            ]
          : []),
        helper.accessor("quotes", {
          header: l.col.quotes,
          meta: { className: "n col-quotes" },
          cell: ({ row }) => <span className="num">{row.original.quotes}</span>,
        }),
        helper.display({
          id: "open",
          enableSorting: false,
          meta: { className: "col-open", role: "action" },
          header: () => <span className="sr-only">{l.col.action}</span>,
          cell: ({ row }) => (
            <Link href={`/usuarios/${row.original.id}`} className="btn open-btn" aria-label={l.openFor(row.original.name)}>
              {l.open}
              <IconArrowRight size={16} aria-hidden="true" />
            </Link>
          ),
        }),
      ]),
    [t, c, l, job, meEmail, hasLastActive],
  );

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (row) => row.id,
    manualSorting: true,
    state: { sorting, rowSelection: selection },
    onSortingChange: (updater) => onSortingChange(typeof updater === "function" ? updater(sorting) : updater),
    onRowSelectionChange: (updater) => onSelectionChange(typeof updater === "function" ? updater(selection) : updater),
    enableSortingRemoval: false,
    sortDescFirst: true,
  });

  // display cambia en teléfono: los roles explícitos conservan la semántica de tabla para lectores de pantalla.
  return (
    <table className="table table--cards accounts-table" role="table">
      <thead role="rowgroup">
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id} role="row">
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              const meta = header.column.columnDef.meta;
              return (
                <th key={header.id} scope="col" role="columnheader" className={meta?.className} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                  {header.column.getCanSort() ? (
                    <button type="button" className={`sort-btn${sorted ? " is-sorted" : ""}`} onClick={header.column.getToggleSortingHandler()}>
                      <table.FlexRender header={header} />
                      {sorted === "asc" ? <IconSortUp size={12} aria-hidden="true" /> : sorted === "desc" ? <IconSortDown size={12} aria-hidden="true" /> : null}
                    </button>
                  ) : (
                    <table.FlexRender header={header} />
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody role="rowgroup" className="fade-in" key={data.map((r) => r.id).join()}>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} role="row" aria-selected={row.getIsSelected()} className={row.getIsSelected() ? "is-selected" : undefined}>
            {row.getAllCells().map((cell) => {
              const meta = cell.column.columnDef.meta;
              const cls = [meta?.className, meta?.role || meta?.card ? null : "off-card"].filter(Boolean).join(" ");
              return (
                <td
                  key={cell.id}
                  role="cell"
                  className={cls || undefined}
                  data-primary={meta?.role === "primary" ? "" : undefined}
                  data-select={meta?.role === "select" ? "" : undefined}
                  data-action={meta?.role === "action" ? "" : undefined}
                  data-label={meta?.label}
                >
                  <table.FlexRender cell={cell} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

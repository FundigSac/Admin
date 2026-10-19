"use client";

import { createColumnHelper, rowSelectionFeature, rowSortingFeature, tableFeatures, useTable, type RowSelectionState, type SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { Avatar, MethodChip, StatusBadge } from "@/components/ui/bits";
import { IconEdit, IconMore, IconSend, IconSortDown, IconSortUp, IconTrash, IconUndo, IconUsers, IconBlocked } from "@/components/ui/icons";
import { Menu, MenuItem } from "@/components/ui/menu";
import type { User } from "@/data/types";
import { formatDate, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

// Tabla de usuarios: TanStack Table resuelve selección y orden; el orden y la paginación los aplica el origen de
// datos (manualSorting), así la misma tabla sirve cuando el Backend devuelva miles de cuentas por páginas.
const features = tableFeatures({ rowSelectionFeature, rowSortingFeature, columnMeta: {} as { className?: string } });
const helper = createColumnHelper<typeof features, User>();
const EMPTY: User[] = [];

export type RowAction = "view" | "edit" | "disable" | "enable" | "resend" | "reset" | "delete";

type Props = {
  rows: User[] | undefined;
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  selection: RowSelectionState;
  onSelectionChange: (s: RowSelectionState) => void;
  onAction: (action: RowAction, user: User) => void;
  meEmail: string;
};

export function UsersTable({ rows, sorting, onSortingChange, selection, onSelectionChange, onAction, meEmail }: Props) {
  const { t } = usePrefs();
  const u = t.users;

  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "select",
          enableSorting: false,
          meta: { className: "col-check" },
          header: ({ table }) => (
            <input
              type="checkbox"
              className="checkbox"
              aria-label={u.selectAll}
              checked={table.getIsAllPageRowsSelected()}
              ref={(el) => {
                if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
              }}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
            />
          ),
          cell: ({ row }) => (
            <input type="checkbox" className="checkbox" aria-label={u.selectRow(row.original.name)} checked={row.getIsSelected()} onChange={(e) => row.toggleSelected(e.target.checked)} />
          ),
        }),
        helper.accessor("name", {
          header: u.col.user,
          meta: { className: "col-user" },
          cell: ({ row }) => {
            const x = row.original;
            return (
              <span className="user-cell">
                <Avatar name={x.name} />
                <span className="cell-main">
                  <Link href={`/usuarios/${x.id}`} className="user-cell__name">
                    <span className="user-cell__text">{x.name}</span>
                    {x.email === meEmail && <span className="you-tag">{u.you}</span>}
                  </Link>
                  <span>{x.email}</span>
                </span>
              </span>
            );
          },
        }),
        helper.accessor("company", {
          header: u.col.company,
          enableSorting: false,
          meta: { className: "col-optional" },
          cell: ({ row }) => <span className="cell-muted cell-clip">{row.original.company ?? u.noCompany}</span>,
        }),
        helper.accessor("method", { header: u.col.method, enableSorting: false, meta: { className: "col-optional" }, cell: ({ row }) => <MethodChip method={row.original.method} /> }),
        helper.accessor("roles", {
          header: u.col.roles,
          enableSorting: false,
          cell: ({ row }) => (
            <span className="cell-muted">
              {t.roles[row.original.roles[0]]}
              {row.original.roles.length > 1 ? ` +${row.original.roles.length - 1}` : ""}
            </span>
          ),
        }),
        helper.accessor("status", { header: u.col.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> }),
        helper.accessor("registeredAt", {
          header: u.col.registered,
          meta: { className: "n" },
          cell: ({ row }) => (
            <time className="num cell-muted" dateTime={new Date(row.original.registeredAt).toISOString()}>
              {formatDate(row.original.registeredAt, t.locale)}
            </time>
          ),
        }),
        helper.accessor("lastActiveAt", {
          header: u.col.lastActive,
          meta: { className: "n col-optional" },
          cell: ({ row }) => <span className="cell-muted">{row.original.lastActiveAt ? relativeTime(row.original.lastActiveAt, t.locale) : u.never}</span>,
        }),
        helper.accessor("quotes", { header: u.col.quotes, meta: { className: "n" }, cell: ({ row }) => <span className="num">{row.original.quotes}</span> }),
        helper.display({
          id: "actions",
          enableSorting: false,
          meta: { className: "col-actions" },
          header: () => <span className="sr-only">{t.common.actions}</span>,
          cell: ({ row }) => <RowMenu user={row.original} onAction={onAction} isMe={row.original.email === meEmail} />,
        }),
      ]),
    [t, u, meEmail, onAction],
  );

  const table = useTable({
    features,
    columns,
    data: rows ?? EMPTY,
    getRowId: (row) => row.id,
    manualSorting: true,
    state: { sorting, rowSelection: selection },
    onSortingChange: (updater) => onSortingChange(typeof updater === "function" ? updater(sorting) : updater),
    onRowSelectionChange: (updater) => onSelectionChange(typeof updater === "function" ? updater(selection) : updater),
    enableSortingRemoval: false,
    sortDescFirst: true,
  });

  return (
    <table className="table users-table">
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              const cls = header.column.columnDef.meta?.className;
              return (
                <th key={header.id} scope="col" className={cls} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                  {header.column.getCanSort() ? (
                    <button type="button" className={`sort-btn${sorted ? " is-sorted" : ""}`} onClick={header.column.getToggleSortingHandler()}>
                      <table.FlexRender header={header} />
                      {sorted === "asc" ? <IconSortUp size={12} /> : sorted === "desc" ? <IconSortDown size={12} /> : null}
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
      <tbody className="fade-in" key={rows?.map((r) => r.id).join() ?? "empty"}>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} aria-selected={row.getIsSelected()} className={row.getIsSelected() ? "is-selected" : undefined}>
            {row.getAllCells().map((cell) => (
              <td key={cell.id} className={cell.column.columnDef.meta?.className}>
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RowMenu({ user, onAction, isMe }: { user: User; onAction: (a: RowAction, u: User) => void; isMe: boolean }) {
  const { t } = usePrefs();
  const u = t.users;
  return (
    <Menu
      trigger={(p) => (
        <button type="button" className="icon-btn icon-btn--sm" aria-label={u.rowMenu(user.name)} {...p}>
          <IconMore size={18} />
        </button>
      )}
    >
      <MenuItem icon={<IconUsers size={16} />} onSelect={() => onAction("view", user)}>
        {u.view}
      </MenuItem>
      <MenuItem icon={<IconEdit size={16} />} onSelect={() => onAction("edit", user)}>
        {u.edit}
      </MenuItem>
      {user.status === "pending" && (
        <MenuItem icon={<IconSend size={16} />} onSelect={() => onAction("resend", user)}>
          {u.resend}
        </MenuItem>
      )}
      {user.kind === "customer" && user.method === "email" && user.status !== "pending" && (
        <MenuItem icon={<IconSend size={16} />} onSelect={() => onAction("reset", user)}>
          {u.reset}
        </MenuItem>
      )}
      {!isMe && (
        <>
          <div className="menu__sep" role="separator" />
          {user.status === "disabled" ? (
            <MenuItem icon={<IconUndo size={16} />} onSelect={() => onAction("enable", user)}>
              {u.enable}
            </MenuItem>
          ) : (
            <MenuItem icon={<IconBlocked size={16} />} onSelect={() => onAction("disable", user)}>
              {u.disable}
            </MenuItem>
          )}
          <MenuItem danger icon={<IconTrash size={16} />} onSelect={() => onAction("delete", user)}>
            {u.remove}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}


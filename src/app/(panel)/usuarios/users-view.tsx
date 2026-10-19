"use client";

import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useState } from "react";
import { Pager } from "@/components/cases/case-ui";
import { useSessionUser } from "@/components/shell/session-context";
import { Avatar, Skeleton, StatusBadge, TitleRow } from "@/components/ui/bits";
import { IconBlocked, IconClose, IconExport, IconInfo, IconSearch, IconTrash, IconUndo, IconUserPlus } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/users/confirm-dialog";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { RowMenu, UsersTable, type RowAction } from "@/components/users/users-table";
import type { SignupMethod, User, UserStatus } from "@/data/types";
import { api, type RangeKey, type SortKey, type UserListParams } from "@/lib/api";
import { useDeleteUsers, usePasswordReset, useResendVerification, useSetStatus, useUserList } from "@/lib/api/queries";
import { downloadText, formatDate } from "@/lib/format";
import { PAGE_SIZES, usePrefs } from "@/lib/prefs";
import "./users.css";

const STATUSES: (UserStatus | "all")[] = ["all", "active", "pending", "disabled"];
const isStatus = (v: string | null): v is UserStatus => v === "active" || v === "pending" || v === "disabled";

export function UsersView() {
  const { t, pageSize, setPageSize } = usePrefs();
  const u = t.users;
  const me = useSessionUser();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const status: UserStatus | "all" = isStatus(params.get("estado")) ? (params.get("estado") as UserStatus) : "all";

  const [q, setQ] = useState("");
  const [method, setMethod] = useState<SignupMethod | "all">("all");
  const [kind, setKind] = useState<"all" | "customer" | "staff">("all");
  const [range, setRange] = useState<RangeKey>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "registeredAt", desc: true }]);
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [form, setForm] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [confirm, setConfirm] = useState<{ kind: "delete" | "disable"; ids: string[] } | null>(null);
  const [exporting, setExporting] = useState(false);
  const query = useDeferredValue(q.trim());

  const listParams: UserListParams = {
    page,
    size: pageSize,
    q: query || undefined,
    status,
    method,
    kind,
    range,
    sort: { id: (sorting[0]?.id ?? "registeredAt") as SortKey, desc: sorting[0]?.desc ?? true },
  };
  const list = useUserList(listParams);
  const data = list.data;
  const setStatusMut = useSetStatus();
  const del = useDeleteUsers();
  const resend = useResendVerification();
  const reset = usePasswordReset();

  const selectedIds = Object.keys(selection).filter((id) => selection[id]);
  const filtersOn = Boolean(query) || method !== "all" || kind !== "all" || range !== "all";

  const changeStatus = (next: UserStatus | "all") => {
    setPage(0);
    setSelection({});
    router.replace(next === "all" ? "/usuarios" : `/usuarios?estado=${next}`, { scroll: false });
  };

  const clear = () => {
    setQ("");
    setMethod("all");
    setKind("all");
    setRange("all");
    setPage(0);
  };

  const exportCsv = async (ids?: string[]) => {
    setExporting(true);
    try {
      let csv = await api.exportCsv({ ...listParams, page: 0, size: 10_000 });
      if (ids) {
        const keep = new Set(ids);
        const [head, ...lines] = csv.split("\r\n");
        csv = [head, ...lines.filter((l) => keep.has(l.split(",")[0]))].join("\r\n");
      }
      const count = csv.split("\r\n").length - 1;
      downloadText(`usuarios-fundigsac-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success(t.toast.exported(count));
    } catch {
      toast.error(t.common.error);
    } finally {
      setExporting(false);
    }
  };

  const onAction = useCallback(
    (action: RowAction, user: User) => {
      if (action === "view") router.push(`/usuarios/${user.id}`);
      else if (action === "edit") setForm({ open: true, user });
      else if (action === "disable") setConfirm({ kind: "disable", ids: [user.id] });
      else if (action === "delete") setConfirm({ kind: "delete", ids: [user.id] });
      else if (action === "enable") setStatusMut.mutate({ ids: [user.id], status: "active", actor: me.name }, { onSuccess: () => toast.success(t.toast.enabled(1)) });
      else if (action === "resend") resend.mutate(user.id, { onSuccess: () => toast.success(t.toast.resent) });
      else if (action === "reset") reset.mutate({ id: user.id, actor: me.name }, { onSuccess: () => toast.success(t.toast.resetSent) });
    },
    [router, setStatusMut, resend, reset, me.name, toast, t],
  );

  const runConfirm = () => {
    if (!confirm) return;
    const done = () => {
      setConfirm(null);
      setSelection({});
    };
    if (confirm.kind === "delete") del.mutate({ ids: confirm.ids, actor: me.name }, { onSuccess: () => (toast.success(t.toast.deleted(confirm.ids.length)), done()) });
    else setStatusMut.mutate({ ids: confirm.ids, status: "disabled", actor: me.name }, { onSuccess: () => (toast.success(t.toast.disabled(confirm.ids.length)), done()) });
  };

  // Nunca se ofrece suspender o eliminar la propia cuenta.
  const bulkIds = selectedIds.filter((id) => data?.items.find((x) => x.id === id)?.email !== me.email);
  const from = data ? data.page * data.size + 1 : 0;
  const to = data ? Math.min(data.totalItems, from + data.items.length - 1) : 0;

  return (
    <>
      <TitleRow
        title={u.title}
        sub={data ? (data.statusCounts.pending > 0 ? u.finding(data.statusCounts.pending) : u.lead) : u.lead}
        actions={
          <>
            <button type="button" className="btn" onClick={() => exportCsv()} disabled={exporting || !data?.totalItems}>
              {exporting ? <span className="spinner" aria-hidden="true" /> : <IconExport size={16} />}
              {exporting ? u.exporting : u.export}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setForm({ open: true, user: null })}>
              <IconUserPlus size={16} />
              {u.newUser}
            </button>
          </>
        }
      />

      <label className="sr-only" htmlFor="users-status">
        {u.tabs}
      </label>
      <select id="users-status" className="select status-select" value={status} onChange={(e) => changeStatus(e.target.value as UserStatus | "all")}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === "all" ? t.common.all : u.tabLabel[s]}
            {data ? ` (${data.statusCounts[s]})` : ""}
          </option>
        ))}
      </select>
      <div className="tabs status-tabs" role="tablist" aria-label={u.tabs}>
        {STATUSES.map((s) => (
          <button key={s} type="button" role="tab" className="tabs__tab" aria-selected={status === s} onClick={() => changeStatus(s)}>
            {s === "all" ? t.common.all : u.tabLabel[s]}
            <span className="tabs__count">{data ? data.statusCounts[s] : "·"}</span>
          </button>
        ))}
      </div>

      {status !== "all" && (
        <p className="status-hint fade-in" key={status}>
          <IconInfo size={16} />
          {t.statusHint[status]}
        </p>
      )}

      <div className="toolbar users-toolbar">
        <label className="toolbar__search">
          <span className="sr-only">{u.searchPh}</span>
          <IconSearch size={15} className="toolbar__icon" />
          <input
            className="input input--sm"
            type="search"
            placeholder={u.searchPh}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <div className="filters">
          <label className="sr-only" htmlFor="f-method">
            {u.method}
          </label>
          <select id="f-method" className="select select--sm" value={method} onChange={(e) => (setMethod(e.target.value as SignupMethod | "all"), setPage(0))}>
            <option value="all">
              {u.method}: {t.common.all.toLowerCase()}
            </option>
            {(["google", "email", "facebook"] as const).map((m) => (
              <option key={m} value={m}>
                {t.method[m]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="f-kind">
            {u.kind}
          </label>
          <select id="f-kind" className="select select--sm" value={kind} onChange={(e) => (setKind(e.target.value as "all" | "customer" | "staff"), setPage(0))}>
            <option value="all">
              {u.kind}: {t.common.all.toLowerCase()}
            </option>
            <option value="customer">{t.kind.customer}</option>
            <option value="staff">{t.kind.staff}</option>
          </select>
          <label className="sr-only" htmlFor="f-range">
            {u.range}
          </label>
          <select id="f-range" className="select select--sm" value={range} onChange={(e) => (setRange(e.target.value as RangeKey), setPage(0))}>
            <option value="all">{u.rangeAll}</option>
            {(["7d", "30d", "90d"] as const).map((r) => (
              <option key={r} value={r}>
                {u.rangeOpt[r]}
              </option>
            ))}
          </select>
          {filtersOn && (
            <button type="button" className="btn btn--ghost" onClick={clear}>
              <IconClose size={14} />
              {u.clear}
            </button>
          )}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-bar" role="region" aria-label={u.selected(selectedIds.length)}>
          <strong>{u.selected(selectedIds.length)}</strong>
          <div className="bulk-bar__actions">
            <button type="button" className="btn" onClick={() => exportCsv(selectedIds)}>
              <IconExport size={16} />
              {u.bulkExport}
            </button>
            <button type="button" className="btn" disabled={!bulkIds.length} onClick={() => setStatusMut.mutate({ ids: bulkIds, status: "active", actor: me.name }, { onSuccess: () => (toast.success(t.toast.enabled(bulkIds.length)), setSelection({})) })}>
              <IconUndo size={16} />
              {u.bulkEnable}
            </button>
            <button type="button" className="btn" disabled={!bulkIds.length} onClick={() => setConfirm({ kind: "disable", ids: bulkIds })}>
              <IconBlocked size={16} />
              {u.bulkDisable}
            </button>
            <button type="button" className="btn btn--danger-outline" disabled={!bulkIds.length} onClick={() => setConfirm({ kind: "delete", ids: bulkIds })}>
              <IconTrash size={16} />
              {u.bulkDelete}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setSelection({})}>
              {u.bulkClear}
            </button>
          </div>
        </div>
      )}

      {!data ? (
        <div aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="case-skel">
              <Skeleton w={32} h={32} />
              <Skeleton w="30%" h={14} />
              <Skeleton w={90} h={22} />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="empty case-empty">
          <strong>{u.emptyTitle}</strong>
          <span>{u.emptyText}</span>
          {filtersOn && (
            <button type="button" className="btn" onClick={clear}>
              {u.clear}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="table-frame users-frame">
            <UsersTable
              rows={data.items}
              sorting={sorting}
              onSortingChange={(s) => (setSorting(s), setPage(0))}
              selection={selection}
              onSelectionChange={setSelection}
              onAction={onAction}
              meEmail={me.email}
            />
          </div>

          <ul className="user-cards fade-in">
            {data.items.map((x) => (
              <li key={x.id} className="user-card">
                <Avatar name={x.name} />
                <Link href={`/usuarios/${x.id}`} className="user-card__main">
                  <strong>{x.name}</strong>
                  <span>{x.email}</span>
                  <span className="user-card__meta">
                    <StatusBadge status={x.status} />
                    <span>{formatDate(x.registeredAt, t.locale)}</span>
                  </span>
                </Link>
                <RowMenu user={x} onAction={onAction} isMe={x.email === me.email} />
              </li>
            ))}
          </ul>

          <div className="list-foot">
            <span className="list-foot__range">{u.showing(from, to, data.totalItems)}</span>
            <label className="list-foot__size">
              <span>{u.perPage}</span>
              <select className="select select--sm" value={pageSize} onChange={(e) => (setPageSize(Number(e.target.value)), setPage(0))}>
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
          </div>
        </>
      )}

      <UserFormDialog open={form.open} user={form.user} onClose={() => setForm({ open: false, user: null })} />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "delete" ? t.confirm.deleteTitle(confirm.ids.length) : t.confirm.disableTitle(confirm?.ids.length ?? 1)}
        text={confirm?.kind === "delete" ? t.confirm.deleteText : t.confirm.disableText}
        confirmLabel={confirm?.kind === "delete" ? t.confirm.deleteOk : t.confirm.disableOk}
        requireWord={confirm?.kind === "delete" ? t.confirm.word : undefined}
        busy={del.isPending || setStatusMut.isPending}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

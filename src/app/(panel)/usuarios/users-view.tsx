"use client";

import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useId, useState } from "react";
import { Pager } from "@/components/cases/case-ui";
import { useSessionUser } from "@/components/shell/session-context";
import { Skeleton } from "@/components/ui/bits";
import { IconBlocked, IconClose, IconExport, IconPending, IconSearch, IconSuccess, IconTrash, IconUndo, IconUserPlus } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { IconFilter } from "@/components/users/account-icons";
import { ConfirmDialog } from "@/components/users/confirm-dialog";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { useUsersCopy } from "@/components/users/users-copy";
import { UsersTable } from "@/components/users/users-table";
import type { SignupMethod, UserStatus } from "@/data/types";
import { api, type RangeKey, type SortKey, type UserListParams } from "@/lib/api";
import { useDeleteUsers, useSetStatus, useUserList } from "@/lib/api/queries";
import { downloadText } from "@/lib/format";
import { PAGE_SIZES, usePrefs } from "@/lib/prefs";
import "./users.css";

const STATUSES: (UserStatus | "all")[] = ["all", "active", "pending", "disabled"];
const KINDS = ["all", "customer", "staff"] as const;
type Kind = (typeof KINDS)[number];
// En la dirección se usan palabras en español: /usuarios?tipo=personal&estado=pending.
const KIND_PARAM: Record<Kind, string | null> = { all: null, customer: "clientes", staff: "personal" };

const isStatus = (v: string | null): v is UserStatus => v === "active" || v === "pending" || v === "disabled";
const kindFrom = (v: string | null): Kind => (v === "personal" ? "staff" : v === "clientes" ? "customer" : "all");

/** Título, frase de propósito y las dos acciones. También es lo que se ve mientras carga la lista. */
export function AccountsTitle({ onAdd, onDownload, downloading = false, canDownload = false }: { onAdd?: () => void; onDownload?: () => void; downloading?: boolean; canDownload?: boolean }) {
  const l = useUsersCopy().list;
  return (
    <header className="title-row accounts-title">
      <div>
        <h1 className="title-row__title">{l.title}</h1>
        <p className="title-row__sub accounts-title__lead">{l.lead}</p>
      </div>
      <div className="title-row__actions">
        <button type="button" className="btn" onClick={onDownload} disabled={!onDownload || downloading || !canDownload} title={l.downloadHint}>
          {downloading ? <span className="spinner" aria-hidden="true" /> : <IconExport size={18} aria-hidden="true" />}
          {downloading ? l.downloading : l.download}
        </button>
        <button type="button" className="btn btn--primary" onClick={onAdd} disabled={!onAdd}>
          <IconUserPlus size={18} aria-hidden="true" />
          {l.add}
        </button>
      </div>
    </header>
  );
}

export function UsersView() {
  const { pageSize, setPageSize } = usePrefs();
  const c = useUsersCopy();
  const l = c.list;
  const me = useSessionUser();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const status: UserStatus | "all" = isStatus(params.get("estado")) ? (params.get("estado") as UserStatus) : "all";
  const kind = kindFrom(params.get("tipo"));
  const filtersId = useId();

  const [q, setQ] = useState("");
  const [method, setMethod] = useState<SignupMethod | "all">("all");
  const [range, setRange] = useState<RangeKey>("all");
  const [moreOpen, setMoreOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "registeredAt", desc: true }]);
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [formOpen, setFormOpen] = useState(false);
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

  const selectedIds = Object.keys(selection).filter((id) => selection[id]);
  const extraFilters = (method !== "all" ? 1 : 0) + (range !== "all" ? 1 : 0);
  const filtersOn = Boolean(query) || extraFilters > 0 || kind !== "all" || status !== "all";

  const go = (next: { estado?: UserStatus | "all"; tipo?: Kind }) => {
    const s = new URLSearchParams();
    const nextKind = KIND_PARAM[next.tipo ?? kind];
    const nextStatus = next.estado ?? status;
    if (nextKind) s.set("tipo", nextKind);
    if (nextStatus !== "all") s.set("estado", nextStatus);
    const qs = s.toString();
    setPage(0);
    setSelection({});
    router.replace(qs ? `/usuarios?${qs}` : "/usuarios", { scroll: false });
  };

  const clear = () => {
    setQ("");
    setMethod("all");
    setRange("all");
    go({ estado: "all", tipo: "all" });
  };

  const exportCsv = async (ids?: string[]) => {
    setExporting(true);
    try {
      let csv = await api.exportCsv({ ...listParams, page: 0, size: 10_000 });
      if (ids) {
        const keep = new Set(ids);
        const [head, ...lines] = csv.split("\r\n");
        csv = [head, ...lines.filter((line) => keep.has(line.split(",")[0].replace(/^﻿/, "")))].join("\r\n");
      }
      const count = csv.split("\r\n").length - 1;
      downloadText(`cuentas-fundigsac-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success(c.toast.exported(count));
    } catch {
      toast.error(c.error);
    } finally {
      setExporting(false);
    }
  };

  const runConfirm = () => {
    if (!confirm) return;
    const done = () => {
      setConfirm(null);
      setSelection({});
    };
    const fail = () => toast.error(c.error);
    if (confirm.kind === "delete") del.mutate({ ids: confirm.ids, actor: me.name }, { onSuccess: () => (toast.success(c.toast.deleted(confirm.ids.length)), done()), onError: fail });
    else setStatusMut.mutate({ ids: confirm.ids, status: "disabled", actor: me.name }, { onSuccess: () => (toast.success(c.toast.disabled(confirm.ids.length)), done()), onError: fail });
  };

  // La propia cuenta nunca se bloquea ni se elimina desde la selección.
  const mine = data?.items.find((x) => x.email === me.email)?.id;
  const bulkIds = selectedIds.filter((id) => id !== mine);
  const from = data ? data.page * data.size + 1 : 0;
  const to = data ? Math.min(data.totalItems, from + data.items.length - 1) : 0;
  const pending = data?.statusCounts.pending;

  return (
    <>
      <AccountsTitle onAdd={() => setFormOpen(true)} onDownload={() => exportCsv()} downloading={exporting} canDownload={Boolean(data?.totalItems)} />

      <section className="finder" aria-label={l.finder}>
        <div className="finder__row">
          <div className="who" role="group" aria-label={l.who}>
            {KINDS.map((k) => (
              <button key={k} type="button" className="who__opt" aria-pressed={kind === k} onClick={() => go({ tipo: k })}>
                {l.whoOpt[k]}
              </button>
            ))}
          </div>
          <label className="finder__search">
            <span className="sr-only">{l.search}</span>
            <IconSearch size={18} className="finder__icon" aria-hidden="true" />
            <input
              className="input"
              type="search"
              name="q"
              autoComplete="off"
              placeholder={l.searchPh}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <button type="button" className="btn finder__more" aria-expanded={moreOpen} aria-controls={filtersId} onClick={() => setMoreOpen((v) => !v)}>
            <IconFilter size={18} aria-hidden="true" />
            <span className="finder__more-text">{l.moreFilters}</span>
            {extraFilters > 0 && (
              <span className="finder__count">
                <span aria-hidden="true">{extraFilters}</span>
                <span className="sr-only">{l.activeFilters(extraFilters)}</span>
              </span>
            )}
          </button>
        </div>

        {moreOpen && (
          <div className="finder__extra fade-in" id={filtersId}>
            <label className="field finder__field">
              <span className="field__label">{l.method}</span>
              <select className="select" value={method} onChange={(e) => (setMethod(e.target.value as SignupMethod | "all"), setPage(0))}>
                <option value="all">{l.methodAll}</option>
                {(["email", "google", "facebook"] as const).map((m) => (
                  <option key={m} value={m}>
                    {c.method[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field finder__field">
              <span className="field__label">{l.range}</span>
              <select className="select" value={range} onChange={(e) => (setRange(e.target.value as RangeKey), setPage(0))}>
                {(["all", "7d", "30d", "90d"] as const).map((r) => (
                  <option key={r} value={r}>
                    {l.rangeOpt[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="states" role="group" aria-label={l.statusLabel}>
          {STATUSES.map((s) => (
            <button key={s} type="button" className={`state-chip state-chip--${s}`} aria-pressed={status === s} onClick={() => go({ estado: s })}>
              {s !== "all" && <span className="pill__dot" aria-hidden="true" />}
              <span>{l.statusOpt[s]}</span>
              <span className="state-chip__count num">{data ? data.statusCounts[s] : "·"}</span>
            </button>
          ))}
          {filtersOn && (
            <button type="button" className="btn btn--ghost states__clear" onClick={clear}>
              <IconClose size={16} aria-hidden="true" />
              {l.clear}
            </button>
          )}
        </div>
      </section>

      {/* Línea de atención: dice qué hacer con lo pendiente. Va junto a la lista porque cambia en el mismo momento que ella y así no empuja nada al cargar. */}
      <div className={`attention${pending ? " attention--todo" : ""}`} aria-live="polite">
        {pending === undefined ? (
          <Skeleton w="60%" h={16} />
        ) : status === "pending" ? (
          <>
            <IconPending size={20} className="attention__icon" aria-hidden="true" />
            <p className="attention__text">{l.pendingHere}</p>
            <button type="button" className="btn attention__cta" onClick={() => go({ estado: "all" })}>
              {l.showAll}
            </button>
          </>
        ) : pending > 0 ? (
          <>
            <IconPending size={20} className="attention__icon" aria-hidden="true" />
            <p className="attention__text">{l.pending(pending)}</p>
            <button type="button" className="btn attention__cta" onClick={() => go({ estado: "pending" })}>
              {l.pendingCta(pending)}
            </button>
          </>
        ) : (
          <>
            <IconSuccess size={20} className="attention__icon attention__icon--ok" aria-hidden="true" />
            <p className="attention__text">{l.allConfirmed}</p>
          </>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk" role="region" aria-label={l.selected(selectedIds.length)}>
          <div className="bulk__info">
            <strong>{l.selected(selectedIds.length)}</strong>
            {mine && selection[mine] && <span className="bulk__note">{l.selfNote}</span>}
          </div>
          <div className="bulk__actions">
            <button type="button" className="btn" onClick={() => exportCsv(selectedIds)}>
              <IconExport size={18} aria-hidden="true" />
              {l.bulk.download}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!bulkIds.length}
              onClick={() =>
                setStatusMut.mutate({ ids: bulkIds, status: "active", actor: me.name }, { onSuccess: () => (toast.success(c.toast.enabled(bulkIds.length)), setSelection({})), onError: () => toast.error(c.error) })
              }
            >
              <IconUndo size={18} aria-hidden="true" />
              {l.bulk.enable}
            </button>
            <button type="button" className="btn" disabled={!bulkIds.length} onClick={() => setConfirm({ kind: "disable", ids: bulkIds })}>
              <IconBlocked size={18} aria-hidden="true" />
              {l.bulk.disable}
            </button>
            <button type="button" className="btn btn--danger-outline" disabled={!bulkIds.length} onClick={() => setConfirm({ kind: "delete", ids: bulkIds })}>
              <IconTrash size={18} aria-hidden="true" />
              {l.bulk.remove}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setSelection({})}>
              {l.bulk.clear}
            </button>
          </div>
        </div>
      )}

      {!data ? (
        <div className="accounts-loading" role="status" aria-busy="true" aria-label={l.loading}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="accounts-loading__row">
              <Skeleton w={32} h={32} />
              <Skeleton w="28%" h={14} />
              <Skeleton w={110} h={14} />
              <Skeleton w={90} h={14} />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="empty accounts-empty">
          <strong>{l.emptyTitle}</strong>
          <span>{l.emptyText}</span>
          {filtersOn && (
            <button type="button" className="btn" onClick={clear}>
              {l.clear}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="accounts-frame" role="region" aria-label={l.title} tabIndex={0}>
            <UsersTable rows={data.items} sorting={sorting} onSortingChange={(s) => (setSorting(s), setPage(0))} selection={selection} onSelectionChange={setSelection} meEmail={me.email} />
          </div>

          <div className="accounts-foot">
            <span className="accounts-foot__range">{l.showing(from, to, data.totalItems)}</span>
            <label className="accounts-foot__size">
              <span>{l.perPage}</span>
              <select className="select" value={pageSize} onChange={(e) => (setPageSize(Number(e.target.value)), setPage(0))}>
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
          </div>
        </>
      )}

      <UserFormDialog open={formOpen} user={null} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "delete" ? c.confirm.deleteTitle(confirm.ids.length) : c.confirm.disableTitle(confirm?.ids.length ?? 1)}
        text={confirm?.kind === "delete" ? c.confirm.deleteText : c.confirm.disableText}
        confirmLabel={confirm?.kind === "delete" ? c.confirm.deleteOk : c.confirm.disableOk}
        requireWord={confirm?.kind === "delete" ? c.confirm.word : undefined}
        busy={del.isPending || setStatusMut.isPending}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

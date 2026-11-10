"use client";

import { IconEnter, IconSearch } from "@/components/ui/icons";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Avatar, StatusBadge } from "@/components/ui/bits";
import { useUserList } from "@/lib/api/queries";
import { useT } from "@/lib/prefs";
import { NAV, navLabel } from "./app-shell";

type Result = { id: string; href: string; label: string; sub?: string; kind: "page" | "user"; user?: { name: string; status: "active" | "pending" | "disabled" } };

/** Búsqueda rápida (Ctrl K): secciones del panel y usuarios por nombre, correo, empresa o RUC. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const t = useT();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const deferred = useDeferredValue(query.trim());
  const users = useUserList({ page: 0, size: 6, q: deferred || undefined, sort: { id: "registeredAt", desc: true } }, open);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      input.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = deferred.toLowerCase();
    const pages: Result[] = NAV.flatMap((g) => g.items)
      .filter((i) => !q || navLabel(t, i.key).toLowerCase().includes(q))
      .map((i) => ({ id: i.href, href: i.href, label: navLabel(t, i.key), kind: "page" }));
    const people: Result[] = (open ? (users.data?.items ?? []) : []).map((u) => ({
      id: u.id,
      href: `/usuarios/${u.id}`,
      label: u.name,
      sub: u.email,
      kind: "user",
      user: { name: u.name, status: u.status },
    }));
    return [...pages, ...people];
  }, [deferred, t, users.data, open]);

  const active = Math.min(index, Math.max(0, results.length - 1));

  const close = () => {
    setQuery("");
    setIndex(0);
    onClose();
  };

  const go = (r: Result | undefined) => {
    if (!r) return;
    close();
    router.push(r.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((active + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((active - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  const pages = results.filter((r) => r.kind === "page");
  const people = results.filter((r) => r.kind === "user");
  const option = (r: Result) => {
    const i = results.indexOf(r);
    return (
      <li
        key={r.id}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={i === active}
        className="palette__option"
        onMouseMove={() => setIndex(i)}
        onClick={() => go(r)}
      >
        {r.user ? <Avatar name={r.user.name} size="sm" /> : null}
        <span className="palette__text">
          <strong>{r.label}</strong>
          {r.sub && <span>{r.sub}</span>}
        </span>
        {r.user ? <StatusBadge status={r.user.status} /> : null}
        {i === active && <IconEnter className="palette__enter" size={14} aria-hidden="true" />}
      </li>
    );
  };

  return (
    <dialog
      ref={ref}
      className="dialog palette"
      aria-label={t.topbar.searchLabel}
      onClose={close}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="palette__search">
        <IconSearch size={17} aria-hidden="true" />
        <input
          ref={input}
          className="palette__input"
          name="palette"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          placeholder={t.palette.placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={onKey}
        />
        <kbd className="kbd">Esc</kbd>
      </div>
      <ul id={listId} role="listbox" className="palette__list" aria-label={t.topbar.searchLabel}>
        {pages.length > 0 && (
          <li role="presentation" className="palette__group">
            {t.palette.pages}
          </li>
        )}
        {pages.map(option)}
        {people.length > 0 && (
          <li role="presentation" className="palette__group">
            {t.palette.users}
          </li>
        )}
        {people.map(option)}
        {results.length === 0 && !users.isFetching && (
          <li role="presentation" className="palette__empty">
            {t.palette.empty}
          </li>
        )}
      </ul>
      <p className="palette__hint">{t.palette.hint}</p>
    </dialog>
  );
}

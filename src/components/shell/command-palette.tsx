"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Avatar, StatusBadge } from "@/components/ui/bits";
import { IconEnter, IconSearch } from "@/components/ui/icons";
import type { Claim, Inquiry, PrivacyRequest, Quote } from "@/data/types";
import { api, type CaseMap, type CaseModule } from "@/lib/api";
import { useUserList } from "@/lib/api/queries";
import { useT } from "@/lib/prefs";
import type { NavSection, PageKey } from "./nav";
import { useShellCopy } from "./shell-copy";

type Kind = "page" | "case" | "user";
type Result = { id: string; href: string; label: string; sub?: string; kind: Kind; user?: { name: string; status: "active" | "pending" | "disabled" } };

const CASE_ROUTE: Record<CaseModule, { href: string; page: PageKey }> = {
  quotes: { href: "/cotizaciones", page: "quotes" },
  inquiries: { href: "/consultas", page: "inquiries" },
  claims: { href: "/reclamaciones", page: "claims" },
  privacy: { href: "/privacidad", page: "privacy" },
};

/** A quién pertenece una solicitud, para reconocerla en la lista sin abrirla. */
function caseOwner(module: CaseModule, c: CaseMap[CaseModule]) {
  if (module === "quotes") return (c as Quote).company || (c as Quote).contactName;
  if (module === "inquiries") return (c as Inquiry).fullName;
  if (module === "claims") return (c as Claim).name;
  return (c as PrivacyRequest).name;
}

type Props = {
  open: boolean;
  onClose: () => void;
  nav: NavSection[];
  /** Colas que la persona puede leer: solo en ellas se buscan códigos. */
  modules: CaseModule[];
  canSearchPeople: boolean;
};

/** Búsqueda del panel: secciones, solicitudes por código o nombre y personas por nombre o correo. */
export function CommandPalette({ open, onClose, nav, modules, canSearchPeople }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const t = useT();
  const c = useShellCopy();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const deferred = useDeferredValue(query.trim());
  const users = useUserList({ page: 0, size: 6, q: deferred || undefined, sort: { id: "registeredAt", desc: true } }, open && canSearchPeople);
  const cases = useQuery({
    queryKey: ["palette", "cases", deferred, modules],
    queryFn: async () => {
      const pages = await Promise.all(modules.map(async (m) => ({ m, page: await api.listCases(m, { page: 0, size: 4, q: deferred }) })));
      return pages.flatMap(({ m, page }) => page.items.map((item) => ({ module: m, id: item.id, code: item.code, owner: caseOwner(m, item) })));
    },
    enabled: open && deferred.length >= 2 && modules.length > 0,
    placeholderData: keepPreviousData,
  });

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
    const pages: Result[] = nav
      .flatMap((s) => s.pages)
      .filter((p) => !q || c.pages[p.key].toLowerCase().includes(q))
      .map((p) => ({ id: p.href, href: p.href, label: c.pages[p.key], kind: "page" }));
    const requests: Result[] =
      open && deferred.length >= 2
        ? (cases.data ?? []).map((r) => ({
            id: `${r.module}-${r.id}`,
            href: `${CASE_ROUTE[r.module].href}/${r.id}`,
            label: r.code,
            sub: `${c.pages[CASE_ROUTE[r.module].page]} · ${r.owner}`,
            kind: "case",
          }))
        : [];
    const people: Result[] = (open && canSearchPeople ? (users.data?.items ?? []) : []).map((u) => ({
      id: u.id,
      href: `/usuarios/${u.id}`,
      label: u.name,
      sub: u.email,
      kind: "user",
      user: { name: u.name, status: u.status },
    }));
    return [...pages, ...requests, ...people];
  }, [deferred, c, nav, cases.data, users.data, open, canSearchPeople]);

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

  const option = (r: Result) => {
    const i = results.indexOf(r);
    return (
      <li
        key={`${r.kind}-${r.id}`}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={i === active}
        className="palette__option"
        onMouseMove={() => setIndex(i)}
        onClick={() => go(r)}
      >
        {r.user ? <Avatar name={r.user.name} size="sm" /> : null}
        <span className="palette__text">
          <strong className={r.kind === "case" ? "code" : undefined}>{r.label}</strong>
          {r.sub && <span>{r.sub}</span>}
        </span>
        {r.user ? <StatusBadge status={r.user.status} /> : null}
        {i === active && <IconEnter className="palette__enter" size={14} aria-hidden="true" />}
      </li>
    );
  };

  const group = (kind: Kind, label: string) => {
    const items = results.filter((r) => r.kind === kind);
    if (!items.length) return null;
    return [
      <li key={`g-${kind}`} role="presentation" className="palette__group">
        {label}
      </li>,
      ...items.map(option),
    ];
  };

  const busy = users.isFetching || cases.isFetching;

  return (
    <dialog
      ref={ref}
      className="dialog palette"
      aria-label={c.search}
      onClose={close}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="palette__search">
        <IconSearch size={18} aria-hidden="true" />
        <input
          ref={input}
          className="palette__input"
          name="palette"
          role="combobox"
          aria-label={c.search}
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          placeholder={c.palette.placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={onKey}
        />
        <button type="button" className="kbd palette__esc" onClick={close} aria-label={t.common.close}>
          Esc
        </button>
      </div>
      <ul id={listId} role="listbox" className="palette__list" aria-label={c.search}>
        {group("page", c.palette.pages)}
        {group("case", c.palette.requests)}
        {group("user", c.palette.people)}
        {results.length === 0 && !busy && (
          <li role="presentation" className="palette__empty">
            {c.palette.empty}
          </li>
        )}
      </ul>
      <p className="palette__hint">{c.palette.hint}</p>
    </dialog>
  );
}

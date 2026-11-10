"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Tone } from "@/components/cases/case-ui";
import { CLAIM_TONE, INQUIRY_TONE, PRIVACY_TONE, QUOTE_TONE } from "@/components/cases/tones";
import { resolvePermissions } from "@/components/shell/access";
import { buildNav } from "@/components/shell/nav";
import { useSessionUser } from "@/components/shell/session-context";
import { Avatar, Skeleton } from "@/components/ui/bits";
import { useToast } from "@/components/ui/toast";
import { IconArrowRight, IconChevronRight, IconComplaints, IconInquiries, IconPrivacy, IconQuotes, type AppIcon } from "@/components/ui/icons";
import type { Claim, Inquiry, PrivacyRequest, Quote } from "@/data/types";
import { api, type CaseListParams, type CaseModule, type QueueCounts } from "@/lib/api";
import { keys, useQueueCounts, useResendVerification } from "@/lib/api/queries";
import { businessDaysLeft } from "@/lib/business-days";
import { formatNumber, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { useHomeCopy, type HomeCopy } from "./home-copy";
import "./overview.css";

// Inicio (brief de diseño §6.4): responde "qué tengo que hacer ahora". De arriba abajo: "Para hoy" con una frase y el
// único botón principal, la lista de lo pendiente (plazos legales a 3 días hábiles o menos primero, después lo que lleva
// más tiempo esperando; máximo 7 filas), tres accesos con su cifra real y, cerrado, "Ver números del mes", que carga sus
// gráficos solo al abrirse.

const MAX_ROWS = 7;
const SOON = 3;

const MODULES = ["claims", "privacy", "quotes", "inquiries"] as const satisfies readonly CaseModule[];

/** Mismas consultas (y misma clave de caché) que las listas de Solicitudes: lo que se atiende allí se refleja aquí. */
const PARAMS: Record<CaseModule, CaseListParams> = {
  quotes: { page: 0, size: MAX_ROWS, status: "new", sort: "oldest" },
  inquiries: { page: 0, size: MAX_ROWS, status: "new", sort: "oldest" },
  claims: { page: 0, size: MAX_ROWS, sort: "due" },
  privacy: { page: 0, size: MAX_ROWS, sort: "due" },
};

/** Lo que espera atención en cada cola: igual que el conteo del menú (queueCounts). */
const WAITING: Record<CaseModule, readonly string[]> = {
  quotes: ["new"],
  inquiries: ["new"],
  claims: ["received", "in_progress"],
  privacy: ["received", "identity", "processing"],
};

const BASE: Record<CaseModule, string> = { quotes: "/cotizaciones", inquiries: "/consultas", claims: "/reclamaciones", privacy: "/privacidad" };
const ICON: Record<CaseModule, AppIcon> = { quotes: IconQuotes, inquiries: IconInquiries, claims: IconComplaints, privacy: IconPrivacy };
const TONE: Record<CaseModule, Record<string, Tone>> = { quotes: QUOTE_TONE, inquiries: INQUIRY_TONE, claims: CLAIM_TONE, privacy: PRIVACY_TONE };

type PillKind = Tone | "late";

type Task = {
  key: string;
  module: CaseModule;
  href: string;
  title: string;
  when: string;
  whenTone: "late" | "soon" | null;
  who: string;
  state: { text: string; kind: PillKind };
  createdAt: number;
  dueAt: number | null;
};

const MonthNumbers = dynamic(() => import("./month-numbers"), { ssr: false, loading: () => <NumbersLoading /> });

export function OverviewView() {
  const { t } = usePrefs();
  const c = useHomeCopy();
  const user = useSessionUser();
  const nav = useMemo(() => buildNav(resolvePermissions(user.roles)), [user.roles]);
  const pages = new Set(nav.flatMap((s) => s.pages.map((p) => p.key)));
  const can = (m: CaseModule) => pages.has(m);
  const canAccounts = pages.has("accounts");
  const requestsHref = nav.find((s) => s.key === "requests")?.href ?? "/cotizaciones";

  const queues = useQueueCounts();
  const lists = useQueries({
    queries: MODULES.map((m) => ({
      queryKey: ["cases", m, "list", PARAMS[m]],
      queryFn: () => api.listCases(m, PARAMS[m]),
      enabled: pages.has(m),
      staleTime: 15_000,
    })),
  });
  const pending = useQuery({ queryKey: keys.stats("30d"), queryFn: () => api.stats("30d"), enabled: canAccounts });

  const failed = queues.isError || lists.some((l) => l.isError);
  const ready = !!queues.data && MODULES.every((m, i) => !can(m) || !!lists[i].data);

  // La hora de la última consulta sirve de "ahora": el render queda puro y los plazos se recalculan al refrescar.
  const now = queues.dataUpdatedAt;
  const tasks: Task[] = [];
  if (ready) {
    const seen = new Set<string>();
    MODULES.forEach((m, i) => {
      if (!can(m)) return;
      const items = (lists[i].data?.items ?? []) as { id: string; status: string }[];
      for (const item of items) {
        if (!WAITING[m].includes(item.status)) continue;
        seen.add(`${m}:${item.id}`);
        tasks.push(toTask(m, item, c, t, now));
      }
    });
    // Un plazo legal cercano que no entró en las primeras filas de su lista igual va en "Para hoy".
    for (const d of queues.data?.due ?? []) {
      if (!can(d.module) || seen.has(`${d.module}:${d.id}`) || businessDaysLeft(d.dueAt, now) > SOON) continue;
      tasks.push(fromDue(d, c, now));
    }
  }
  const isUrgent = (task: Task) => task.dueAt !== null && businessDaysLeft(task.dueAt, now) <= SOON;
  const urgent = tasks.filter(isUrgent).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const rest = tasks.filter((task) => !isUrgent(task)).sort((a, b) => a.createdAt - b.createdAt);
  const rows = [...urgent, ...rest].slice(0, MAX_ROWS);

  const q = queues.data;
  const total = q ? MODULES.reduce((sum, m) => sum + (can(m) ? q[m] : 0), 0) : 0;
  const first = rows[0];

  const retry = () => {
    void queues.refetch();
    lists.forEach((l) => void l.refetch());
  };

  return (
    <div className="home">
      <header className="home-head">
        <div className="home-head__text">
          <h1 className="home-head__title">{c.title}</h1>
          <p className="home-head__lead" aria-live="polite">
            {ready ? (
              <>
                <strong>{c.lead(total)}</strong> {total > 0 ? (urgent.length > 0 ? c.leadLegal(urgent.length) : c.leadOrder) : null}
              </>
            ) : failed ? (
              c.loadError
            ) : (
              <Skeleton w="min(100%, 420px)" h={18} />
            )}
          </p>
        </div>
        <div className="home-head__action">
          {first ? (
            <Link href={first.href} className="btn btn--primary btn--lg">
              {c.urgent}
              <IconArrowRight size={18} aria-hidden="true" />
            </Link>
          ) : !ready && !failed ? (
            <Skeleton w={241} h={48} />
          ) : null}
        </div>
      </header>

      <section className="tasks" aria-label={c.listLabel} aria-busy={!ready && !failed}>
        {failed && !ready ? (
          <div className="tasks__empty" role="alert">
            <p>{c.loadError}</p>
            <button type="button" className="btn" onClick={retry}>
              {c.retry}
            </button>
          </div>
        ) : !ready ? (
          <div className="tasks__list" aria-hidden="true">
            {Array.from({ length: MAX_ROWS }, (_, i) => (
              <div key={i} className="task task--skeleton">
                <Skeleton w={40} h={40} />
                <span className="task__body">
                  <Skeleton w="62%" h={16} />
                  <Skeleton w="38%" h={12} />
                </span>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="tasks__empty">
            <p className="tasks__empty-title">{c.empty}</p>
            <p>{c.emptyHint}</p>
          </div>
        ) : (
          <ol className="tasks__list">
            {rows.map((task) => {
              const Icon = ICON[task.module];
              return (
                <li key={task.key} className={`task${task.whenTone ? ` task--${task.whenTone}` : ""}`}>
                  <span className="task__icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="task__body">
                    <span className="task__what">
                      {task.title}, <span className={task.whenTone ? `task__when task__when--${task.whenTone}` : "task__when"}>{task.when}</span>
                    </span>
                    <span className="task__who">{task.who}</span>
                  </span>
                  <span className={`pill pill--${task.state.kind === "late" ? "disabled" : task.state.kind} task__state`}>
                    <span className="pill__dot" aria-hidden="true" />
                    {task.state.text}
                  </span>
                  <Link href={task.href} className="btn task__go" aria-label={c.attendFor(`${task.title}, ${task.when}`)}>
                    {c.attend}
                    <IconChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        <div className="tasks__foot">
          {ready && total > rows.length ? (
            <Link href={requestsHref} className="card-link tasks__all">
              {c.seeAll(total)}
              <IconChevronRight size={14} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </section>

      <Shortcuts queues={q} pending={pending.data?.pending} can={can} canAccounts={canAccounts} />

      {canAccounts && <PendingAccounts list={pending.data?.pendingOldest} />}

      {canAccounts && <Numbers />}
    </div>
  );
}

function toTask(m: CaseModule, item: { id: string; status: string }, c: HomeCopy, t: ReturnType<typeof usePrefs>["t"], now: number): Task {
  const href = `${BASE[m]}/${item.id}`;
  const statusText = (t.cases[m].status as Record<string, string>)[item.status] ?? item.status;
  const base = { key: `${m}:${item.id}`, module: m, href, state: { text: statusText, kind: TONE[m][item.status] ?? ("todo" as PillKind) } };
  if (m === "claims" || m === "privacy") {
    const legal = item as Claim | PrivacyRequest;
    const left = businessDaysLeft(legal.dueAt, now);
    const whenTone = left < 0 ? "late" : left <= SOON ? "soon" : null;
    const state = left < 0 ? { text: c.state.late, kind: "late" as const } : left <= SOON ? { text: c.state.soon, kind: "todo" as const } : base.state;
    const title = m === "claims" ? c.task.claim(t.cases.claims.kind[(legal as Claim).kind], legal.code) : c.task.privacy(legal.code);
    return { ...base, title, when: c.deadline(left), whenTone, who: `${legal.name} · ${m === "claims" ? c.task.legalClaim : c.task.legalPrivacy}`, state, createdAt: legal.createdAt, dueAt: legal.dueAt };
  }
  if (m === "quotes") {
    const quote = item as Quote;
    return { ...base, title: c.task.quote(quote.code), when: c.task.arrived(relativeTime(quote.createdAt, t.locale, now)), whenTone: null, who: [quote.company, c.task.items(quote.items.length)].filter(Boolean).join(" · "), createdAt: quote.createdAt, dueAt: null };
  }
  const inquiry = item as Inquiry;
  return {
    ...base,
    title: c.task.inquiry(inquiry.fullName),
    when: c.task.waiting(relativeTime(inquiry.createdAt, t.locale, now)),
    whenTone: null,
    who: [inquiry.company, t.cases.inquiries.reason[inquiry.reason]].filter(Boolean).join(" · "),
    createdAt: inquiry.createdAt,
    dueAt: null,
  };
}

function fromDue(d: QueueCounts["due"][number], c: HomeCopy, now: number): Task {
  const left = businessDaysLeft(d.dueAt, now);
  return {
    key: `${d.module}:${d.id}`,
    module: d.module,
    href: `${BASE[d.module]}/${d.id}`,
    title: d.module === "claims" ? c.task.claimFallback(d.code) : c.task.privacy(d.code),
    when: c.deadline(left),
    whenTone: left < 0 ? "late" : "soon",
    who: `${d.name} · ${d.module === "claims" ? c.task.legalClaim : c.task.legalPrivacy}`,
    state: left < 0 ? { text: c.state.late, kind: "late" } : { text: c.state.soon, kind: "todo" },
    // Sin fecha de llegada en el resumen de plazos: ordena por su vencimiento, que es lo que importa aquí.
    createdAt: d.dueAt,
    dueAt: d.dueAt,
  };
}

function Shortcuts({ queues, pending, can, canAccounts }: { queues?: QueueCounts; pending?: number; can: (m: CaseModule) => boolean; canAccounts: boolean }) {
  const { t } = usePrefs();
  const c = useHomeCopy().shortcuts;
  const items = [
    can("quotes") && { key: "quotes", label: c.quotes, value: queues?.quotes, href: "/cotizaciones?estado=new" },
    can("inquiries") && { key: "inquiries", label: c.inquiries, value: queues?.inquiries, href: "/consultas?estado=new" },
    canAccounts && { key: "accounts", label: c.accounts, value: pending, href: "/usuarios?estado=pending" },
  ].filter(Boolean) as { key: string; label: string; value?: number; href: string }[];
  if (items.length === 0) return null;
  return (
    <section className="shortcuts" aria-labelledby="shortcuts-title">
      <h2 id="shortcuts-title" className="shortcuts__title">
        {c.title}
      </h2>
      <ul className="shortcuts__list">
        {items.map((item) => (
          <li key={item.key}>
            <Link href={item.href} className="shortcut" aria-label={item.value === undefined ? item.label : c.open(item.label, item.value)}>
              <span className="shortcut__n" aria-hidden="true">
                {item.value === undefined ? <Skeleton w={36} h={28} /> : formatNumber(item.value, t.locale)}
              </span>
              <span className="shortcut__label">{item.label}</span>
              <IconChevronRight size={16} className="shortcut__go" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Cuentas que esperan confirmar su correo, la más antigua primero, con "Reenviar" a mano (como el inicio anterior
 * al rediseño). Solo para quien administra cuentas; si no hay ninguna, no ocupa espacio.
 */
function PendingAccounts({ list }: { list?: { id: string; name: string; registeredAt: number }[] }) {
  const { t } = usePrefs();
  const c = useHomeCopy().pending;
  const toast = useToast();
  const resend = useResendVerification();
  const [sent, setSent] = useState<string[]>([]);
  if (!list || list.length === 0) return null;
  return (
    <section className="pending" aria-labelledby="pending-title">
      <h2 id="pending-title" className="shortcuts__title">
        {c.title}
      </h2>
      <ul className="pending__list">
        {list.map((u) => (
          <li key={u.id} className="pending__row">
            <Avatar name={u.name} size="sm" />
            <span className="pending__main">
              <Link href={`/usuarios/${u.id}`}>{u.name}</Link>
              <span className="pending__sub">{c.waiting(relativeTime(u.registeredAt, t.locale))}</span>
            </span>
            <button
              type="button"
              className="btn"
              aria-label={c.resendFor(u.name)}
              disabled={sent.includes(u.id) || (resend.isPending && resend.variables === u.id)}
              onClick={() =>
                resend.mutate(u.id, {
                  onSuccess: () => {
                    setSent((s) => [...s, u.id]);
                    toast.success(c.sent);
                  },
                  onError: () => toast.error(c.failed),
                })
              }
            >
              {sent.includes(u.id) ? c.sent : c.resend}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "Ver números del mes": abierto de entrada en computadora (como el inicio de antes del rediseño) y cerrado en el
 * teléfono, donde los gráficos se descargan y se piden solo al abrirlo.
 */
function Numbers() {
  const c = useHomeCopy().numbers;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.matchMedia("(min-width: 1024px)").matches) ref.current.open = true;
  }, []);
  return (
    <details ref={ref} className="numbers" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="numbers__summary">
        <IconChevronRight size={18} className="numbers__chev" aria-hidden="true" />
        <span className="numbers__label">
          <span className="numbers__name">{c.summary}</span>
          <span className="numbers__hint">{c.hint}</span>
        </span>
      </summary>
      {open && <MonthNumbers />}
    </details>
  );
}

function NumbersLoading() {
  const c = useHomeCopy().numbers;
  return (
    <div className="numbers__loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {c.loading}
    </div>
  );
}

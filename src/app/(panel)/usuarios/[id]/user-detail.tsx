"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CaseLoading, CaseMissing } from "@/components/cases/case-detail";
import { CasePill, Field } from "@/components/cases/case-ui";
import { QUOTE_TONE } from "@/components/cases/tones";
import { useSessionUser } from "@/components/shell/session-context";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Avatar, MethodChip, StatusBadge } from "@/components/ui/bits";
import { IconArrowLeft, IconBlocked, IconCopy, IconEdit, IconMore, IconSend, IconTrash, IconUndo } from "@/components/ui/icons";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/users/confirm-dialog";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/data/permissions";
import { useActivity, useCaseList, useDeleteUsers, usePasswordReset, useResendVerification, useSetStatus, useUpdateUser, useUser } from "@/lib/api/queries";
import { formatDate, formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import "../users.css";
import "./user-detail.css";

export function UserDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const d = t.detail;
  const me = useSessionUser();
  const toast = useToast();
  const router = useRouter();
  const query = useUser(id);
  const x = query.data;
  const activity = useActivity({ page: 0, size: 8, userId: id });
  const quotes = useCaseList("quotes", { page: 0, size: 5, q: x?.email ?? "__none__", sort: "newest" });
  const setStatus = useSetStatus();
  const del = useDeleteUsers();
  const resend = useResendVerification();
  const reset = usePasswordReset();
  const update = useUpdateUser();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "disable" | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  if (query.isPending) return <CaseLoading />;
  if (!x) return <CaseMissing base="/usuarios" list={t.users.title} />;

  const isMe = x.email === me.email;
  const perms = new Set(x.roles.flatMap((r) => ROLE_PERMISSIONS[r]));
  const noteValue = notes ?? x.notes;

  return (
    <>
      <header className="case-head">
        <Link href="/usuarios" className="case-head__back">
          <IconArrowLeft size={14} />
          {d.back}
        </Link>
        <div className="case-head__row">
          <div className="profile">
            <Avatar name={x.name} size="lg" />
            <div className="profile__text">
              <div className="case-head__id">
                <h1 className="case-head__title">{x.name}</h1>
                <StatusBadge status={x.status} />
                {isMe && <span className="you-tag">{t.users.you}</span>}
              </div>
              <p className="case-head__meta">
                {x.kind === "staff" ? `${d.staffSince(formatDate(x.registeredAt, t.locale))} · ${x.roles.map((r) => t.roles[r]).join(", ")}` : `${d.member(formatDate(x.registeredAt, t.locale))}${x.company ? ` · ${x.company}` : ""}`}
              </p>
            </div>
          </div>
          <div className="case-head__actions">
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              <IconEdit size={16} />
              {t.common.edit}
            </button>
            {!isMe &&
              (x.status === "disabled" ? (
                <button type="button" className="btn btn--primary" onClick={() => setStatus.mutate({ ids: [x.id], status: "active", actor: me.name }, { onSuccess: () => toast.success(t.toast.enabled(1)) })}>
                  <IconUndo size={16} />
                  {t.users.enable}
                </button>
              ) : (
                <button type="button" className="btn" onClick={() => setConfirm("disable")}>
                  <IconBlocked size={16} />
                  {t.users.disable}
                </button>
              ))}
            <Menu
              trigger={(p) => (
                <button type="button" className="icon-btn icon-btn--outline" aria-label={t.users.rowMenu(x.name)} {...p}>
                  <IconMore size={18} />
                </button>
              )}
            >
              {x.status === "pending" && (
                <MenuItem icon={<IconSend size={16} />} onSelect={() => resend.mutate(x.id, { onSuccess: () => toast.success(t.toast.resent) })}>
                  {t.users.resend}
                </MenuItem>
              )}
              {x.kind === "customer" && x.method === "email" && (
                <MenuItem icon={<IconSend size={16} />} onSelect={() => reset.mutate({ id: x.id, actor: me.name }, { onSuccess: () => toast.success(t.toast.resetSent) })}>
                  {t.users.reset}
                </MenuItem>
              )}
              <MenuItem icon={<IconCopy size={16} />} onSelect={() => navigator.clipboard?.writeText(x.id).then(() => toast.success(t.toast.copied))}>
                {d.id}
              </MenuItem>
              {!isMe && (
                <>
                  <div className="menu__sep" role="separator" />
                  <MenuItem danger icon={<IconTrash size={16} />} onSelect={() => setConfirm("delete")}>
                    {t.users.remove}
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
        </div>
      </header>

      <div className="case-grid">
        <div className="case-main stagger">
          <section className="kpis kpis--3" aria-label={d.usage}>
            {[
              { label: d.quotes, value: x.quotes },
              { label: d.sessions, value: x.sessions },
              { label: d.cart, value: x.cartItems },
            ].map((k) => (
              <div key={k.label} className="kpi">
                <p className="kpi__label">{k.label}</p>
                <span className="kpi__value num">
                  <AnimatedNumber value={k.value} format={(n) => formatNumber(n, t.locale)} />
                </span>
              </div>
            ))}
          </section>

          <section className="panel" aria-labelledby="contact-title">
            <div className="panel__head">
              <h2 id="contact-title" className="panel__title">
                {d.contact}
              </h2>
            </div>
            <dl className="kvs kvs--three">
              <Field label={d.email}>
                <a className="link" href={`mailto:${x.email}`}>
                  {x.email}
                </a>
              </Field>
              <Field label={d.phone}>{x.phone && <span className="num">{x.phone}</span>}</Field>
              <Field label={d.city}>{x.city}</Field>
              <Field label={d.company}>{x.company}</Field>
              <Field label={d.ruc}>{x.ruc && <span className="num">{x.ruc}</span>}</Field>
              <Field label={d.device}>{t.device[x.device]}</Field>
            </dl>
          </section>

          <section className="panel" aria-labelledby="reg-title">
            <div className="panel__head">
              <h2 id="reg-title" className="panel__title">
                {d.registration}
              </h2>
            </div>
            <dl className="kvs kvs--three">
              <Field label={d.method}>
                <MethodChip method={x.method} />
              </Field>
              <Field label={d.source}>{t.source[x.source]}</Field>
              <Field label={d.registered}>{formatDateTime(x.registeredAt, t.locale)}</Field>
              <Field label={d.verified}>{x.emailVerified ? t.common.yes : t.common.no}</Field>
              <Field label={d.newsletter}>{x.newsletter ? d.subscribed : d.notSubscribed}</Field>
              <Field label={d.privacy}>{d.privacyValue(x.privacyNoticeVersion)}</Field>
              <Field label={d.lastActive}>{x.lastActiveAt ? relativeTime(x.lastActiveAt, t.locale) : t.users.never}</Field>
            </dl>
          </section>

          {x.kind === "customer" && (
            <section className="panel" aria-labelledby="uq-title">
              <div className="panel__head">
                <h2 id="uq-title" className="panel__title">
                  {t.cases.quotes.title}
                </h2>
                <Link className="card-link" href="/cotizaciones">
                  {t.common.viewAll}
                </Link>
              </div>
              {!quotes.data ? null : quotes.data.items.length === 0 ? (
                <p className="empty">{d.noQuotes}</p>
              ) : (
                <ul className="rows">
                  {quotes.data.items.map((q) => (
                    <li key={q.id} className="row">
                      <span className="row__main">
                        <Link href={`/cotizaciones/${q.id}`} className="num">
                          {q.code}
                        </Link>
                        <span className="row__sub">
                          {q.items[0].product} {q.items[0].dn} · {q.destination}
                        </span>
                      </span>
                      <span className="row__end">{relativeTime(q.createdAt, t.locale)}</span>
                      <CasePill tone={QUOTE_TONE[q.status]}>{t.cases.quotes.status[q.status]}</CasePill>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="panel" aria-labelledby="ua-title">
            <div className="panel__head">
              <h2 id="ua-title" className="panel__title">
                {d.activity}
              </h2>
              <Link className="card-link" href="/actividad">
                {t.common.viewAll}
              </Link>
            </div>
            {!activity.data ? null : activity.data.items.length === 0 ? (
              <p className="empty">{d.noActivity}</p>
            ) : (
              <ul className="rows">
                {activity.data.items.map((a) => (
                  <li key={a.id} className="row">
                    <span className="row__main">
                      <span>{t.activity.sentence(a, (m) => t.method[m as keyof typeof t.method] ?? m, (r) => r.split(",").map((x) => t.roles[x as keyof typeof t.roles] ?? x).join(", "))}</span>
                    </span>
                    <time className="row__end" dateTime={new Date(a.at).toISOString()} title={formatDateTime(a.at, t.locale)}>
                      {relativeTime(a.at, t.locale)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="case-side stagger">
          <section className="panel side-panel" aria-labelledby="perm-title">
            <h2 id="perm-title" className="panel__title">
              {d.access}
            </h2>
            <div className="role-list">
              {x.roles.map((r) => (
                <div key={r} className="role-list__item">
                  <strong>{t.roles[r]}</strong>
                  <span>{t.roleText[r]}</span>
                </div>
              ))}
            </div>
            {perms.size === 0 ? (
              <p className="panel__meta">{d.noPerms}</p>
            ) : (
              <ul className="perm-chips">
                {PERMISSIONS.filter((p) => perms.has(p.id)).map((p) => (
                  <li key={p.id}>{t.perms[p.id]}</li>
                ))}
              </ul>
            )}
            <Link href="/roles" className="card-link">
              {d.manageRoles}
            </Link>
          </section>

          <section className="panel side-panel" aria-labelledby="notes-title">
            <h2 id="notes-title" className="panel__title">
              {d.notes}
            </h2>
            <label className="sr-only" htmlFor="user-notes">
              {d.notes}
            </label>
            <textarea id="user-notes" className="textarea" rows={4} placeholder={d.notesPh} value={noteValue} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            <button
              type="button"
              className="btn"
              disabled={notes === null || notes === x.notes || update.isPending}
              onClick={() =>
                update.mutate(
                  { id: x.id, patch: { notes: noteValue }, actor: me.name },
                  {
                    onSuccess: () => {
                      setNotes(null);
                      toast.success(t.toast.updated);
                    },
                  },
                )
              }
            >
              {d.notesSave}
            </button>
          </section>

          <section className="panel side-panel">
            <dl className="kvs kvs--stack">
              <Field label={d.id}>
                <span className="num id-text">{x.id}</span>
              </Field>
            </dl>
          </section>
        </aside>
      </div>

      <UserFormDialog open={editing} user={x} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? t.confirm.deleteTitle(1) : t.confirm.disableTitle(1)}
        text={confirm === "delete" ? t.confirm.deleteText : t.confirm.disableText}
        confirmLabel={confirm === "delete" ? t.confirm.deleteOk : t.confirm.disableOk}
        requireWord={confirm === "delete" ? t.confirm.word : undefined}
        busy={del.isPending || setStatus.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === "delete")
            del.mutate(
              { ids: [x.id], actor: me.name },
              {
                onSuccess: () => {
                  toast.success(t.toast.deleted(1));
                  router.push("/usuarios");
                },
              },
            );
          else setStatus.mutate({ ids: [x.id], status: "disabled", actor: me.name }, { onSuccess: () => (toast.success(t.toast.disabled(1)), setConfirm(null)) });
        }}
      />
    </>
  );
}

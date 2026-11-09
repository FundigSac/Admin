"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CasePill } from "@/components/cases/case-ui";
import { QUOTE_TONE } from "@/components/cases/tones";
import { useSessionUser } from "@/components/shell/session-context";
import { Avatar, MethodIcon, Skeleton } from "@/components/ui/bits";
import { IconArrowLeft, IconBlocked, IconCopy, IconEdit, IconMore, IconSend, IconTrash, IconUndo } from "@/components/ui/icons";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { useAccessCopy, GROUP_ORDER } from "@/components/users/access-copy";
import { AccountStatus, Datum, useJobLabel } from "@/components/users/account-bits";
import { IconCheck } from "@/components/users/account-icons";
import { ConfirmDialog } from "@/components/users/confirm-dialog";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { useUsersCopy } from "@/components/users/users-copy";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/data/permissions";
import { useActivity, useCaseList, useDeleteUsers, usePasswordReset, useResendVerification, useSetStatus, useUpdateUser, useUser } from "@/lib/api/queries";
import { formatDate, formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import "../users.css";
import "./user-detail.css";

/**
 * Ficha de una cuenta (brief de diseño §6.3): arriba el nombre, una frase con su estado y el siguiente paso como único
 * botón principal (Reenviar correo, Reactivar cuenta o Editar datos). Bloquear usa el color de error y nunca es el
 * principal; eliminar vive en "Más acciones" y pide escribir una palabra.
 */
export function UserDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const c = useUsersCopy();
  const d = c.detail;
  const a = useAccessCopy();
  const job = useJobLabel();
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

  if (query.isPending) return <DetailLoading />;
  if (!x) return <DetailMissing />;

  const isMe = x.email === me.email;
  const perms = new Set(x.roles.flatMap((r) => ROLE_PERMISSIONS[r]));
  const noteValue = notes ?? x.notes;
  const fail = () => toast.error(c.error);
  const date = formatDate(x.registeredAt, t.locale);
  const lastSeen = x.lastActiveAt ? relativeTime(x.lastActiveAt, t.locale) : null;

  const doResend = () => resend.mutate(x.id, { onSuccess: () => toast.success(c.toast.resent), onError: fail });
  const doEnable = () => setStatus.mutate({ ids: [x.id], status: "active", actor: me.name }, { onSuccess: () => toast.success(c.toast.enabled(1)), onError: fail });

  const sentence =
    x.status === "pending" ? (x.kind === "customer" ? d.state.pendingCustomer(date) : d.state.pendingStaff) : x.status === "disabled" ? d.state.disabled : d.state.active(lastSeen);

  // Un solo botón relleno: el siguiente paso según el estado de la cuenta.
  const primary =
    x.status === "pending" ? (
      <button type="button" className="btn btn--primary" onClick={doResend} disabled={resend.isPending}>
        {resend.isPending ? <span className="spinner" aria-hidden="true" /> : <IconSend size={18} aria-hidden="true" />}
        {d.resend}
      </button>
    ) : x.status === "disabled" && !isMe ? (
      <button type="button" className="btn btn--primary" onClick={doEnable} disabled={setStatus.isPending}>
        {setStatus.isPending ? <span className="spinner" aria-hidden="true" /> : <IconUndo size={18} aria-hidden="true" />}
        {d.enable}
      </button>
    ) : (
      <button type="button" className="btn btn--primary" onClick={() => setEditing(true)}>
        <IconEdit size={18} aria-hidden="true" />
        {d.edit}
      </button>
    );
  const editIsPrimary = !(x.status === "pending" || (x.status === "disabled" && !isMe));

  return (
    <>
      <Link href="/usuarios" className="acct-back">
        <IconArrowLeft size={16} aria-hidden="true" />
        {d.back}
      </Link>

      <header className="acct-head">
        <div className="acct-head__id">
          <Avatar name={x.name} size="lg" />
          <div className="acct-head__text">
            <h1 className="acct-head__name">
              {x.name}
              {isMe && <span className="you-tag">{c.you}</span>}
            </h1>
            <p className="acct-head__meta">
              {x.kind === "staff" ? d.staffSince(date) : d.customerSince(date)}
              <span aria-hidden="true"> · </span>
              <span>{x.kind === "staff" ? job(x) : (x.company ?? c.naturalPerson)}</span>
            </p>
          </div>
        </div>
        <div className="acct-head__actions">
          {!editIsPrimary && (
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              <IconEdit size={18} aria-hidden="true" />
              {d.edit}
            </button>
          )}
          {!isMe && x.status !== "disabled" && (
            <button type="button" className="btn btn--danger-outline" onClick={() => setConfirm("disable")}>
              <IconBlocked size={18} aria-hidden="true" />
              {d.disable}
            </button>
          )}
          <Menu
            trigger={(p) => (
              <button type="button" className="icon-btn icon-btn--outline" aria-label={d.more(x.name)} {...p}>
                <IconMore size={20} />
              </button>
            )}
          >
            {x.kind === "customer" && x.method === "email" && (
              <MenuItem icon={<IconSend size={16} />} onSelect={() => reset.mutate({ id: x.id, actor: me.name }, { onSuccess: () => toast.success(c.toast.resetSent), onError: fail })}>
                {d.reset}
              </MenuItem>
            )}
            <MenuItem icon={<IconCopy size={16} />} onSelect={() => navigator.clipboard?.writeText(x.id).then(() => toast.success(c.toast.copied))}>
              {d.copyId}
            </MenuItem>
            {!isMe && (
              <>
                <div className="menu__sep" role="separator" />
                <MenuItem danger icon={<IconTrash size={16} />} onSelect={() => setConfirm("delete")}>
                  {d.remove}
                </MenuItem>
              </>
            )}
          </Menu>
          {primary}
        </div>
      </header>

      <section className={`acct-state acct-state--${x.status}`} aria-label={c.list.col.status}>
        <AccountStatus status={x.status} />
        <p className="acct-state__text">{sentence}</p>
      </section>

      <div className="acct-grid">
        <div className="acct-main">
          {x.kind === "customer" && (
            <dl className="acct-usage" aria-label={d.usage}>
              {[
                { label: d.quotes, value: x.quotes },
                { label: d.sessions, value: x.sessions },
                { label: d.cart, value: x.cartItems },
              ].map((k) => (
                <div key={k.label} className="acct-usage__item">
                  <dt>{k.label}</dt>
                  <dd className="num">{formatNumber(k.value, t.locale)}</dd>
                </div>
              ))}
            </dl>
          )}

          <section className="panel acct-block" aria-labelledby="acct-contact">
            <h2 id="acct-contact" className="panel__title">
              {d.contact}
            </h2>
            <dl className="data-grid">
              <Datum label={d.email}>
                <a className="link" href={`mailto:${x.email}`}>
                  {x.email}
                </a>
              </Datum>
              <Datum label={d.phone}>{x.phone && <span className="num">{x.phone}</span>}</Datum>
              {x.kind === "customer" && (
                <>
                  <Datum label={d.company}>{x.company}</Datum>
                  <Datum label={d.ruc}>{x.ruc && <span className="code">{x.ruc}</span>}</Datum>
                  <Datum label={d.city}>{x.city}</Datum>
                  <Datum label={d.device}>{x.device && c.device[x.device]}</Datum>
                </>
              )}
            </dl>
          </section>

          <section className="panel acct-block" aria-labelledby="acct-origin">
            <h2 id="acct-origin" className="panel__title">
              {d.registration}
            </h2>
            <dl className="data-grid">
              <Datum label={d.registered}>{formatDateTime(x.registeredAt, t.locale)}</Datum>
              <Datum label={d.verified}>{x.emailVerified ? c.yes : c.no}</Datum>
              <Datum label={d.lastActive}>{lastSeen ?? c.never}</Datum>
              {x.kind === "customer" ? (
                <>
                  <Datum label={d.method}>
                    <span className="method">
                      <MethodIcon method={x.method} />
                      {c.method[x.method]}
                    </span>
                  </Datum>
                  <Datum label={d.source}>{c.source[x.source]}</Datum>
                  <Datum label={d.newsletter}>{x.newsletter ? c.yes : c.no}</Datum>
                  <Datum label={d.privacy}>{x.privacyNoticeVersion && d.privacyValue(x.privacyNoticeVersion)}</Datum>
                </>
              ) : (
                <Datum label={d.sessions}>{formatNumber(x.sessions, t.locale)}</Datum>
              )}
            </dl>
          </section>

          {x.kind === "customer" && (
            <section className="panel acct-block" aria-labelledby="acct-quotes">
              <div className="panel__head">
                <h2 id="acct-quotes" className="panel__title">
                  {d.quotesTitle}
                </h2>
                <Link className="card-link" href="/cotizaciones">
                  {d.viewAll}
                </Link>
              </div>
              {!quotes.data ? (
                <Skeleton w="100%" h={56} />
              ) : quotes.data.items.length === 0 ? (
                <p className="acct-none">{d.noQuotes}</p>
              ) : (
                <ul className="rows">
                  {quotes.data.items.map((q) => (
                    <li key={q.id} className="row">
                      <span className="row__main">
                        <Link href={`/cotizaciones/${q.id}`} className="code">
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

          <section className="panel acct-block" aria-labelledby="acct-activity">
            <div className="panel__head">
              <h2 id="acct-activity" className="panel__title">
                {d.activity}
              </h2>
              <Link className="card-link" href="/actividad">
                {d.history}
              </Link>
            </div>
            {!activity.data ? (
              <Skeleton w="100%" h={56} />
            ) : activity.data.items.length === 0 ? (
              <p className="acct-none">{d.noActivity}</p>
            ) : (
              <ol className="timeline">
                {activity.data.items.map((e) => (
                  <li key={e.id} className="timeline__item">
                    <span className="timeline__text">{t.activity.sentence(e, (m) => t.method[m as keyof typeof t.method] ?? m, (r) => r.split(",").map((v) => t.roles[v as keyof typeof t.roles] ?? v).join(", "))}</span>
                    <time className="timeline__when" dateTime={new Date(e.at).toISOString()} title={formatDateTime(e.at, t.locale)}>
                      {relativeTime(e.at, t.locale)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="acct-side">
          <section className="panel acct-block" aria-labelledby="acct-access">
            <h2 id="acct-access" className="panel__title">
              {d.access}
            </h2>
            {x.kind === "customer" || perms.size === 0 ? (
              <p className="acct-none">{d.noPerms}</p>
            ) : (
              <>
                <ul className="acct-roles">
                  {x.roles.map((r) => (
                    <li key={r}>
                      <strong>{t.roles[r]}</strong>
                      <p>{a.roleText[r]}</p>
                    </li>
                  ))}
                </ul>
                <ul className="can-list">
                  {GROUP_ORDER.flatMap((g) => PERMISSIONS.filter((p) => p.group === g && perms.has(p.id))).map((p) => (
                    <li key={p.id}>
                      <IconCheck size={14} aria-hidden="true" />
                      {a.perm[p.id]}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Link href="/roles" className="card-link">
              {d.rolesLink}
            </Link>
          </section>

          <section className="panel acct-block" aria-labelledby="acct-notes">
            <h2 id="acct-notes" className="panel__title">
              {d.notes}
            </h2>
            <p className="acct-hint" id="acct-notes-hint">
              {d.notesHint}
            </p>
            <label className="sr-only" htmlFor="acct-notes-field">
              {d.notes}
            </label>
            <textarea
              id="acct-notes-field"
              className="textarea"
              rows={4}
              aria-describedby="acct-notes-hint"
              placeholder={d.notesPh}
              value={noteValue}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
            <button
              type="button"
              className="btn acct-notes__save"
              disabled={notes === null || notes === x.notes || update.isPending}
              onClick={() =>
                update.mutate(
                  { id: x.id, patch: { notes: noteValue }, actor: me.name },
                  {
                    onSuccess: () => {
                      setNotes(null);
                      toast.success(c.toast.noteSaved);
                    },
                    onError: fail,
                  },
                )
              }
            >
              {update.isPending && <span className="spinner" aria-hidden="true" />}
              {d.notesSave}
            </button>
          </section>

          <section className="panel acct-block" aria-labelledby="acct-id">
            <h2 id="acct-id" className="panel__title">
              {d.id}
            </h2>
            <p className="acct-hint">{d.idHint}</p>
            <div className="acct-id">
              <span className="code acct-id__value">{x.id}</span>
              <button type="button" className="icon-btn icon-btn--outline" aria-label={d.copyId} onClick={() => navigator.clipboard?.writeText(x.id).then(() => toast.success(c.toast.copied))}>
                <IconCopy size={18} />
              </button>
            </div>
          </section>
        </aside>
      </div>

      <UserFormDialog open={editing} user={x} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? c.confirm.deleteTitle(1) : c.confirm.disableTitle(1)}
        text={confirm === "delete" ? c.confirm.deleteText : c.confirm.disableText}
        confirmLabel={confirm === "delete" ? c.confirm.deleteOk : c.confirm.disableOk}
        requireWord={confirm === "delete" ? c.confirm.word : undefined}
        busy={del.isPending || setStatus.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === "delete")
            del.mutate(
              { ids: [x.id], actor: me.name },
              {
                onSuccess: () => {
                  toast.success(c.toast.deleted(1));
                  router.push("/usuarios");
                },
                onError: fail,
              },
            );
          else setStatus.mutate({ ids: [x.id], status: "disabled", actor: me.name }, { onSuccess: () => (toast.success(c.toast.disabled(1)), setConfirm(null)), onError: fail });
        }}
      />
    </>
  );
}

function DetailLoading() {
  const d = useUsersCopy().detail;
  return (
    <div role="status" aria-busy="true" aria-label={d.loading}>
      <Skeleton w={160} h={16} />
      <div className="acct-head acct-head--loading">
        <Skeleton w={56} h={56} />
        <Skeleton w="40%" h={28} />
      </div>
      <Skeleton w="100%" h={60} />
    </div>
  );
}

function DetailMissing() {
  const d = useUsersCopy().detail;
  return (
    <div className="empty acct-missing">
      <h1 className="acct-missing__title">{d.notFound}</h1>
      <Link href="/usuarios" className="btn">
        {d.toList}
      </Link>
    </div>
  );
}


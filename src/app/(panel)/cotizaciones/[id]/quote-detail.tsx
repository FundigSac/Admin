"use client";

import Link from "next/link";
import { AssigneeCard, ContactCard, HistoryCard } from "@/components/cases/case-detail";
import { CasePill, Field } from "@/components/cases/case-ui";
import { QUOTE_TONE } from "@/components/cases/tones";
import { useRequestsCopy } from "@/components/requests/copy";
import { NowPanel, RequestHeader, RequestLayout, RequestLoading, RequestMissing } from "@/components/requests/request-detail";
import { useSessionUser } from "@/components/shell/session-context";
import { IconMail } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { QuoteStatus } from "@/data/types";
import { useCase, useUpdateCase } from "@/lib/api/queries";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const FLOW: QuoteStatus[] = ["new", "reviewing", "sent"];

export function QuoteDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const c = t.cases.quotes;
  const r = useRequestsCopy();
  const me = useSessionUser();
  const toast = useToast();
  const query = useCase("quotes", id);
  const update = useUpdateCase("quotes");

  if (query.isPending) return <RequestLoading />;
  const x = query.data;
  if (!x) return <RequestMissing module="quotes" list={c.title} />;

  const move = (status: QuoteStatus) =>
    update.mutate(
      { id: x.id, patch: { status, assignee: x.assignee ?? me.name }, event: { label: status }, actor: me.name },
      { onSuccess: () => toast.success(t.cases.common.updated) },
    );

  const closed = x.status === "won" || x.status === "lost";
  const busy = update.isPending;
  const spinner = busy ? <span className="spinner" aria-hidden="true" /> : null;
  const mail = (
    <a className="btn btn--block" href={`mailto:${x.email}?subject=${encodeURIComponent(`${c.title} ${x.code}`)}`}>
      <IconMail size={18} />
      {r.common.mail}
    </a>
  );

  const action =
    x.status === "new" ? (
      <div className="rq-now__actions">
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => move("reviewing")} disabled={busy}>
          {spinner}
          {r.quotes.start}
        </button>
      </div>
    ) : x.status === "reviewing" ? (
      <div className="rq-now__actions">
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => move("sent")} disabled={busy}>
          {spinner}
          {r.quotes.markSent}
        </button>
        {mail}
      </div>
    ) : x.status === "sent" ? (
      <div className="rq-now__pair">
        <button type="button" className="btn btn--primary btn--lg" onClick={() => move("won")} disabled={busy}>
          {r.quotes.won}
        </button>
        <button type="button" className="btn btn--lg" onClick={() => move("lost")} disabled={busy}>
          {r.quotes.lost}
        </button>
      </div>
    ) : null;

  return (
    <>
      <RequestHeader
        module="quotes"
        list={c.title}
        title={r.quotes.detailTitle}
        code={x.code}
        status={<CasePill tone={QUOTE_TONE[x.status]}>{c.status[x.status]}</CasePill>}
        meta={[x.company, c.source[x.source], formatDateTime(x.createdAt, t.locale)]}
      />

      <RequestLayout
        now={
          <NowPanel
            module="quotes"
            id={x.id}
            stateKey={x.status}
            text={r.quotes.now[x.status]}
            finished={closed}
            current={closed ? FLOW.length : FLOW.indexOf(x.status)}
            steps={[...FLOW.map((s) => ({ key: s, title: c.status[s] })), { key: "end", title: closed ? c.status[x.status] : `${c.status.won} / ${c.status.lost}` }]}
          >
            {action}
          </NowPanel>
        }
        main={
          <>
            <section className="panel" aria-labelledby="items-title">
              <div className="panel__head">
                <div>
                  <h2 id="items-title" className="panel__title">
                    {r.quotes.asked}
                  </h2>
                  <p className="panel__meta">{c.family[x.family]}</p>
                </div>
              </div>
              <table className="table items-table">
                <thead>
                  <tr>
                    <th scope="col">{c.product}</th>
                    <th scope="col">{c.size}</th>
                    <th scope="col" className="n">
                      {c.qty}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {x.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.product}</td>
                      <td className="cell-muted num">{it.dn}</td>
                      <td className="n num">
                        {formatNumber(it.qty, t.locale)}
                        <small>{c.unit[it.unit]}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel" aria-labelledby="msg-title">
              <div className="panel__head">
                <h2 id="msg-title" className="panel__title">
                  {c.message}
                </h2>
              </div>
              <p className="quote-text">{x.message}</p>
            </section>

            <section className="panel" aria-labelledby="project-title">
              <div className="panel__head">
                <h2 id="project-title" className="panel__title">
                  {c.projectInfo}
                </h2>
              </div>
              <dl className="kvs kvs--three">
                <Field label={c.projectType}>{c.project[x.projectType]}</Field>
                <Field label={c.destination}>{x.destination}</Field>
                <Field label={c.deliveryBy}>{x.deliveryBy ? formatDate(x.deliveryBy, t.locale) : null}</Field>
                <Field label={c.company}>{x.company}</Field>
                <Field label={c.ruc}>
                  <span className="code">{x.ruc}</span>
                </Field>
                <Field label={c.channel}>{c.source[x.source]}</Field>
              </dl>
            </section>
          </>
        }
        side={
          <>
            <ContactCard
              name={x.contactName}
              email={x.email}
              phone={x.phone}
              extra={
                <p className="panel__meta">
                  {x.contactRole}
                  {x.userId && (
                    <>
                      {" · "}
                      <Link className="link" href={`/usuarios/${x.userId}`}>
                        {t.cases.common.openAccount}
                      </Link>
                    </>
                  )}
                </p>
              }
            />
            <AssigneeCard module="quotes" item={x} roles={["sales"]} />
            <HistoryCard module="quotes" item={x} />
          </>
        }
      />
    </>
  );
}

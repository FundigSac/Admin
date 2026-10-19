"use client";

import Link from "next/link";
import { AssigneeCard, CaseHeader, CaseLoading, CaseMissing, ContactCard, HistoryCard } from "@/components/cases/case-detail";
import { CasePill, Field } from "@/components/cases/case-ui";
import { QUOTE_TONE } from "@/components/cases/tones";
import { useSessionUser } from "@/components/shell/session-context";
import { useToast } from "@/components/ui/toast";
import type { QuoteStatus } from "@/data/types";
import { useCase, useUpdateCase } from "@/lib/api/queries";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const FLOW: QuoteStatus[] = ["new", "reviewing", "sent"];

export function QuoteDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const c = t.cases.quotes;
  const me = useSessionUser();
  const toast = useToast();
  const query = useCase("quotes", id);
  const update = useUpdateCase("quotes");

  if (query.isPending) return <CaseLoading />;
  const x = query.data;
  if (!x) return <CaseMissing base="/cotizaciones" list={c.title} />;

  const move = (status: QuoteStatus, label: string) =>
    update.mutate(
      { id: x.id, patch: { status, assignee: x.assignee ?? me.name }, event: { label }, actor: me.name },
      { onSuccess: () => toast.success(t.cases.common.updated) },
    );

  const step = FLOW.indexOf(x.status);
  const actions =
    x.status === "new" ? (
      <button type="button" className="btn btn--primary" onClick={() => move("reviewing", "reviewing")} disabled={update.isPending}>
        {c.actions.review}
      </button>
    ) : x.status === "reviewing" ? (
      <button type="button" className="btn btn--primary" onClick={() => move("sent", "sent")} disabled={update.isPending}>
        {c.actions.sent}
      </button>
    ) : x.status === "sent" ? (
      <>
        <button type="button" className="btn" onClick={() => move("lost", "lost")} disabled={update.isPending}>
          {c.actions.lost}
        </button>
        <button type="button" className="btn btn--primary" onClick={() => move("won", "won")} disabled={update.isPending}>
          {c.actions.won}
        </button>
      </>
    ) : null;

  return (
    <>
      <CaseHeader
        base="/cotizaciones"
        list={c.title}
        code={x.code}
        pill={<CasePill tone={QUOTE_TONE[x.status]}>{c.status[x.status]}</CasePill>}
        meta={
[x.company, c.source[x.source], formatDateTime(x.createdAt, t.locale)]
        }
        actions={actions}
      />

      <div className="case-grid">
        <div className="case-main stagger">
          <section className="panel" aria-labelledby="items-title">
            <div className="panel__head">
              <div>
                <h2 id="items-title" className="panel__title">
                  {c.requested}
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
                <span className="num">{x.ruc}</span>
              </Field>
              <Field label={c.channel}>{c.source[x.source]}</Field>
              <Field label={c.message} wide>
                <p className="quote-text">{x.message}</p>
              </Field>
            </dl>
          </section>

          <section className="panel" aria-labelledby="flow-title">
            <div className="panel__head">
              <h2 id="flow-title" className="panel__title">
                {c.workflow}
              </h2>
            </div>
            <ol className="steps steps--three">
              {FLOW.map((s, i) => (
                <li key={s} className={`step${step > i || ["won", "lost"].includes(x.status) ? " step--done" : step === i ? " step--current" : ""}`}>
                  <span className="step__title">{c.status[s]}</span>
                </li>
              ))}
              <li className={`step${x.status === "won" || x.status === "lost" ? " step--current" : ""}`}>
                <span className="step__title">{x.status === "lost" ? c.status.lost : c.status.won}</span>
              </li>
            </ol>
          </section>
        </div>

        <aside className="case-side stagger">
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
        </aside>
      </div>
    </>
  );
}

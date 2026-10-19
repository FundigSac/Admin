"use client";

import { useState } from "react";
import { AssigneeCard, CaseHeader, CaseLoading, CaseMissing, ContactCard, HistoryCard } from "@/components/cases/case-detail";
import { CasePill, DeadlineChip, Field } from "@/components/cases/case-ui";
import { CLAIM_TONE } from "@/components/cases/tones";
import { useSessionUser } from "@/components/shell/session-context";
import { IconLegal, IconSend } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useCase, useUpdateCase } from "@/lib/api/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

export function ClaimDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const c = t.cases.claims;
  const me = useSessionUser();
  const toast = useToast();
  const query = useCase("claims", id);
  const update = useUpdateCase("claims");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (query.isPending) return <CaseLoading />;
  const x = query.data;
  if (!x) return <CaseMissing base="/reclamaciones" list={c.title} />;

  const closed = x.status === "answered";
  const money = x.amount === null ? null : new Intl.NumberFormat(t.locale, { style: "currency", currency: x.currency, minimumFractionDigits: 2 }).format(x.amount);

  const send = () => {
    const text = answer.trim();
    if (text.length < 20) {
      setError(c.answerEmpty);
      return;
    }
    update.mutate(
      { id: x.id, patch: { status: "answered", answer: { text, at: Date.now(), actor: me.name }, assignee: x.assignee ?? me.name }, event: { label: "answered" }, actor: me.name },
      {
        onSuccess: () => {
          setAnswer("");
          toast.success(c.sentToast);
        },
      },
    );
  };

  return (
    <>
      <CaseHeader
        base="/reclamaciones"
        list={c.title}
        code={`${c.sheet} ${x.code}`}
        pill={<CasePill tone={CLAIM_TONE[x.status]}>{c.status[x.status]}</CasePill>}
        meta={
          <>
            {c.kind[x.kind]} · {formatDateTime(x.createdAt, t.locale)} · <DeadlineChip dueAt={x.dueAt} closed={closed} />
          </>
        }
        actions={
          <>
            {x.status === "received" && (
              <button
                type="button"
                className="btn"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: x.id, patch: { status: "in_progress", assignee: x.assignee ?? me.name }, event: { label: "assigned", note: x.assignee ?? me.name }, actor: me.name }, { onSuccess: () => toast.success(t.cases.common.updated) })}
              >
                {c.attend}
              </button>
            )}
            <button type="button" className="btn" onClick={() => window.print()}>
              {c.print}
            </button>
          </>
        }
      />

      <div className="case-grid">
        <div className="case-main stagger">
          <section className="panel" aria-labelledby="sheet-title">
            <div className="panel__head">
              <div>
                <h2 id="sheet-title" className="panel__title">
                  {c.sheet}
                </h2>
                <p className="panel__meta">
                  {c.provider}: {c.providerText}
                </p>
              </div>
            </div>

            <div className="sheet-block">
              <h3>{c.s1}</h3>
              <dl className="kvs">
                <Field label={c.name}>{x.name}</Field>
                <Field label={c.doc}>
                  <span className="num">
                    {x.docType} {x.docNumber}
                  </span>
                </Field>
                <Field label={c.address} wide>
                  {x.address}
                </Field>
                <Field label={t.cases.common.email}>{x.email}</Field>
                <Field label={t.cases.common.phone}>
                  <span className="num">{x.phone}</span>
                </Field>
                {x.minor && (
                  <Field label={c.representative} wide>
                    {x.representative ? `${x.representative.name} · ${x.representative.doc}` : null}
                  </Field>
                )}
              </dl>
            </div>

            <div className="sheet-block">
              <h3>{c.s2}</h3>
              <dl className="kvs kvs--three">
                {x.kind === "reclamo" ? (
                  <>
                    <Field label={c.goodType}>{x.goodType ? c.goods[x.goodType] : null}</Field>
                    <Field label={c.product}>{x.product}</Field>
                    <Field label={c.amount}>{money && <span className="num">{money}</span>}</Field>
                  </>
                ) : (
                  <Field label={c.place}>{x.place}</Field>
                )}
                <Field label={c.eventDate}>{formatDate(x.eventDate, t.locale)}</Field>
                <Field label={c.orderRef}>{x.orderRef && <span className="num">{x.orderRef}</span>}</Field>
              </dl>
            </div>

            <div className="sheet-block">
              <h3>{c.s3}</h3>
              <dl className="kvs kvs--stack">
                <Field label={c.facts}>
                  <p className="quote-text">{x.facts}</p>
                </Field>
                <Field label={c.request}>
                  <p className="quote-text">{x.request}</p>
                </Field>
                <Field label={c.channel}>{x.responseChannel}</Field>
              </dl>
            </div>
          </section>

          <section className="panel" aria-labelledby="answer-title">
            <div className="panel__head">
              <h2 id="answer-title" className="panel__title">
                {c.answer}
              </h2>
            </div>
            {x.answer ? (
              <>
                <p className="quote-text">{x.answer.text}</p>
                <p className="panel__meta" style={{ marginTop: 10 }}>
                  {c.answeredOn(formatDateTime(x.answer.at, t.locale), x.answer.actor)}
                </p>
              </>
            ) : (
              <div className="composer">
                <label className="sr-only" htmlFor="claim-answer">
                  {c.answer}
                </label>
                <textarea
                  id="claim-answer"
                  className="textarea"
                  rows={5}
                  placeholder={c.answerPh}
                  value={answer}
                  maxLength={3000}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="claim-answer-hint"
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setError(null);
                  }}
                />
                <div className="composer__foot">
                  <p className={error ? "field__error" : "field__hint"} id="claim-answer-hint">
                    {error ?? c.answerHint(x.responseChannel)}
                  </p>
                  <button type="button" className="btn btn--primary" onClick={send} disabled={update.isPending}>
                    {update.isPending ? <span className="spinner" aria-hidden="true" /> : <IconSend size={16} />}
                    {update.isPending ? c.sending : c.send}
                  </button>
                </div>
              </div>
            )}
          </section>

          <p className="legal-note">
            <IconLegal size={16} style={{ display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
            {c.legal}
          </p>
        </div>

        <aside className="case-side stagger">
          <ContactCard name={x.name} email={x.email} phone={x.phone} />
          <AssigneeCard module="claims" item={x} roles={["legal_support"]} />
          <HistoryCard module="claims" item={x} />
        </aside>
      </div>
    </>
  );
}

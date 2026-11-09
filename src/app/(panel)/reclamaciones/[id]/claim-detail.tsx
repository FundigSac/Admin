"use client";

import { AssigneeCard, ContactCard, HistoryCard } from "@/components/cases/case-detail";
import { CasePill, DeadlineChip, Field } from "@/components/cases/case-ui";
import { CLAIM_TONE } from "@/components/cases/tones";
import { useRequestsCopy } from "@/components/requests/copy";
import { Composer, LegalNote, NowPanel, PrintButton, RequestHeader, RequestLayout, RequestLoading, RequestMissing } from "@/components/requests/request-detail";
import { useSessionUser } from "@/components/shell/session-context";
import { useToast } from "@/components/ui/toast";
import type { ClaimStatus } from "@/data/types";
import { useCase, useUpdateCase } from "@/lib/api/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const FLOW: ClaimStatus[] = ["received", "in_progress", "answered"];

export function ClaimDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const c = t.cases.claims;
  const r = useRequestsCopy();
  const me = useSessionUser();
  const toast = useToast();
  const query = useCase("claims", id);
  const update = useUpdateCase("claims");

  if (query.isPending) return <RequestLoading />;
  const x = query.data;
  if (!x) return <RequestMissing module="claims" list={c.title} />;

  const closed = x.status === "answered";
  const busy = update.isPending;
  const money = x.amount === null ? null : new Intl.NumberFormat(t.locale, { style: "currency", currency: x.currency, minimumFractionDigits: 2 }).format(x.amount);

  const take = () =>
    update.mutate(
      { id: x.id, patch: { status: "in_progress", assignee: x.assignee ?? me.name }, event: { label: "assigned", note: x.assignee ?? me.name }, actor: me.name },
      { onSuccess: () => toast.success(t.cases.common.updated) },
    );

  const answer = (text: string, done: () => void) =>
    update.mutate(
      { id: x.id, patch: { status: "answered", answer: { text, at: Date.now(), actor: me.name }, assignee: x.assignee ?? me.name }, event: { label: "answered" }, actor: me.name },
      {
        onSuccess: () => {
          done();
          toast.success(c.sentToast);
        },
      },
    );

  const text =
    x.status === "received"
      ? r.claims.now.received(formatDate(x.dueAt, t.locale, { day: "numeric", month: "long" }))
      : x.status === "in_progress"
        ? r.claims.now.in_progress(x.responseChannel)
        : x.answer
          ? c.answeredOn(formatDateTime(x.answer.at, t.locale), x.answer.actor)
          : c.status.answered;

  return (
    <>
      <RequestHeader
        module="claims"
        list={c.title}
        title={c.sheet}
        code={x.code}
        status={<CasePill tone={CLAIM_TONE[x.status]}>{c.status[x.status]}</CasePill>}
        meta={[<DeadlineChip key="due" dueAt={x.dueAt} closed={closed} />, c.kind[x.kind], formatDateTime(x.createdAt, t.locale)]}
        actions={<PrintButton label={c.print} />}
      />

      <RequestLayout
        now={
          <NowPanel module="claims" id={x.id} stateKey={x.status} text={text} finished={closed} current={FLOW.indexOf(x.status)} steps={FLOW.map((s) => ({ key: s, title: c.status[s] }))}>
            {x.status === "received" ? (
              <div className="rq-now__actions">
                <button type="button" className="btn btn--primary btn--lg btn--block" onClick={take} disabled={busy}>
                  {busy && <span className="spinner" aria-hidden="true" />}
                  {r.claims.take}
                </button>
              </div>
            ) : x.status === "in_progress" ? (
              <Composer
                id="claim-answer"
                label={c.answer}
                placeholder={c.answerPh}
                hint={c.answerHint(x.responseChannel)}
                min={20}
                send={c.send}
                sending={c.sending}
                pending={busy}
                onSend={answer}
              />
            ) : null}
          </NowPanel>
        }
        main={
          <>
            <section className="panel" aria-labelledby="sheet-title">
              <div className="panel__head">
                <div>
                  <h2 id="sheet-title" className="panel__title">
                    {c.sheet}
                  </h2>
                  <p className="panel__meta panel__meta--prose">
                    {c.provider}: {c.providerText}
                  </p>
                </div>
              </div>

              <div className="sheet-block">
                <h3>{c.s1}</h3>
                <dl className="kvs">
                  <Field label={c.name}>{x.name}</Field>
                  <Field label={c.doc}>
                    <span>
                      {x.docType} <span className="code">{x.docNumber}</span>
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

            {x.answer && (
              <section className="panel" aria-labelledby="answer-title">
                <div className="panel__head">
                  <div>
                    <h2 id="answer-title" className="panel__title">
                      {c.answer}
                    </h2>
                    <p className="panel__meta">{c.answeredOn(formatDateTime(x.answer.at, t.locale), x.answer.actor)}</p>
                  </div>
                </div>
                <p className="quote-text">{x.answer.text}</p>
              </section>
            )}

            <LegalNote text={c.legal} />
          </>
        }
        side={
          <>
            <ContactCard name={x.name} email={x.email} phone={x.phone} />
            <AssigneeCard module="claims" item={x} roles={["legal_support"]} />
            <HistoryCard module="claims" item={x} />
          </>
        }
      />
    </>
  );
}

"use client";

import { AssigneeCard, ContactCard, HistoryCard } from "@/components/cases/case-detail";
import { CasePill, Field } from "@/components/cases/case-ui";
import { INQUIRY_TONE } from "@/components/cases/tones";
import { useRequestsCopy } from "@/components/requests/copy";
import { Composer, NowPanel, RequestHeader, RequestLayout, RequestLoading, RequestMissing } from "@/components/requests/request-detail";
import { useSessionUser } from "@/components/shell/session-context";
import { useToast } from "@/components/ui/toast";
import type { InquiryStatus } from "@/data/types";
import { useCase, useUpdateCase } from "@/lib/api/queries";
import { formatDateTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const FLOW: InquiryStatus[] = ["new", "answered", "closed"];

export function InquiryDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const c = t.cases.inquiries;
  const r = useRequestsCopy();
  const me = useSessionUser();
  const toast = useToast();
  const query = useCase("inquiries", id);
  const update = useUpdateCase("inquiries");

  if (query.isPending) return <RequestLoading />;
  const x = query.data;
  if (!x) return <RequestMissing module="inquiries" list={c.title} />;

  const reply = (text: string, done: () => void) =>
    update.mutate(
      { id: x.id, patch: { status: "answered", reply: text, assignee: x.assignee ?? me.name }, event: { label: "replied" }, actor: me.name },
      {
        onSuccess: () => {
          done();
          toast.success(c.sent);
        },
      },
    );

  const setStatus = (status: "closed" | "answered") =>
    update.mutate({ id: x.id, patch: { status }, event: { label: status === "closed" ? "closed" : "reviewing" }, actor: me.name }, { onSuccess: () => toast.success(t.cases.common.updated) });

  const busy = update.isPending;
  const text = r.inquiries.now[x.status];

  return (
    <>
      <RequestHeader
        module="inquiries"
        list={c.title}
        title={r.inquiries.detailTitle}
        code={x.code}
        status={<CasePill tone={INQUIRY_TONE[x.status]}>{c.status[x.status]}</CasePill>}
        meta={[c.reason[x.reason], formatDateTime(x.createdAt, t.locale)]}
      />

      <RequestLayout
        now={
          <NowPanel module="inquiries" id={x.id} stateKey={x.status} text={text} finished={x.status === "closed"} current={FLOW.indexOf(x.status)} steps={FLOW.map((s) => ({ key: s, title: c.status[s] }))}>
            {x.status === "new" ? (
              <Composer id="inq-reply" label={c.reply} placeholder={c.replyPh} hint={r.inquiries.now.to(x.email)} min={10} send={c.send} sending={c.sending} pending={busy} onSend={reply} />
            ) : x.status === "answered" ? (
              <div className="rq-now__actions">
                <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => setStatus("closed")} disabled={busy}>
                  {busy && <span className="spinner" aria-hidden="true" />}
                  {c.close}
                </button>
              </div>
            ) : (
              <div className="rq-now__actions">
                <button type="button" className="btn btn--lg btn--block" onClick={() => setStatus("answered")} disabled={busy}>
                  {busy && <span className="spinner" aria-hidden="true" />}
                  {c.reopen}
                </button>
              </div>
            )}
          </NowPanel>
        }
        main={
          <>
            <section className="panel" aria-labelledby="msg-title">
              <div className="panel__head">
                <h2 id="msg-title" className="panel__title">
                  {c.message}
                </h2>
              </div>
              <p className="quote-text">{x.message}</p>
              <dl className="kvs kvs--three" style={{ marginTop: 16 }}>
                <Field label={c.company}>{x.company}</Field>
                <Field label={c.ruc}>
                  <span className="code">{x.ruc}</span>
                </Field>
                <Field label={c.position}>{x.position}</Field>
              </dl>
            </section>

            {x.reply && (
              <section className="panel" aria-labelledby="reply-title">
                <div className="panel__head">
                  <h2 id="reply-title" className="panel__title">
                    {c.reply}
                  </h2>
                </div>
                <p className="quote-text">{x.reply}</p>
              </section>
            )}
          </>
        }
        side={
          <>
            <ContactCard name={x.fullName} email={x.email} phone={x.phone} extra={<p className="panel__meta">{x.position}</p>} />
            <AssigneeCard module="inquiries" item={x} roles={["sales"]} />
            <HistoryCard module="inquiries" item={x} />
          </>
        }
      />
    </>
  );
}

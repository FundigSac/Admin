"use client";

import { useState } from "react";
import { AssigneeCard, CaseHeader, CaseLoading, CaseMissing, ContactCard, HistoryCard } from "@/components/cases/case-detail";
import { CasePill, Field } from "@/components/cases/case-ui";
import { INQUIRY_TONE } from "@/components/cases/tones";
import { useSessionUser } from "@/components/shell/session-context";
import { IconSend } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useCase, useUpdateCase } from "@/lib/api/queries";
import { formatDateTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

export function InquiryDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const c = t.cases.inquiries;
  const me = useSessionUser();
  const toast = useToast();
  const query = useCase("inquiries", id);
  const update = useUpdateCase("inquiries");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (query.isPending) return <CaseLoading />;
  const x = query.data;
  if (!x) return <CaseMissing base="/consultas" list={c.title} />;

  const send = () => {
    const text = reply.trim();
    if (text.length < 10) {
      setError(c.replyEmpty);
      return;
    }
    update.mutate(
      { id: x.id, patch: { status: "answered", reply: text, assignee: x.assignee ?? me.name }, event: { label: "replied" }, actor: me.name },
      {
        onSuccess: () => {
          setReply("");
          toast.success(c.sent);
        },
      },
    );
  };

  const setStatus = (status: "closed" | "answered") =>
    update.mutate({ id: x.id, patch: { status }, event: { label: status === "closed" ? "closed" : "reviewing" }, actor: me.name }, { onSuccess: () => toast.success(t.cases.common.updated) });

  return (
    <>
      <CaseHeader
        base="/consultas"
        list={c.title}
        code={x.code}
        pill={<CasePill tone={INQUIRY_TONE[x.status]}>{c.status[x.status]}</CasePill>}
        meta={
[c.reason[x.reason], formatDateTime(x.createdAt, t.locale)]
        }
        actions={
          x.status === "answered" ? (
            <button type="button" className="btn" onClick={() => setStatus("closed")} disabled={update.isPending}>
              {c.close}
            </button>
          ) : x.status === "closed" ? (
            <button type="button" className="btn" onClick={() => setStatus("answered")} disabled={update.isPending}>
              {c.reopen}
            </button>
          ) : null
        }
      />

      <div className="case-grid">
        <div className="case-main stagger">
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
                <span className="num">{x.ruc}</span>
              </Field>
              <Field label={c.position}>{x.position}</Field>
            </dl>
          </section>

          <section className="panel" aria-labelledby="reply-title">
            <div className="panel__head">
              <h2 id="reply-title" className="panel__title">
                {c.reply}
              </h2>
            </div>
            {x.reply ? (
              <p className="quote-text">{x.reply}</p>
            ) : (
              <div className="composer">
                <label className="sr-only" htmlFor="inq-reply">
                  {c.reply}
                </label>
                <textarea
                  id="inq-reply"
                  className="textarea"
                  rows={5}
                  placeholder={c.replyPh}
                  value={reply}
                  maxLength={3000}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "inq-reply-error" : undefined}
                  onChange={(e) => {
                    setReply(e.target.value);
                    setError(null);
                  }}
                />
                <div className="composer__foot">
                  {error ? (
                    <p className="field__error" id="inq-reply-error">
                      {error}
                    </p>
                  ) : (
                    <span />
                  )}
                  <button type="button" className="btn btn--primary" onClick={send} disabled={update.isPending}>
                    {update.isPending ? <span className="spinner" aria-hidden="true" /> : <IconSend size={16} />}
                    {update.isPending ? c.sending : c.send}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="case-side stagger">
          <ContactCard name={x.fullName} email={x.email} phone={x.phone} extra={<p className="panel__meta">{x.position}</p>} />
          <AssigneeCard module="inquiries" item={x} roles={["sales"]} />
          <HistoryCard module="inquiries" item={x} />
        </aside>
      </div>
    </>
  );
}

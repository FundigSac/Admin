"use client";

import { CaseList } from "@/components/cases/case-list";
import { CasePill, DeadlineChip } from "@/components/cases/case-ui";
import { PRIVACY_TONE } from "@/components/cases/tones";
import type { PrivacyRequest, PrivacyStatus } from "@/data/types";
import { useQueueCounts } from "@/lib/api/queries";
import { usePrefs } from "@/lib/prefs";

const STATUSES: PrivacyStatus[] = ["received", "identity", "processing", "done"];

export function PrivacyList() {
  const { t } = usePrefs();
  const c = t.cases.privacy;
  const queues = useQueueCounts();

  return (
    <CaseList
      module="privacy"
      base="/privacidad"
      title={c.title}
      lead={c.lead}
      hints={c.hint}
      finding={queues.data ? c.finding(queues.data.privacy) : undefined}
      defaultSort="due"
      after={
        <section className="panel" aria-labelledby="privacy-proc">
          <div className="panel__head">
            <h2 id="privacy-proc" className="panel__title">
              {c.procedure}
            </h2>
          </div>
          <ol className="steps">
            {c.steps.map((s) => (
              <li key={s.key} className="step">
                <span className="step__when">{s.when}</span>
                <span className="step__title">{s.title}</span>
                <span className="step__law">{s.law}</span>
              </li>
            ))}
          </ol>
          <p className="legal-note" style={{ marginTop: 16 }}>
            {c.legal}
          </p>
        </section>
      }
      statuses={STATUSES.map((s) => ({ value: s, label: c.status[s] }))}
      columns={[
        { key: "code", header: c.col.code, render: (x: PrivacyRequest) => <span className="num">{x.code}</span> },
        {
          key: "person",
          header: c.col.person,
          className: "case-cell--main",
          render: (x: PrivacyRequest) => (
            <span className="cell-main">
              <strong>{x.name}</strong>
              <span>{x.email}</span>
            </span>
          ),
        },
        { key: "channel", header: c.col.channel, render: (x: PrivacyRequest) => <span className="cell-muted">{c.channel[x.channel]}</span> },
        { key: "due", header: c.col.due, render: (x: PrivacyRequest) => <DeadlineChip dueAt={x.dueAt} closed={x.status === "done"} compact /> },
        { key: "status", header: c.col.status, render: (x: PrivacyRequest) => <CasePill tone={PRIVACY_TONE[x.status]}>{c.status[x.status]}</CasePill> },
      ]}
      mobile={(x: PrivacyRequest) => ({
        title: `${x.code} · ${x.name}`,
        end: <CasePill tone={PRIVACY_TONE[x.status]}>{c.status[x.status]}</CasePill>,
        sub: (
          <>
            <span>{c.channel[x.channel]}</span>
            <DeadlineChip dueAt={x.dueAt} closed={x.status === "done"} compact />
          </>
        ),
      })}
    />
  );
}

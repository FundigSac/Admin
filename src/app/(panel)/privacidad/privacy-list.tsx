"use client";

import { CasePill, DeadlineChip } from "@/components/cases/case-ui";
import { PRIVACY_TONE } from "@/components/cases/tones";
import { useRequestsCopy } from "@/components/requests/copy";
import { RequestList } from "@/components/requests/request-list";
import type { PrivacyRequest, PrivacyStatus } from "@/data/types";
import { usePrefs } from "@/lib/prefs";

const STATUSES: PrivacyStatus[] = ["received", "identity", "processing", "done"];

export function PrivacyList() {
  const { t } = usePrefs();
  const c = t.cases.privacy;
  const r = useRequestsCopy();

  return (
    <RequestList
      module="privacy"
      title={r.privacy.title}
      purpose={r.privacy.purpose}
      none={r.privacy.none}
      defaultSort="due"
      legal={<p>{c.legal}</p>}
      stages={STATUSES.map((s) => ({ value: s, label: c.status[s], hint: r.privacy.hint[s], tone: PRIVACY_TONE[s] }))}
      next={(x: PrivacyRequest) => ({
        who: x.name,
        what: (
          <>
            {c.reason}: <q>{x.reason}</q>
          </>
        ),
        when: (
          <>
            <DeadlineChip dueAt={x.dueAt} closed={false} />
            <span>{c.status[x.status]}</span>
          </>
        ),
      })}
      columns={[
        {
          key: "person",
          header: c.col.person,
          primary: true,
          render: (x: PrivacyRequest) => (
            <span className="rq-id">
              <strong>{x.name}</strong>
              <span>
                <span className="code">{x.code}</span> · {x.email}
              </span>
            </span>
          ),
        },
        { key: "channel", header: c.col.channel, labelled: true, render: (x: PrivacyRequest) => <span className="rq-muted">{c.channel[x.channel]}</span> },
        { key: "due", header: c.col.due, className: "rq-c-when", render: (x: PrivacyRequest) => <DeadlineChip dueAt={x.dueAt} closed={x.status === "done"} /> },
        { key: "status", header: c.col.status, className: "rq-c-status", render: (x: PrivacyRequest) => <CasePill tone={PRIVACY_TONE[x.status]}>{c.status[x.status]}</CasePill> },
      ]}
    />
  );
}

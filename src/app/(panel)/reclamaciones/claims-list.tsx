"use client";

import { CasePill, DeadlineChip } from "@/components/cases/case-ui";
import { CLAIM_TONE } from "@/components/cases/tones";
import { useRequestsCopy } from "@/components/requests/copy";
import { RequestList } from "@/components/requests/request-list";
import type { Claim, ClaimStatus } from "@/data/types";
import { usePrefs } from "@/lib/prefs";

const STATUSES: ClaimStatus[] = ["received", "in_progress", "answered"];

export function ClaimsList() {
  const { t } = usePrefs();
  const c = t.cases.claims;
  const r = useRequestsCopy();

  return (
    <RequestList
      module="claims"
      title={c.title}
      purpose={r.claims.purpose}
      none={r.claims.none}
      defaultSort="due"
      legal={<p>{c.legal}</p>}
      stages={STATUSES.map((s) => ({ value: s, label: c.status[s], hint: r.claims.hint[s], tone: CLAIM_TONE[s] }))}
      next={(x: Claim) => ({
        who: x.name,
        what: (
          <>
            {c.kind[x.kind]}: <q>{x.request}</q>
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
          key: "consumer",
          header: c.col.consumer,
          primary: true,
          render: (x: Claim) => (
            <span className="rq-id">
              <strong>{x.name}</strong>
              <span>
                <span className="code">{x.code}</span> · {x.docType} {x.docNumber}
              </span>
            </span>
          ),
        },
        { key: "kind", header: c.col.kind, labelled: true, render: (x: Claim) => <span className="rq-muted">{c.kind[x.kind]}</span> },
        { key: "due", header: c.col.due, className: "rq-c-when", render: (x: Claim) => <DeadlineChip dueAt={x.dueAt} closed={x.status === "answered"} /> },
        { key: "status", header: c.col.status, className: "rq-c-status", render: (x: Claim) => <CasePill tone={CLAIM_TONE[x.status]}>{c.status[x.status]}</CasePill> },
      ]}
    />
  );
}

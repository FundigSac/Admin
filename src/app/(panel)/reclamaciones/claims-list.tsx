"use client";

import { CaseList } from "@/components/cases/case-list";
import { CasePill, DeadlineChip } from "@/components/cases/case-ui";
import { CLAIM_TONE } from "@/components/cases/tones";
import type { Claim, ClaimStatus } from "@/data/types";
import { businessDaysLeft } from "@/lib/business-days";
import { relativeTime } from "@/lib/format";
import { useCaseList } from "@/lib/api/queries";
import { usePrefs } from "@/lib/prefs";

const STATUSES: ClaimStatus[] = ["received", "in_progress", "answered"];

export function ClaimsList() {
  const { t } = usePrefs();
  const c = t.cases.claims;
  // El hallazgo se calcula sobre todas las hojas abiertas, no sobre la página visible.
  const open = useCaseList("claims", { page: 0, size: 100, sort: "due" }).data?.items.filter((x) => x.status !== "answered") ?? null;
  const soon = open?.filter((x) => businessDaysLeft(x.dueAt) <= 3).length ?? 0;

  return (
    <CaseList
      module="claims"
      base="/reclamaciones"
      title={c.title}
      lead={c.lead}
      hints={c.hint}
      finding={open ? c.finding(open.length, soon) : undefined}
      defaultSort="due"
      after={<p className="legal-note">{c.legal}</p>}
      statuses={STATUSES.map((s) => ({ value: s, label: c.status[s] }))}
      columns={[
        { key: "code", header: c.col.code, render: (x: Claim) => <span className="code">{x.code}</span> },
        {
          key: "consumer",
          header: c.col.consumer,
          className: "case-cell--main",
          render: (x: Claim) => (
            <span className="cell-main">
              <strong>{x.name}</strong>
              <span>
                {x.docType} <span className="code">{x.docNumber}</span> · {relativeTime(x.createdAt, t.locale)}
              </span>
            </span>
          ),
        },
        { key: "kind", header: c.col.kind, render: (x: Claim) => <span className="cell-muted">{c.kind[x.kind]}</span> },
        { key: "due", header: c.col.due, render: (x: Claim) => <DeadlineChip dueAt={x.dueAt} closed={x.status === "answered"} compact /> },
        { key: "status", header: c.col.status, render: (x: Claim) => <CasePill tone={CLAIM_TONE[x.status]}>{c.status[x.status]}</CasePill> },
      ]}
      mobile={(x: Claim) => ({
        title: `${x.code} · ${x.name}`,
        end: <CasePill tone={CLAIM_TONE[x.status]}>{c.status[x.status]}</CasePill>,
        sub: (
          <>
            <span>{c.kind[x.kind]}</span>
            <DeadlineChip dueAt={x.dueAt} closed={x.status === "answered"} compact />
          </>
        ),
      })}
    />
  );
}

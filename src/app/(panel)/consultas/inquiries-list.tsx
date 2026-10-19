"use client";

import { CaseList } from "@/components/cases/case-list";
import { CasePill } from "@/components/cases/case-ui";
import { INQUIRY_TONE } from "@/components/cases/tones";
import type { Inquiry, InquiryStatus } from "@/data/types";
import { useQueueCounts } from "@/lib/api/queries";
import { relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const STATUSES: InquiryStatus[] = ["new", "answered", "closed"];

export function InquiriesList() {
  const { t } = usePrefs();
  const c = t.cases.inquiries;
  const queues = useQueueCounts();

  return (
    <CaseList
      module="inquiries"
      base="/consultas"
      title={c.title}
      lead={c.lead}
      hints={c.hint}
      finding={queues.data ? c.finding(queues.data.inquiries) : undefined}
      statuses={STATUSES.map((s) => ({ value: s, label: c.status[s] }))}
      columns={[
        { key: "code", header: c.col.code, render: (x: Inquiry) => <span className="num">{x.code}</span> },
        {
          key: "person",
          header: c.col.person,
          className: "case-cell--main",
          render: (x: Inquiry) => (
            <span className="cell-main">
              <strong>{x.fullName}</strong>
              <span>
                {x.company} · {x.position}
              </span>
            </span>
          ),
        },
        { key: "reason", header: c.col.reason, render: (x: Inquiry) => <span className="cell-muted">{c.reason[x.reason]}</span> },
        { key: "received", header: c.col.received, className: "col-optional", render: (x: Inquiry) => <span className="cell-muted">{relativeTime(x.createdAt, t.locale)}</span> },
        { key: "status", header: c.col.status, render: (x: Inquiry) => <CasePill tone={INQUIRY_TONE[x.status]}>{c.status[x.status]}</CasePill> },
      ]}
      mobile={(x: Inquiry) => ({
        title: `${x.code} · ${x.fullName}`,
        end: <CasePill tone={INQUIRY_TONE[x.status]}>{c.status[x.status]}</CasePill>,
        sub: (
          <>
            <span>{c.reason[x.reason]}</span>
            <span>{relativeTime(x.createdAt, t.locale)}</span>
          </>
        ),
      })}
    />
  );
}

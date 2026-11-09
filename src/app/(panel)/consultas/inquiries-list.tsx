"use client";

import { CasePill } from "@/components/cases/case-ui";
import { INQUIRY_TONE } from "@/components/cases/tones";
import { useRequestsCopy } from "@/components/requests/copy";
import { RequestList } from "@/components/requests/request-list";
import type { Inquiry, InquiryStatus } from "@/data/types";
import { relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const STATUSES: InquiryStatus[] = ["new", "answered", "closed"];

export function InquiriesList() {
  const { t } = usePrefs();
  const c = t.cases.inquiries;
  const r = useRequestsCopy();

  return (
    <RequestList
      module="inquiries"
      title={c.title}
      purpose={r.inquiries.purpose}
      none={r.inquiries.none}
      stages={STATUSES.map((s) => ({ value: s, label: c.status[s], hint: r.inquiries.hint[s], tone: INQUIRY_TONE[s] }))}
      next={(x: Inquiry) => ({
        who: x.company ? `${x.fullName} · ${x.company}` : x.fullName,
        what: <q>{x.message}</q>,
        when: (
          <>
            <span>{r.common.arrived(relativeTime(x.createdAt, t.locale))}</span>
            <span>{c.reason[x.reason]}</span>
          </>
        ),
      })}
      columns={[
        {
          key: "person",
          header: c.col.person,
          primary: true,
          render: (x: Inquiry) => (
            <span className="rq-id">
              <strong>{x.fullName}</strong>
              <span>
                <span className="code">{x.code}</span>
                {x.company ? ` · ${x.company}` : ""}
              </span>
            </span>
          ),
        },
        { key: "reason", header: c.col.reason, labelled: true, render: (x: Inquiry) => <span className="rq-muted">{c.reason[x.reason]}</span> },
        { key: "received", header: c.col.received, className: "rq-c-when", render: (x: Inquiry) => <span className="rq-muted nowrap">{relativeTime(x.createdAt, t.locale)}</span> },
        { key: "status", header: c.col.status, className: "rq-c-status", render: (x: Inquiry) => <CasePill tone={INQUIRY_TONE[x.status]}>{c.status[x.status]}</CasePill> },
      ]}
    />
  );
}

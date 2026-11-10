"use client";

import { CaseList } from "@/components/cases/case-list";
import { CasePill } from "@/components/cases/case-ui";
import { QUOTE_TONE } from "@/components/cases/tones";
import type { Quote, QuoteStatus } from "@/data/types";
import { useQueueCounts } from "@/lib/api/queries";
import { relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const STATUSES: QuoteStatus[] = ["new", "reviewing", "sent", "won", "lost"];

export function QuotesList() {
  const { t } = usePrefs();
  const c = t.cases.quotes;
  const queues = useQueueCounts();
  const summary = (x: Quote) => {
    const first = x.items[0];
    return x.items.length > 1 ? `${c.family[x.family]} · ${c.items(x.items.length)}` : `${first.product} ${first.dn}`;
  };

  return (
    <CaseList
      module="quotes"
      base="/cotizaciones"
      title={c.title}
      lead={c.lead}
      hints={c.hint}
      finding={queues.data ? c.finding(queues.data.quotes) : undefined}
      statuses={STATUSES.map((s) => ({ value: s, label: c.status[s] }))}
      columns={[
        { key: "code", header: c.col.code, render: (x: Quote) => <span className="code">{x.code}</span> },
        {
          key: "company",
          header: c.col.company,
          className: "case-cell--main",
          render: (x: Quote) => (
            <span className="cell-main">
              <strong>{x.company}</strong>
              <span>
                {x.contactName} · {c.source[x.source]}
              </span>
            </span>
          ),
        },
        { key: "request", header: c.col.request, className: "case-cell--main", render: (x: Quote) => <span className="cell-muted cell-clip">{summary(x)}</span> },
        { key: "destination", header: c.col.destination, className: "col-optional", render: (x: Quote) => <span className="cell-muted">{x.destination}</span> },
        { key: "received", header: c.col.received, className: "col-optional", render: (x: Quote) => <span className="cell-muted">{relativeTime(x.createdAt, t.locale)}</span> },
        { key: "status", header: c.col.status, render: (x: Quote) => <CasePill tone={QUOTE_TONE[x.status]}>{c.status[x.status]}</CasePill> },
      ]}
      mobile={(x: Quote) => ({
        title: `${x.code} · ${x.company}`,
        end: <CasePill tone={QUOTE_TONE[x.status]}>{c.status[x.status]}</CasePill>,
        sub: (
          <>
            <span>{summary(x)}</span>
            <span>
              {x.destination} · {relativeTime(x.createdAt, t.locale)}
            </span>
          </>
        ),
      })}
    />
  );
}

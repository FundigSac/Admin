"use client";

import { CasePill } from "@/components/cases/case-ui";
import { QUOTE_TONE } from "@/components/cases/tones";
import { useRequestsCopy } from "@/components/requests/copy";
import { RequestList } from "@/components/requests/request-list";
import type { Quote, QuoteStatus } from "@/data/types";
import { formatNumber, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const STATUSES: QuoteStatus[] = ["new", "reviewing", "sent", "won", "lost"];

export function QuotesList() {
  const { t } = usePrefs();
  const c = t.cases.quotes;
  const r = useRequestsCopy();
  const summary = (x: Quote) => {
    const first = x.items[0];
    return x.items.length > 1 ? `${c.family[x.family]} · ${c.items(x.items.length)}` : `${first.product} ${first.dn}`;
  };
  // En la siguiente por atender se dice qué pide con cantidad y medida, como lo leería un vendedor.
  const asked = (x: Quote) => {
    const first = x.items[0];
    return x.items.length > 1 ? r.quotes.lines(x.items.length, c.family[x.family]) : r.quotes.qty(formatNumber(first.qty, t.locale), c.unit[first.unit], `${first.product} ${first.dn}`);
  };

  return (
    <RequestList
      module="quotes"
      title={c.title}
      purpose={r.quotes.purpose}
      none={r.quotes.none}
      stages={STATUSES.map((s) => ({ value: s, label: c.status[s], hint: r.quotes.hint[s], tone: QUOTE_TONE[s] }))}
      next={(x: Quote) => ({
        who: x.company,
        what: r.quotes.asks(x.contactName, asked(x)),
        when: (
          <>
            <span>{r.common.arrived(relativeTime(x.createdAt, t.locale))}</span>
            <span>{r.quotes.from(c.source[x.source])}</span>
            <span>{x.destination}</span>
          </>
        ),
      })}
      columns={[
        {
          key: "company",
          header: c.col.company,
          primary: true,
          render: (x: Quote) => (
            <span className="rq-id">
              <strong>{x.company}</strong>
              <span>
                <span className="code">{x.code}</span> · {x.contactName}
              </span>
            </span>
          ),
        },
        { key: "request", header: c.col.request, labelled: true, render: (x: Quote) => <span className="rq-clip">{summary(x)}</span> },
        { key: "destination", header: c.col.destination, optional: true, render: (x: Quote) => <span className="rq-muted">{x.destination}</span> },
        { key: "received", header: c.col.received, className: "rq-c-when", render: (x: Quote) => <span className="rq-muted nowrap">{relativeTime(x.createdAt, t.locale)}</span> },
        { key: "status", header: c.col.status, className: "rq-c-status", render: (x: Quote) => <CasePill tone={QUOTE_TONE[x.status]}>{c.status[x.status]}</CasePill> },
      ]}
    />
  );
}

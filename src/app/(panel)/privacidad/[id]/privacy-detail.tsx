"use client";

import Link from "next/link";
import { AssigneeCard, CaseHeader, CaseLoading, CaseMissing, HistoryCard } from "@/components/cases/case-detail";
import { CasePill, DeadlineChip, Field } from "@/components/cases/case-ui";
import { PRIVACY_TONE } from "@/components/cases/tones";
import { useSessionUser } from "@/components/shell/session-context";
import { IconLegal } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { PrivacyStatus } from "@/data/types";
import { useCase, useUpdateCase } from "@/lib/api/queries";
import { formatDateTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const ORDER: PrivacyStatus[] = ["received", "identity", "processing", "done"];

export function PrivacyDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const c = t.cases.privacy;
  const me = useSessionUser();
  const toast = useToast();
  const query = useCase("privacy", id);
  const update = useUpdateCase("privacy");

  if (query.isPending) return <CaseLoading />;
  const x = query.data;
  if (!x) return <CaseMissing base="/privacidad" list={c.title} />;

  const at = ORDER.indexOf(x.status);
  const next = ORDER[at + 1];
  const advance = () =>
    next && update.mutate({ id: x.id, patch: { status: next }, event: { label: next }, actor: me.name }, { onSuccess: () => toast.success(t.cases.common.updated) });

  return (
    <>
      <CaseHeader
        base="/privacidad"
        list={c.title}
        code={x.code}
        pill={<CasePill tone={PRIVACY_TONE[x.status]}>{c.status[x.status]}</CasePill>}
        meta={
[c.channel[x.channel], formatDateTime(x.createdAt, t.locale), <DeadlineChip key="due" dueAt={x.dueAt} closed={x.status === "done"} />]
        }
        actions={
          next ? (
            <button type="button" className="btn btn--primary" onClick={advance} disabled={update.isPending}>
              {update.isPending && <span className="spinner" aria-hidden="true" />}
              {c.next[x.status]}
            </button>
          ) : null
        }
      />

      <div className="case-grid">
        <div className="case-main stagger">
          <section className="panel" aria-labelledby="proc-title">
            <div className="panel__head">
              <h2 id="proc-title" className="panel__title">
                {c.procedure}
              </h2>
            </div>
            <ol className="steps">
              {c.steps.map((s, i) => (
                <li key={s.key} className={`step${i < at || x.status === "done" ? " step--done" : i === at ? " step--current" : ""}`} aria-current={i === at && x.status !== "done" ? "step" : undefined}>
                  <span className="step__when">{s.when}</span>
                  <span className="step__title">{s.title}</span>
                  <span className="step__law">{s.law}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel" aria-labelledby="holder-title">
            <div className="panel__head">
              <h2 id="holder-title" className="panel__title">
                {c.holder}
              </h2>
            </div>
            <dl className="kvs">
              <Field label={t.cases.common.email}>{x.email}</Field>
              <Field label={c.account}>
                {x.userId ? (
                  <Link className="link" href={`/usuarios/${x.userId}`}>
                    {x.name}
                  </Link>
                ) : (
                  c.noAccount
                )}
              </Field>
              <Field label={c.reason} wide>
                <p className="quote-text">{x.reason}</p>
              </Field>
            </dl>
          </section>

          <p className="legal-note">
            <IconLegal size={16} style={{ display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
            {c.legal}
          </p>
        </div>

        <aside className="case-side stagger">
          <AssigneeCard module="privacy" item={x} roles={["legal_support"]} />
          <HistoryCard module="privacy" item={x} />
        </aside>
      </div>
    </>
  );
}

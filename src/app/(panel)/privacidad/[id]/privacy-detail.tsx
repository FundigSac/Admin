"use client";

import Link from "next/link";
import { AssigneeCard, HistoryCard } from "@/components/cases/case-detail";
import { CasePill, DeadlineChip, Field } from "@/components/cases/case-ui";
import { PRIVACY_TONE } from "@/components/cases/tones";
import { useRequestsCopy } from "@/components/requests/copy";
import { LegalNote, NowPanel, RequestHeader, RequestLayout, RequestLoading, RequestMissing } from "@/components/requests/request-detail";
import { useSessionUser } from "@/components/shell/session-context";
import { IconMail } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { PrivacyStatus } from "@/data/types";
import { useCase, useUpdateCase } from "@/lib/api/queries";
import { formatDateTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const ORDER: PrivacyStatus[] = ["received", "identity", "processing", "done"];

export function PrivacyDetail({ id }: { id: string }) {
  const { t } = usePrefs();
  const c = t.cases.privacy;
  const r = useRequestsCopy();
  const me = useSessionUser();
  const toast = useToast();
  const query = useCase("privacy", id);
  const update = useUpdateCase("privacy");

  if (query.isPending) return <RequestLoading />;
  const x = query.data;
  if (!x) return <RequestMissing module="privacy" list={r.privacy.title} />;

  const at = ORDER.indexOf(x.status);
  const next = ORDER[at + 1];
  const done = x.status === "done";
  const busy = update.isPending;
  const advance = () =>
    next && update.mutate({ id: x.id, patch: { status: next }, event: { label: next }, actor: me.name }, { onSuccess: () => toast.success(t.cases.common.updated) });

  return (
    <>
      <RequestHeader
        module="privacy"
        list={r.privacy.title}
        title={r.privacy.detailTitle}
        code={x.code}
        status={<CasePill tone={PRIVACY_TONE[x.status]}>{c.status[x.status]}</CasePill>}
        meta={[<DeadlineChip key="due" dueAt={x.dueAt} closed={done} />, c.channel[x.channel], formatDateTime(x.createdAt, t.locale)]}
      />

      <RequestLayout
        now={
          <NowPanel
            module="privacy"
            id={x.id}
            stateKey={x.status}
            text={r.privacy.now[x.status]}
            finished={done}
            current={at}
            steps={c.steps.map((s) => ({ key: s.key, title: s.title, when: s.when, law: s.law }))}
          >
            {next && (
              <div className="rq-now__actions">
                <button type="button" className="btn btn--primary btn--lg btn--block" onClick={advance} disabled={busy}>
                  {busy && <span className="spinner" aria-hidden="true" />}
                  {r.privacy.next[x.status]}
                </button>
                <a className="btn btn--block" href={`mailto:${x.email}?subject=${encodeURIComponent(x.code)}`}>
                  <IconMail size={18} />
                  {r.common.mail}
                </a>
              </div>
            )}
          </NowPanel>
        }
        main={
          <>
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

            <LegalNote text={c.legal} />
          </>
        }
        side={
          <>
            <AssigneeCard module="privacy" item={x} roles={["legal_support"]} />
            <HistoryCard module="privacy" item={x} />
          </>
        }
      />
    </>
  );
}

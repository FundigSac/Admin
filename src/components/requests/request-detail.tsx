"use client";

import { Check, Printer } from "@phosphor-icons/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Skeleton } from "@/components/ui/bits";
import { IconArrowLeft, IconArrowRight, IconCopy, IconLegal, IconSend } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { CaseModule } from "@/lib/api";
import { usePrefs } from "@/lib/prefs";
import { useRequestsCopy } from "./copy";
import { BASE, useChanged, useNextRequest } from "./queues";
import "./requests.css";

/** Encabezado de una solicitud: volver a la lista, qué es (h1 con el código), su estado, su plazo y quién la envió. */
export function RequestHeader({
  module,
  list,
  title,
  code,
  status,
  meta,
  actions,
}: {
  module: CaseModule;
  list: string;
  title: string;
  code: string;
  status: React.ReactNode;
  meta: React.ReactNode[];
  actions?: React.ReactNode;
}) {
  const { t } = usePrefs();
  const toast = useToast();
  return (
    // case-head: nombre que usan las pruebas de extremo a extremo para leer el estado del encabezado.
    <header className="rq-head rq-head--case case-head">
      <Link href={BASE[module]} className="rq-back">
        <IconArrowLeft size={16} />
        {list}
      </Link>
      <div className="rq-head__row">
        <h1 className="rq-head__title">
          {title} {/* El código nunca se parte entre líneas. */}
          <span className="nowrap code">{code}</span>
        </h1>
        <button
          type="button"
          className="icon-btn"
          aria-label={t.cases.common.copyCode}
          title={t.cases.common.copyCode}
          onClick={() => navigator.clipboard?.writeText(code).then(() => toast.success(t.toast.copied))}
        >
          <IconCopy size={18} />
        </button>
      </div>
      {actions && <div className="rq-head__actions">{actions}</div>}
      <ul className="rq-head__meta">
        <li>{status}</li>
        {meta.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </header>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      <Printer size={18} aria-hidden="true" focusable="false" />
      {label}
    </button>
  );
}

export type Step = { key: string; title: string; when?: string; law?: string };

/**
 * "Qué hacer ahora": la frase que explica el paso de esta solicitud, su acción (el único botón principal de la
 * pantalla) y el avance por etapas. Cuando cambia el estado, el contenido nuevo se asienta (opacidad y 8 px).
 */
export function NowPanel({
  module,
  id,
  stateKey,
  text,
  steps,
  current,
  finished,
  children,
}: {
  module: CaseModule;
  id: string;
  stateKey: string;
  text: React.ReactNode;
  steps: Step[];
  current: number;
  finished: boolean;
  children?: React.ReactNode;
}) {
  const c = useRequestsCopy().common;
  const changed = useChanged(stateKey);
  return (
    <section className={`rq-now${finished ? " rq-now--done" : ""}`} aria-labelledby="rq-now-title">
      <h2 id="rq-now-title" className="rq-now__title">
        {c.now}
      </h2>
      <div className="rq-now__body" key={stateKey} data-settle={changed ? "" : undefined}>
        <p className="rq-now__text">{text}</p>
        {finished && <p className="rq-now__done">{c.nothingLeft}</p>}
        {finished && <NextLink module={module} id={id} />}
        {children}
      </div>
      <div className="rq-progress">
        <h3 className="rq-progress__title">{c.progress}</h3>
        <ol className="rq-steps">
          {steps.map((s, i) => {
            const state = finished || i < current ? "done" : i === current ? "now" : "todo";
            // La marca de la etapa que se acaba de cerrar aparece con un pequeño crecimiento (solo tras una acción).
            const fresh = changed && i === (finished ? steps.length - 1 : current - 1);
            return (
              <li key={s.key} className="rq-step" data-state={state} data-fresh={fresh ? "" : undefined} aria-current={state === "now" ? "step" : undefined}>
                <span className="rq-step__mark" aria-hidden="true">
                  {state === "done" && <Check size={12} weight="bold" />}
                </span>
                <span className="rq-step__text">
                  <span className="rq-step__title">
                    {s.title}
                    {state !== "todo" && <span className="sr-only"> ({state === "done" ? c.stepDone : c.stepNow})</span>}
                  </span>
                  {(s.when || s.law) && <span className="rq-step__meta">{[s.when, s.law].filter(Boolean).join(" · ")}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Al terminar una solicitud, el paso siguiente es la próxima de la misma bandeja. */
function NextLink({ module, id }: { module: CaseModule; id: string }) {
  const c = useRequestsCopy().common;
  const next = useNextRequest(module, id);
  if (!next.item) return null;
  return (
    <Link href={`${BASE[module]}/${next.item.id}`} className="btn btn--primary btn--lg btn--block">
      {c.nextOne}
      <IconArrowRight size={18} />
    </Link>
  );
}

/** Respuesta escrita: rótulo visible, aviso de a dónde llega, error junto al campo y botón con indicador. */
export function Composer({
  id,
  label,
  placeholder,
  hint,
  min,
  send,
  sending,
  pending,
  onSend,
}: {
  id: string;
  label: string;
  placeholder: string;
  hint?: string;
  min: number;
  send: string;
  sending: string;
  pending: boolean;
  onSend: (text: string, done: () => void) => void;
}) {
  const c = useRequestsCopy().common;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    const problem = value.length === 0 ? c.empty : value.length < min ? c.tooShort(min) : null;
    if (problem) {
      setError(problem);
      ref.current?.focus();
      return;
    }
    onSend(value, () => setText(""));
  };
  return (
    <form className="rq-composer" onSubmit={submit} noValidate>
      <label className="rq-composer__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        className="textarea"
        rows={6}
        placeholder={placeholder}
        value={text}
        maxLength={3000}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
      />
      <p id={`${id}-hint`} className={error ? "field__error rq-composer__error" : "field__hint"} role={error ? "alert" : undefined}>
        {error ?? hint}
      </p>
      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={pending}>
        {pending ? <span className="spinner" aria-hidden="true" /> : <IconSend size={18} />}
        {pending ? sending : send}
      </button>
    </form>
  );
}

/** Ficha en dos columnas desde 1240 px: el detalle a la izquierda; qué hacer, contacto e historial a la derecha. */
export function RequestLayout({ now, main, side }: { now: React.ReactNode; main: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="rq rq-detail">
      <div className="rq-detail__now">{now}</div>
      <div className="rq-detail__main">{main}</div>
      <div className="rq-detail__side">{side}</div>
    </div>
  );
}

export function LegalNote({ text }: { text: string }) {
  const c = useRequestsCopy().common;
  return (
    // El texto aprobado ya empieza con "Base legal:"; el rótulo queda para lectores de pantalla.
    <aside className="rq-legal" aria-label={c.legalTitle}>
      <IconLegal size={20} />
      <p>{text}</p>
    </aside>
  );
}

export function RequestLoading() {
  return (
    <div className="rq" aria-busy="true">
      <div className="rq-head">
        <Skeleton w={140} h={14} />
        <Skeleton w={320} h={30} />
        <Skeleton w={260} h={16} />
      </div>
      <div className="rq-detail">
        <div className="rq-detail__now">
          <Skeleton h={260} />
        </div>
        <div className="rq-detail__main">
          <Skeleton h={360} />
        </div>
      </div>
    </div>
  );
}

export function RequestMissing({ module, list }: { module: CaseModule; list: string }) {
  const { t } = usePrefs();
  return (
    <div className="empty rq-empty">
      <strong>{t.cases.common.notFound}</strong>
      <Link href={BASE[module]} className="btn">
        <IconArrowLeft size={16} />
        {list}
      </Link>
    </div>
  );
}

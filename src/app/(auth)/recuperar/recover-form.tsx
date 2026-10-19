"use client";

import { ArrowLeft, CircleAlert, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/prefs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RecoverForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    const problem = !value ? t.login.required : !EMAIL.test(value) ? t.login.invalidEmail : null;
    setError(problem);
    if (problem) return;
    setStatus("sending");
    // El Backend expondrá POST /api/v1/auth/password/forgot; siempre responde igual para no revelar cuentas.
    await new Promise((r) => setTimeout(r, 800));
    setStatus("sent");
  };

  if (status === "sent")
    return (
      <div className="auth-sent" role="status">
        <span className="auth-sent__icon" aria-hidden="true">
          <MailCheck size={30} />
        </span>
        <h2 className="auth-head__title">{t.recover.sentTitle}</h2>
        <p className="auth-head__sub prose">{t.recover.sentText(email.trim())}</p>
        <Link href="/login" className="btn btn--primary btn--lg btn--block">
          {t.recover.back}
        </Link>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
        >
          {t.recover.again}
        </button>
      </div>
    );

  return (
    <>
      <header className="auth-head">
        <h2 className="auth-head__title">{t.recover.heading}</h2>
        <p className="auth-head__sub">{t.recover.sub}</p>
      </header>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="recover-email">
            {t.login.email}
          </label>
          <div className="field__control">
            <Mail className="field__icon" size={18} aria-hidden="true" />
            <input
              id="recover-email"
              className="input input--lg"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t.login.emailPh}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "recover-error" : undefined}
            />
          </div>
          {error && (
            <p className="field__error" id="recover-error">
              <CircleAlert size={14} aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={status === "sending"}>
          {status === "sending" ? (
            <>
              <span className="spinner" aria-hidden="true" />
              {t.recover.submitting}
            </>
          ) : (
            t.recover.submit
          )}
        </button>
        <Link href="/login" className="btn btn--ghost btn--block">
          <ArrowLeft size={17} aria-hidden="true" />
          {t.recover.back}
        </Link>
      </form>
    </>
  );
}

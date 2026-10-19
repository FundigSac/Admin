"use client";

import { IconAlert, IconArrowLeft, IconArrowRight, IconMail, IconMailSent } from "@/components/ui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ADMIN_EMAIL } from "@/data/demo-account";
import { useT } from "@/lib/prefs";
import { maskEmail, requestCode, RESEND_COOLDOWN_MS, startSession, verifyCode } from "@/lib/session";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LENGTH = 6;

/** Solo rutas internas: evita redirecciones abiertas con ?next=//sitio-ajeno. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/panel";
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState<{ expiresAt: number; sentAt: number; demoCode: string | null } | null>(null);
  const now = useNow(step === "code");
  const codeInput = useRef<HTMLInputElement>(null);

  const [entering, setEntering] = useState(false);

  // Entrada directa a la demo: pide y valida el código de la cuenta demo en un solo paso (sin backend todavía).
  const enterDemo = async () => {
    setEntering(true);
    const { demoCode } = requestCode(ADMIN_EMAIL);
    await wait(500);
    const result = verifyCode(demoCode ?? "");
    if (!result.ok) {
      setEntering(false);
      return;
    }
    startSession(result.user, true);
    router.replace(safeNext(params.get("next")));
    router.refresh();
  };

  const send = async (target: string, resend = false) => {
    setSending(true);
    setNotice(null);
    // POST /api/v1/auth/login/code en el Backend: siempre responde igual, exista o no la cuenta.
    await wait(700);
    setSent(requestCode(target));
    setSending(false);
    setCode("");
    setCodeError(null);
    setLocked(false);
    setStep("code");
    if (resend) setNotice(t.login.resent);
    requestAnimationFrame(() => codeInput.current?.focus());
  };

  const onEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    const problem = !value ? t.login.required : !EMAIL.test(value) ? t.login.invalidEmail : null;
    setEmailError(problem);
    if (!problem) void send(value);
  };

  const submitCode = async (value: string) => {
    if (value.length < LENGTH) {
      setCodeError(t.login.incomplete);
      return;
    }
    setVerifying(true);
    setCodeError(null);
    await wait(600);
    const result = verifyCode(value);
    if (result.ok) {
      startSession(result.user, remember);
      router.replace(safeNext(params.get("next")));
      router.refresh();
      return;
    }
    setVerifying(false);
    setCode("");
    if (result.reason === "expired") setCodeError(t.login.expired);
    else if (result.reason === "locked") {
      setLocked(true);
      setCodeError(t.login.locked);
    } else setCodeError(t.login.wrongCode(result.attemptsLeft));
    requestAnimationFrame(() => codeInput.current?.focus());
  };

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, LENGTH);
    setCode(digits);
    setCodeError(null);
    // Al completar los 6 dígitos (escritos o pegados) se verifica solo.
    if (digits.length === LENGTH && !locked) void submitCode(digits);
  };

  if (step === "code" && sent) {
    // El reloj nunca va por detrás del envío (el intervalo arranca un segundo después).
    const current = Math.max(now, sent.sentAt);
    const remaining = Math.max(0, sent.expiresAt - current);
    const cooldown = Math.max(0, Math.ceil((sent.sentAt + RESEND_COOLDOWN_MS - current) / 1000));
    const mm = Math.floor(remaining / 60_000);
    const ss = Math.floor((remaining % 60_000) / 1000)
      .toString()
      .padStart(2, "0");
    const expired = remaining === 0;
    const describedBy = ["code-hint", codeError ? "code-error" : null].filter(Boolean).join(" ");

    return (
      <>
        <header className="auth-head">
          <IconMailSent className="auth-sent__icon" size={28} aria-hidden="true" />
          <h2 className="auth-head__title">{t.login.codeHeading}</h2>
          <p className="auth-head__sub">{t.login.codeSub(maskEmail(email.trim().toLowerCase()))}</p>
        </header>

        <form
          className="auth-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submitCode(code);
          }}
        >
          <div className="field">
            <div className="auth-form__row">
              <label className="field__label" htmlFor="code">
                {t.login.code}
              </label>
              <span className={`auth-timer${expired ? " is-expired" : ""}`} aria-live="off">
                {expired ? t.login.expired : t.login.expiresIn(`${mm}:${ss}`)}
              </span>
            </div>
            <div className={`otp${codeError ? " otp--error" : ""}`}>
              <input
                ref={codeInput}
                id="code"
                className="otp__input"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={LENGTH}
                disabled={verifying || locked || expired}
                aria-invalid={codeError ? true : undefined}
                aria-describedby={describedBy}
              />
              {Array.from({ length: LENGTH }, (_, i) => (
                <span key={i} className={`otp__cell${i === Math.min(code.length, LENGTH - 1) ? " is-current" : ""}${code[i] ? " is-filled" : ""}`} aria-hidden="true">
                  {code[i] ?? ""}
                </span>
              ))}
            </div>
            {codeError ? (
              <p className="field__error" id="code-error" role="alert">
                <IconAlert size={14} aria-hidden="true" />
                {codeError}
              </p>
            ) : (
              <p className="field__hint" id="code-hint">
                {notice ?? t.login.codeHint}
              </p>
            )}
          </div>

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={verifying || locked || expired}>
            {verifying ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {t.login.verifying}
              </>
            ) : (
              <>
                {t.login.verify}
                <IconArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>

          <div className="auth-form__links">
            <button type="button" className="btn btn--ghost" onClick={() => setStep("email")}>
              <IconArrowLeft size={16} aria-hidden="true" />
              {t.login.changeEmail}
            </button>
            <button type="button" className="btn" onClick={() => void send(email.trim(), true)} disabled={cooldown > 0 || sending}>
              {sending ? <span className="spinner" aria-hidden="true" /> : null}
              {cooldown > 0 ? t.login.resendIn(cooldown) : t.login.resend}
            </button>
          </div>
        </form>

        {sent.demoCode && (
          <section className="auth-demo" aria-labelledby="demo-title">
            <h3 id="demo-title" className="auth-demo__title">
              {t.login.demoTitle}
            </h3>
            <p className="auth-demo__mail">
              <span>{t.login.demoInbox(sent.demoCode)}</span>
            </p>
            <button type="button" className="btn auth-demo__btn" onClick={() => onCodeChange(sent.demoCode ?? "")} disabled={verifying || locked || expired}>
              {t.login.demoUse}
            </button>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <header className="auth-head">
        <h2 className="auth-head__title">{t.login.heading}</h2>
        <p className="auth-head__sub">{t.login.sub}</p>
      </header>

      <form className="auth-form" onSubmit={onEmail} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="email">
            {t.login.email}
          </label>
          <div className="field__control">
            <IconMail className="field__icon" size={17} aria-hidden="true" />
            <input
              id="email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder={t.login.emailPh}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "email-error" : undefined}
            />
          </div>
          {emailError && (
            <p className="field__error" id="email-error">
              <IconAlert size={14} aria-hidden="true" />
              {emailError}
            </p>
          )}
        </div>

        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>{t.login.remember}</span>
        </label>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={sending}>
          {sending ? (
            <>
              <span className="spinner" aria-hidden="true" />
              {t.login.sending}
            </>
          ) : (
            <>
              {t.login.send}
              <IconArrowRight size={17} aria-hidden="true" />
            </>
          )}
        </button>
        <p className="auth-why">{t.login.why}</p>
      </form>

      <section className="auth-demo" aria-labelledby="demo-title">
        <h3 id="demo-title" className="auth-demo__title">
          {t.login.demoTitle}
        </h3>
        <p className="auth-demo__text">{t.login.demoText}</p>
        <div className="auth-demo__actions">
          <button type="button" className="btn btn--primary auth-demo__btn" onClick={enterDemo} disabled={entering}>
            {entering ? <span className="spinner" aria-hidden="true" /> : <IconArrowRight size={17} />}
            {entering ? t.login.verifying : t.login.demoEnter}
          </button>
          <button
            type="button"
            className="btn btn--ghost auth-demo__btn"
            onClick={() => {
              setEmail(ADMIN_EMAIL);
              setEmailError(null);
            }}
          >
            {t.login.demoEmail}
          </button>
        </div>
      </section>
    </>
  );
}

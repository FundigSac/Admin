"use client";

import { Check } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconAlert, IconArrowLeft, IconArrowRight, IconClock, IconMail, IconMailSent } from "@/components/ui/icons";
import { ADMIN_EMAIL } from "@/data/demo-account";
import { BACKEND_MODE } from "@/lib/backend-mode";
import { MAX_ATTEMPTS, maskEmail, requestCode, RESEND_COOLDOWN_MS, startSession, verifyCode } from "@/lib/session";
import { useLoginCopy } from "./login-copy";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LENGTH = 6;

/** Solo rutas internas: evita redirecciones abiertas con ?next=//sitio-ajeno. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/panel";
}

/** Se lee al terminar, no al pintar: así toda la pantalla sale del servidor y nada salta al hidratar. */
function nextPath() {
  return safeNext(new URLSearchParams(window.location.search).get("next"));
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

/**
 * Acceso sin contraseña en dos pasos (correo y código). La pantalla dice desde el principio qué va a pasar: la lista
 * de pasos marca dónde está la persona, y cada paso tiene un solo botón principal: "Enviar código" y luego "Entrar".
 */
export function LoginForm() {
  const c = useLoginCopy();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  // El cambio de paso se anima solo cuando lo pide la persona; la pantalla llega quieta.
  const [swapped, setSwapped] = useState(false);
  const [done, setDone] = useState(false);
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
  const [entering, setEntering] = useState(false);
  const now = useNow(step === "code");
  const codeInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const attemptsLeft = useRef(MAX_ATTEMPTS);

  const finish = () => {
    setDone(true);
    router.replace(nextPath());
    router.refresh();
  };

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
    finish();
  };

  const send = async (target: string, resend = false) => {
    setSending(true);
    setNotice(null);
    if (BACKEND_MODE) {
      // POST /api/v1/auth/staff/code (vía BFF): siempre responde igual, exista o no la cuenta.
      const res = await fetch("/api/session/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: target }) }).catch(() => null);
      setSending(false);
      if (!res?.ok) {
        const problem = res?.status === 429 ? c.limited : c.offline;
        if (resend) setCodeError(problem);
        else setEmailError(problem);
        return;
      }
      const issued = (await res.json()) as { expiresInSeconds: number };
      const at = Date.now();
      attemptsLeft.current = MAX_ATTEMPTS;
      setSent({ expiresAt: at + issued.expiresInSeconds * 1000, sentAt: at, demoCode: null });
    } else {
      await wait(700);
      setSent(requestCode(target));
    }
    setSending(false);
    setCode("");
    setCodeError(null);
    setLocked(false);
    setSwapped(true);
    setStep("code");
    if (resend) setNotice(c.resent);
    requestAnimationFrame(() => codeInput.current?.focus());
  };

  const onEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    const problem = !value ? c.required : !EMAIL.test(value) ? c.invalidEmail : null;
    setEmailError(problem);
    if (problem) emailInput.current?.focus();
    else void send(value);
  };

  const submitCode = async (value: string) => {
    if (value.length < LENGTH) {
      setCodeError(c.incomplete);
      return;
    }
    setVerifying(true);
    setCodeError(null);
    if (BACKEND_MODE) {
      await verifyWithBackend(value);
      return;
    }
    await wait(600);
    const result = verifyCode(value);
    if (result.ok) {
      startSession(result.user, remember);
      finish();
      return;
    }
    setVerifying(false);
    setCode("");
    if (result.reason === "expired") setCodeError(c.expired);
    else if (result.reason === "locked") {
      setLocked(true);
      setCodeError(c.locked);
    } else setCodeError(c.wrongCode(result.attemptsLeft));
    requestAnimationFrame(() => codeInput.current?.focus());
  };

  /**
   * La API responde INVALID_CODE a cualquier fallo (no revela si el código venció o se agotó): el panel lleva su propio
   * conteo de los 5 intentos y el temporizador de 10 minutos, igual que la API.
   */
  const verifyWithBackend = async (value: string) => {
    const res = await fetch("/api/session/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), code: value, remember }),
    }).catch(() => null);
    if (res?.ok) {
      finish();
      return;
    }
    setVerifying(false);
    setCode("");
    if (!res || res.status >= 500) setCodeError(c.offline);
    else if (res.status === 429) setCodeError(c.limited);
    else {
      attemptsLeft.current = Math.max(0, attemptsLeft.current - 1);
      if (attemptsLeft.current === 0) {
        setLocked(true);
        setCodeError(c.locked);
      } else setCodeError(c.wrongCode(attemptsLeft.current));
    }
    requestAnimationFrame(() => codeInput.current?.focus());
  };

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, LENGTH);
    setCode(digits);
    setCodeError(null);
    // Al completar los 6 dígitos (escritos o pegados) se verifica solo.
    if (digits.length === LENGTH && !locked) void submitCode(digits);
  };

  const backToEmail = () => {
    setSwapped(true);
    setStep("email");
    setNotice(null);
    requestAnimationFrame(() => emailInput.current?.focus());
  };

  const current = done || entering ? 2 : step === "code" ? 1 : 0;

  return (
    <div className="login">
      <header className="login__head">
        <h1 className="login__title">{c.title}</h1>
        <p className="login__lead">{c.lead}</p>
      </header>

      <ol className="login-steps" aria-label={c.steps.label} data-current={current}>
        {c.steps.items.map((s, i) => {
          const state = i < current ? "done" : i === current ? "current" : "next";
          return (
            <li key={s.title} className="login-step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className="login-step__mark" aria-hidden="true">
                {state === "done" ? <Check size={14} weight="bold" /> : i + 1}
              </span>
              <span className="login-step__body">
                <span className="login-step__title">
                  <span className="login-step__long">{s.title}</span>
                  <span className="login-step__short" aria-hidden="true">
                    {c.steps.short[i]}
                  </span>
                  {state === "done" && <span className="sr-only"> ({c.steps.done})</span>}
                </span>
                <span className="login-step__text">{s.text}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="login__work">
        {step === "code" && sent ? (
          <CodeStep
            key="code"
            animate={swapped}
            email={email}
            sent={sent}
            now={now}
            code={code}
            codeError={codeError}
            notice={notice}
            verifying={verifying || done}
            locked={locked}
            sending={sending}
            codeInput={codeInput}
            onCodeChange={onCodeChange}
            onSubmit={() => void submitCode(code)}
            onBack={backToEmail}
            onResend={() => void send(email.trim(), true)}
          />
        ) : (
          <form key="email" className={`login-form${swapped ? " login-swap" : ""}`} onSubmit={onEmail} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="email">
                {c.email}
              </label>
              <div className="field__control">
                <IconMail className="field__icon" size={18} aria-hidden="true" />
                <input
                  ref={emailInput}
                  id="email"
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder={c.emailPh}
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
                <p className="field__error login-error" id="email-error" role="alert">
                  <IconAlert size={15} aria-hidden="true" />
                  {emailError}
                </p>
              )}
            </div>

            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>{c.remember}</span>
            </label>

            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={sending || entering}>
              {sending ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  {c.sending}
                </>
              ) : (
                <>
                  {c.send}
                  <IconArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
            <p className="login__why">{c.why}</p>
          </form>
        )}
      </div>

      {!BACKEND_MODE && step === "email" && (
        <section className="auth-demo" aria-labelledby="demo-title">
          <h2 id="demo-title" className="auth-demo__title">
            {c.demo.title}
          </h2>
          <p className="auth-demo__text">{c.demo.text}</p>
          <div className="auth-demo__actions">
            <button type="button" className="btn" onClick={enterDemo} disabled={entering || sending}>
              {entering ? <span className="spinner" aria-hidden="true" /> : <IconArrowRight size={17} aria-hidden="true" />}
              {entering ? c.demo.entering : c.demo.enter}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setEmail(ADMIN_EMAIL);
                setEmailError(null);
                emailInput.current?.focus();
              }}
            >
              {c.demo.tryCode}
            </button>
          </div>
        </section>
      )}

      {step === "code" && sent?.demoCode && (
        <section className="auth-demo" aria-labelledby="demo-title">
          <h2 id="demo-title" className="auth-demo__title">
            {c.demo.inbox}
          </h2>
          <p className="auth-demo__mail code">{c.demo.mail(sent.demoCode)}</p>
          <div className="auth-demo__actions">
            <button type="button" className="btn" onClick={() => onCodeChange(sent.demoCode ?? "")} disabled={verifying || locked || done || sent.expiresAt <= Math.max(now, sent.sentAt)}>
              {c.demo.use}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

type CodeStepProps = {
  animate: boolean;
  email: string;
  sent: { expiresAt: number; sentAt: number };
  now: number;
  code: string;
  codeError: string | null;
  notice: string | null;
  verifying: boolean;
  locked: boolean;
  sending: boolean;
  codeInput: React.RefObject<HTMLInputElement | null>;
  onCodeChange: (raw: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onResend: () => void;
};

function CodeStep({ animate, email, sent, now, code, codeError, notice, verifying, locked, sending, codeInput, onCodeChange, onSubmit, onBack, onResend }: CodeStepProps) {
  const c = useLoginCopy();
  // El reloj nunca va por detrás del envío (el intervalo arranca un segundo después).
  const current = Math.max(now, sent.sentAt);
  const remaining = Math.max(0, sent.expiresAt - current);
  const cooldown = Math.max(0, Math.ceil((sent.sentAt + RESEND_COOLDOWN_MS - current) / 1000));
  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000)
    .toString()
    .padStart(2, "0");
  const expired = remaining === 0;
  const describedBy = ["code-hint", codeError || expired ? "code-error" : null].filter(Boolean).join(" ");

  return (
    <section className={`login-code${animate ? " login-swap" : ""}`} aria-labelledby="code-title">
      <h2 id="code-title" className="login-code__title">
        <IconMailSent size={24} aria-hidden="true" />
        {c.codeHeading}
      </h2>
      <p className="login-code__sub">{c.codeSub(maskEmail(email.trim().toLowerCase()))}</p>

      <form
        className="login-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="field">
          <div className="login-code__row">
            <label className="field__label" htmlFor="code">
              {c.code}
            </label>
            <span className={`login-timer${expired ? " is-expired" : ""}`} aria-live="off">
              <IconClock size={15} aria-hidden="true" />
              {expired ? c.expiredShort : c.expiresIn(`${mm}:${ss}`)}
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
          {codeError || expired ? (
            <p className="field__error login-error" id="code-error" role="alert">
              <IconAlert size={15} aria-hidden="true" />
              {codeError ?? c.expired}
            </p>
          ) : null}
          <p className="field__hint" id="code-hint">
            {notice ?? c.codeHint}
          </p>
        </div>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={verifying || locked || expired}>
          {verifying ? (
            <>
              <span className="spinner" aria-hidden="true" />
              {c.verifying}
            </>
          ) : (
            <>
              {c.verify}
              <IconArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>

        <div className="login-code__links">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            <IconArrowLeft size={16} aria-hidden="true" />
            {c.changeEmail}
          </button>
          <button type="button" className="btn" onClick={onResend} disabled={cooldown > 0 || sending}>
            {sending ? <span className="spinner" aria-hidden="true" /> : null}
            {cooldown > 0 ? c.resendIn(cooldown) : c.resend}
          </button>
        </div>
      </form>
    </section>
  );
}

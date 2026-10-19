"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CircleAlert, Eye, EyeOff, KeyRound, Lock, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ADMIN_EMAIL, DEMO_PASSWORD } from "@/data/demo-account";
import { useT } from "@/lib/prefs";
import { checkDemoCredentials, startSession } from "@/lib/session";

/** Solo rutas internas: evita redirecciones abiertas con ?next=//sitio-ajeno. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/panel";
}

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [caps, setCaps] = useState(false);
  const [authError, setAuthError] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().min(1, t.login.required).email(t.login.invalidEmail),
        password: z.string().min(1, t.login.required).min(8, t.login.short),
        remember: z.boolean(),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "", remember: true } });

  const onSubmit = handleSubmit(async (values) => {
    setAuthError(false);
    // Tiempo de respuesta realista del login; el Backend responderá en /api/v1/auth/login.
    await new Promise((r) => setTimeout(r, 650));
    const user = checkDemoCredentials(values.email, values.password);
    if (!user) {
      setAuthError(true);
      return;
    }
    startSession(user, values.remember);
    router.replace(safeNext(params.get("next")));
    router.refresh();
  });

  const fillDemo = () => {
    setValue("email", ADMIN_EMAIL, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setAuthError(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);
  const passwordField = register("password");

  return (
    <>
      <header className="auth-head">
        <h2 className="auth-head__title">{t.login.heading}</h2>
        <p className="auth-head__sub">{t.login.sub}</p>
      </header>

      {authError && (
        <div className="auth-alert" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          {t.login.wrong}
        </div>
      )}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="email">
            {t.login.email}
          </label>
          <div className="field__control">
            <Mail className="field__icon" size={18} aria-hidden="true" />
            <input
              id="email"
              className="input input--lg"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder={t.login.emailPh}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="field__error" id="email-error">
              <CircleAlert size={14} aria-hidden="true" />
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="field">
          <div className="auth-form__row">
            <label className="field__label" htmlFor="password">
              {t.login.password}
            </label>
            <Link className="link auth-form__forgot" href="/recuperar">
              {t.login.forgot}
            </Link>
          </div>
          <div className="field__control field__control--trail">
            <Lock className="field__icon" size={18} aria-hidden="true" />
            <input
              id="password"
              className="input input--lg"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t.login.passwordPh}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "password-error" : caps ? "password-caps" : undefined}
              onKeyUp={onKey}
              {...passwordField}
              onBlur={(e) => {
                setCaps(false);
                void passwordField.onBlur(e);
              }}
            />
            <button type="button" className="icon-btn icon-btn--sm field__trail" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? t.login.hide : t.login.show} aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
          {errors.password ? (
            <p className="field__error" id="password-error">
              <CircleAlert size={14} aria-hidden="true" />
              {errors.password.message}
            </p>
          ) : (
            caps && (
              <p className="field__hint auth-caps" id="password-caps">
                <KeyRound size={14} aria-hidden="true" />
                {t.login.caps}
              </p>
            )
          )}
        </div>

        <label className="check">
          <input type="checkbox" {...register("remember")} />
          <span>{t.login.remember}</span>
        </label>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              {t.login.submitting}
            </>
          ) : (
            <>
              {t.login.submit}
              <ArrowRight size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <section className="auth-demo" aria-labelledby="demo-title">
        <span className="auth-demo__icon" aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <div>
          <h3 id="demo-title" className="auth-demo__title">
            {t.login.demoTitle}
          </h3>
          <p className="auth-demo__text">{t.login.demoText}</p>
          <button type="button" className="btn btn--sm auth-demo__btn" onClick={fillDemo}>
            {t.login.useDemo}
          </button>
        </div>
      </section>
    </>
  );
}

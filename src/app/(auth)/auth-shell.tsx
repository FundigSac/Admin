"use client";

import { Activity, ShieldCheck, UsersRound } from "lucide-react";
import Image from "next/image";
import { Logo } from "@/components/ui/bits";
import { LangToggle, ThemeToggle } from "@/components/shell/pref-toggles";
import { useT } from "@/lib/prefs";
import "./auth.css";

const FEATURE_ICONS = [UsersRound, ShieldCheck, Activity];

/** Pantalla dividida: escena de la planta a la izquierda y formulario en un panel completo a la derecha. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const year = new Date().getFullYear();
  return (
    <div className="auth">
      <a href="#auth-form" className="skip-link">
        {t.nav.skip}
      </a>
      <aside className="auth-visual" aria-label={t.login.eyebrow}>
        <Image className="auth-visual__photo" src="/media/login-planta.webp" alt="" fill priority sizes="(max-width: 960px) 100vw, 56vw" />
        <div className="auth-visual__shade" aria-hidden="true" />
        <div className="auth-visual__content">
          <span className="auth-eyebrow">
            <span className="auth-eyebrow__dot" aria-hidden="true" />
            {t.login.eyebrow}
          </span>
          <h1 className="auth-visual__title">
            {t.login.title.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p className="auth-visual__lead prose">{t.login.lead}</p>
          <ul className="auth-features">
            {t.login.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <li key={f.title}>
                  <span className="auth-features__icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span>
                    <strong>{f.title}</strong>
                    <span>{f.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="auth-visual__foot">
          <ShieldCheck size={15} aria-hidden="true" />
          {t.login.secure}
        </p>
      </aside>

      <main className="auth-panel" id="auth-form">
        <div className="auth-panel__bar">
          <span className="badge badge--brand" title={t.common.previewHint}>
            {t.common.preview}
          </span>
          <div className="auth-panel__prefs">
            <LangToggle />
            <ThemeToggle className="icon-btn icon-btn--outline" />
          </div>
        </div>
        <div className="auth-panel__inner">
          <div className="auth-brand">
            <Logo className="auth-brand__logo" priority />
            <span className="auth-brand__app">{t.common.app}</span>
          </div>
          {children}
        </div>
        <p className="auth-panel__legal">
          © {year} FUNDIGSAC S.A.C. {t.login.rights}
        </p>
      </main>
    </div>
  );
}

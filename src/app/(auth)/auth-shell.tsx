"use client";

import Image from "next/image";
import { Logo } from "@/components/ui/bits";
import { LangToggle, ThemeToggle } from "@/components/shell/pref-toggles";
import { useT } from "@/lib/prefs";
import "./auth.css";

/** Pantalla dividida: la planta de tratamiento (obra donde trabajan las válvulas FUNDIGSAC) y el formulario. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const year = new Date().getFullYear();
  return (
    <div className="auth">
      <a href="#auth-form" className="skip-link">
        {t.nav.skip}
      </a>
      <aside className="auth-visual">
        <Image className="auth-visual__photo" src="/media/login-planta.webp" alt="" fill priority sizes="(max-width: 960px) 100vw, 56vw" />
        <div className="auth-visual__scrim" aria-hidden="true" />
        <div className="auth-visual__content">
          <p className="auth-visual__kicker">{t.common.app}</p>
          <h1 className="auth-visual__title">{t.login.title.join(" ")}</h1>
          <p className="auth-visual__lead">{t.login.lead}</p>
        </div>
      </aside>

      <main className="auth-panel" id="auth-form">
        <div className="auth-panel__bar">
          <Logo className="auth-panel__logo" priority />
          <div className="auth-panel__prefs">
            <LangToggle />
            <ThemeToggle className="icon-btn icon-btn--outline" />
          </div>
        </div>
        <div className="auth-panel__inner">{children}</div>
        <p className="auth-panel__legal">
          {t.common.preview}: {t.common.previewHint} · © {year} FUNDIGSAC S.A.C.
        </p>
      </main>
    </div>
  );
}

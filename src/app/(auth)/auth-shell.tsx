"use client";

import { Logo } from "@/components/ui/bits";
import { LangToggle, ThemeToggle } from "@/components/shell/pref-toggles";
import { BACKEND_MODE } from "@/lib/backend-mode";
import { useLoginCopy } from "./login/login-copy";
import "./auth.css";

/**
 * Marco del acceso: el mismo fondo gris del panel con una hoja blanca en el centro, bajo la regla de tinta. Arriba,
 * el logotipo y las preferencias que se necesitan antes de entrar (idioma y tema); abajo, de dónde salen los datos.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const c = useLoginCopy();
  const year = new Date().getFullYear();
  return (
    <div className="auth">
      <a href="#acceso" className="skip-link">
        {c.skip}
      </a>
      <header className="auth__bar">
        <Logo className="auth__logo" priority />
        <div className="auth__prefs">
          <LangToggle />
          <ThemeToggle className="icon-btn icon-btn--outline" />
        </div>
      </header>

      <main className="auth__main" id="acceso" tabIndex={-1}>
        {children}
      </main>

      <footer className="auth__foot">
        <p>{BACKEND_MODE ? c.footer.live : c.footer.preview}</p>
        <p>© {year} FUNDIGSAC S.A.C.</p>
      </footer>
    </div>
  );
}

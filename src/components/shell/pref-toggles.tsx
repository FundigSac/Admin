"use client";

import { Moon, Sun } from "lucide-react";
import { usePrefs } from "@/lib/prefs";

export function ThemeToggle({ className = "icon-btn" }: { className?: string }) {
  const { resolvedTheme, setTheme, t } = usePrefs();
  const dark = resolvedTheme === "dark";
  return (
    <button type="button" className={className} onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? t.topbar.toLight : t.topbar.toDark} title={dark ? t.topbar.toLight : t.topbar.toDark}>
      {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = usePrefs();
  return (
    <div className="lang-toggle" role="group" aria-label={t.topbar.language}>
      {(["es", "en"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} lang={l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

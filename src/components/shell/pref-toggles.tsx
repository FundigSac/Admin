"use client";

import { IconMoon, IconSun } from "@/components/ui/icons";
import { flushSync } from "react-dom";
import { usePrefs } from "@/lib/prefs";

/** Fundido corto entre temas con View Transitions donde exista; si no, el cambio es inmediato. */
function switchTheme(apply: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(() => flushSync(apply));
  else apply();
}

export function ThemeToggle({ className = "icon-btn" }: { className?: string }) {
  const { resolvedTheme, setTheme, t } = usePrefs();
  const dark = resolvedTheme === "dark";
  return (
    <button type="button" className={className} onClick={() => switchTheme(() => setTheme(dark ? "light" : "dark"))} aria-label={dark ? t.topbar.toLight : t.topbar.toDark} title={dark ? t.topbar.toLight : t.topbar.toDark}>
      {dark ? <IconSun size={19} aria-hidden="true" /> : <IconMoon size={19} aria-hidden="true" />}
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

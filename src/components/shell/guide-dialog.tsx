"use client";

import { CasePill, type Tone } from "@/components/cases/case-ui";
import { Dialog } from "@/components/ui/dialog";
import { usePrefs } from "@/lib/prefs";
import type { NavSection } from "./nav";
import { useShellCopy } from "./shell-copy";

/** Ayuda: qué hay en cada sección del menú y cómo leer los estados, en una sola pantalla. */
export function GuideDialog({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: NavSection[] }) {
  const { t } = usePrefs();
  const c = useShellCopy();
  const g = t.guide;
  return (
    <Dialog open={open} onClose={onClose} title={c.help} description={g.sub}>
      <div className="guide">
        <section>
          <h3 className="guide__title">{g.sectionsTitle}</h3>
          <dl className="guide__list">
            {nav.map(({ key, icon: Icon }) => (
              <div key={key} className="guide__item">
                <dt>
                  <Icon size={20} />
                  {c.nav[key]}
                </dt>
                <dd>
                  <p>{c.guide.sections[key]}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="guide__title">{g.colorsTitle}</h3>
          <ul className="guide__colors">
            {g.colors.map((col) => (
              <li key={col.tone}>
                <CasePill tone={col.tone as Tone}>{col.label}</CasePill>
                <span>{col.text}</span>
              </li>
            ))}
            <li>
              <span className="pill pill--disabled">
                <span className="pill__dot" aria-hidden="true" />
                {g.redText.split(":")[0]}
              </span>
              <span>{g.redText.split(":").slice(1).join(":").trim()}</span>
            </li>
          </ul>
        </section>
        <section>
          <h3 className="guide__title">{g.tipsTitle}</h3>
          <ul className="guide__tips">
            {c.guide.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}

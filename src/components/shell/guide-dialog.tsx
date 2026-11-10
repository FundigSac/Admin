"use client";

import { CasePill, type Tone } from "@/components/cases/case-ui";
import { Dialog } from "@/components/ui/dialog";
import { usePrefs } from "@/lib/prefs";
import { NAV, navLabel } from "./app-shell";

/** Guía rápida: qué hay en cada sección y cómo leer los colores, en una sola pantalla. */
export function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = usePrefs();
  const g = t.guide;
  return (
    <Dialog open={open} onClose={onClose} title={g.title} description={g.sub}>
      <div className="guide">
        <section>
          <h3 className="guide__title">{g.sectionsTitle}</h3>
          <dl className="guide__list">
            {NAV.flatMap((group) => group.items).map(({ key, icon: Icon }) => (
              <div key={key} className="guide__item">
                <dt>
                  <Icon size={18} />
                  {navLabel(t, key)}
                </dt>
                <dd>{g.sections[key]}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="guide__title">{g.colorsTitle}</h3>
          <ul className="guide__colors">
            {g.colors.map((c) => (
              <li key={c.tone}>
                <CasePill tone={c.tone as Tone}>{c.label}</CasePill>
                <span>{c.text}</span>
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
            {g.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}

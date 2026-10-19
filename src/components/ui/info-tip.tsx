"use client";

import { IconInfo } from "./icons";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/** Explicación breve de un dato en lenguaje simple: aparece al pasar el cursor, al enfocar o al tocar (teléfono). */
export function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  // Si la burbuja se sale de la pantalla, se corre hacia adentro (sin re-render).
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!open || !el) return;
    const r = el.getBoundingClientRect();
    const over = r.right - (window.innerWidth - 12);
    const under = 12 - r.left;
    const shift = over > 0 ? -over : under > 0 ? under : 0;
    el.style.transform = `translateX(calc(-50% + ${shift}px))`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={wrap} className="infotip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="infotip__btn" aria-label={label} aria-describedby={open ? id : undefined} aria-expanded={open} onClick={() => setOpen((v) => !v)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        <IconInfo size={15} />
      </button>
      {open && (
        <span ref={bubble} role="tooltip" id={id} className="infotip__bubble">
          {text}
        </span>
      )}
    </span>
  );
}

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
  /** Botón que abre el menú; recibe las props ARIA y el manejador. */
  trigger: (props: { "aria-haspopup": "menu"; "aria-expanded": boolean; "aria-controls": string; onClick: () => void; ref: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  align?: "start" | "end";
  placement?: "bottom" | "top";
  className?: string;
  children: (close: () => void) => React.ReactNode;
};

/** Menú desplegable accesible: flechas para moverse, Esc para cerrar, clic fuera cierra y el foco vuelve al botón. */
export function Menu({ trigger, align = "end", placement = "bottom", className, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    items()[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const all = items();
      const i = all.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        all[(i + 1) % all.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        all[(i - 1 + all.length) % all.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        all[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        all[all.length - 1]?.focus();
      } else if (e.key === "Tab") close(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div ref={wrap} style={{ position: "relative" }} className={className}>
      {trigger({ "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": id, onClick: () => setOpen((v) => !v), ref: button })}
      {open && (
        <div
          ref={list}
          id={id}
          role="menu"
          className="menu"
          style={{
            [align === "end" ? "right" : "left"]: 0,
            ...(placement === "bottom" ? { top: "calc(100% + 6px)" } : { bottom: "calc(100% + 6px)" }),
          }}
        >
          {children(() => close())}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, danger, onSelect, children, href }: { icon?: React.ReactNode; danger?: boolean; onSelect?: () => void; href?: string; children: React.ReactNode }) {
  const cls = `menu__item${danger ? " menu__item--danger" : ""}`;
  if (href)
    return (
      <a role="menuitem" tabIndex={-1} className={cls} href={href} onClick={onSelect}>
        {icon}
        {children}
      </a>
    );
  return (
    <button type="button" role="menuitem" tabIndex={-1} className={cls} onClick={onSelect}>
      {icon}
      {children}
    </button>
  );
}

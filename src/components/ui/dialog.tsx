"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useT } from "@/lib/prefs";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  size?: "sm" | "md";
  footer?: React.ReactNode;
  children?: React.ReactNode;
};

/** Diálogo modal sobre <dialog>: el navegador atrapa el foco, cierra con Esc y devuelve el foco al disparador. */
export function Dialog({ open, onClose, title, description, icon, size = "md", footer, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog${size === "sm" ? " dialog--sm" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clic en el fondo (fuera de la caja) cierra.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <>
          <div className="dialog__head">
            {icon}
            <div>
              <h2 id={titleId} className="dialog__title">
                {title}
              </h2>
              {description && (
                <p id={descId} className="dialog__sub">
                  {description}
                </p>
              )}
            </div>
            <button type="button" className="icon-btn icon-btn--sm dialog__close" onClick={onClose} aria-label={t.common.close}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {children && <div className="dialog__body">{children}</div>}
          {footer && <div className="dialog__foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

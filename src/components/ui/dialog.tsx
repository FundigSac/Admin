"use client";

import { IconClose } from "@/components/ui/icons";
import { useEffect, useId, useRef, useState } from "react";
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

/** Duración de la salida: un 70 % de la entrada (200 ms), solo opacidad y desplazamiento. */
const EXIT_MS = 140;

/** Diálogo modal sobre <dialog>: el navegador atrapa el foco, cierra con Esc y devuelve el foco al disparador. */
export function Dialog({ open, onClose, title, description, icon, size = "md", footer, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();
  const titleId = useId();
  const descId = useId();
  // El contenido sigue montado durante la salida para que no se vacíe la caja mientras se desvanece.
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      delete el.dataset.closing;
      if (!el.open) el.showModal();
      return;
    }
    if (!el.open) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.close();
      setTimeout(() => setShown(false), 0);
      return;
    }
    el.dataset.closing = "";
    const timer = setTimeout(() => {
      delete el.dataset.closing;
      el.close();
      setShown(false);
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog${size === "sm" ? " dialog--sm" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={() => {
        if (open) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clic en el fondo (fuera de la caja) cierra.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {shown && (
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
              <IconClose size={18} aria-hidden="true" />
            </button>
          </div>
          {children && <div className="dialog__body">{children}</div>}
          {footer && <div className="dialog__foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

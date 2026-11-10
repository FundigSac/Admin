"use client";

import { IconAlert, IconClose, IconSuccess } from "@/components/ui/icons";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { formatLimaDateTime, formatTime } from "@/lib/format";
import { useT } from "@/lib/prefs";

type Toast = { id: number; text: string; tone: "success" | "error" };
type Flash = { id: number; text: string; path: string; at: number };
type ToastApi = {
  success: (text: string) => void;
  error: (text: string) => void;
  /** Cambio de un caso guardado (X8-5): mensaje fijo en la ficha hasta que se descarte o se cambie de pantalla. */
  saved: (text: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const FlashContext = createContext<{ flash: Flash | null; dismiss: () => void }>({ flash: null, dismiss: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const [items, setItems] = useState<Toast[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const next = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (text: string, tone: Toast["tone"]) => {
      next.current += 1;
      const id = next.current;
      setItems((list) => [...list.slice(-2), { id, text, tone }]);
      setTimeout(() => dismiss(id), tone === "error" ? 6000 : 4200);
    },
    [dismiss],
  );

  const saved = useCallback(
    (text: string) => {
      next.current += 1;
      setFlash({ id: next.current, text, path: pathname, at: Date.now() });
    },
    [pathname],
  );
  const flashValue = useMemo(() => ({ flash: flash && flash.path === pathname ? flash : null, dismiss: () => setFlash(null) }), [flash, pathname]);

  const api = useMemo<ToastApi>(() => ({ success: (text) => push(text, "success"), error: (text) => push(text, "error"), saved }), [push, saved]);

  return (
    <ToastContext.Provider value={api}>
      <FlashContext.Provider value={flashValue}>{children}</FlashContext.Provider>
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`}>
            <span className="toast__icon" aria-hidden="true">
              {item.tone === "success" ? <IconSuccess size={20} /> : <IconAlert size={20} />}
            </span>
            <p className="toast__text">{item.text}</p>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => dismiss(item.id)} aria-label={t.common.dismissMessage}>
              <IconClose size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fuera de ToastProvider");
  return ctx;
}

/**
 * Confirmación persistente de un cambio guardado (X8-5). A diferencia del aviso flotante, no desaparece sola: en
 * acciones con efecto legal (responder un reclamo, avanzar una supresión) quien atiende debe poder comprobar que
 * quedó guardado. Se anuncia con role="status", dice a qué hora se guardó y se cierra con su botón.
 */
export function SavedFlash() {
  const t = useT();
  const { flash, dismiss } = useContext(FlashContext);
  if (!flash) return null;
  return (
    <div className="flash flash--success" role="status" key={flash.id}>
      <IconSuccess size={18} className="flash__icon" />
      <p className="flash__text">
        <strong>{flash.text}</strong>{" "}
        <time dateTime={new Date(flash.at).toISOString()} title={t.common.limaTime(formatLimaDateTime(flash.at, t.locale))}>
          {t.common.savedAt(formatTime(flash.at, t.locale))}
        </time>
      </p>
      <button type="button" className="icon-btn icon-btn--sm" onClick={dismiss} aria-label={t.common.dismissMessage}>
        <IconClose size={16} />
      </button>
    </div>
  );
}

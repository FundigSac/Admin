"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/prefs";

type Toast = { id: number; text: string; tone: "success" | "error" };
type ToastApi = { success: (text: string) => void; error: (text: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [items, setItems] = useState<Toast[]>([]);
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

  const api = useMemo<ToastApi>(() => ({ success: (text) => push(text, "success"), error: (text) => push(text, "error") }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`}>
            <span className="toast__icon" aria-hidden="true">
              {item.tone === "success" ? <CircleCheck size={20} /> : <CircleAlert size={20} />}
            </span>
            <p className="toast__text">{item.text}</p>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => dismiss(item.id)} aria-label={t.common.close}>
              <X size={16} aria-hidden="true" />
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

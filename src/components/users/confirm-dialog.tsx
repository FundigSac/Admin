"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { IconWarning } from "@/components/ui/icons";
import { useT } from "@/lib/prefs";

type Props = {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  /** Palabra que hay que escribir para confirmar (acciones irreversibles). */
  requireWord?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({ open, title, text, confirmLabel, requireWord, busy, onConfirm, onClose }: Props) {
  const t = useT();
  const [word, setWord] = useState("");
  const ready = !requireWord || word.trim().toUpperCase() === requireWord;
  const close = () => {
    setWord("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      size="sm"
      title={title}
      description={text}
      icon={
        <span className="confirm-icon" aria-hidden="true">
          <IconWarning size={22} />
        </span>
      }
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={!ready || busy}
            onClick={() => {
              onConfirm();
              setWord("");
            }}
          >
            {busy && <span className="spinner" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {requireWord && (
        <div className="field">
          <label className="field__label" htmlFor="confirm-word">
            {t.confirm.typeToConfirm(requireWord)}
          </label>
          <input id="confirm-word" className="input" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
      )}
    </Dialog>
  );
}

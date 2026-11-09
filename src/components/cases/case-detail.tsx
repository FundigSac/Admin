"use client";

import { useState } from "react";
import { useSessionUser } from "@/components/shell/session-context";
import { IconMail, IconWhatsapp } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { CaseEvent } from "@/data/types";
import { api, type CaseMap, type CaseModule } from "@/lib/api";
import { useStaff, useUpdateCase } from "@/lib/api/queries";
import { usePrefs } from "@/lib/prefs";
import { Timeline } from "./case-ui";
import "./cases.css";

/** Contacto con acciones directas: correo y WhatsApp abren la app correspondiente. */
export function ContactCard({ name, email, phone, extra }: { name: string; email: string; phone: string | null; extra?: React.ReactNode }) {
  const { t } = usePrefs();
  const c = t.cases.common;
  const wa = phone ? phone.replace(/[^\d]/g, "") : null;
  return (
    <section className="panel side-panel">
      <h2 className="panel__title">{c.contact}</h2>
      <p className="contact__name">{name}</p>
      {extra}
      <dl className="kvs kvs--stack">
        <div className="kv">
          <dt>{c.email}</dt>
          <dd>
            <a className="link" href={`mailto:${email}`}>
              {email}
            </a>
          </dd>
        </div>
        <div className="kv">
          <dt>{c.phone}</dt>
          <dd className="num">{phone ?? "—"}</dd>
        </div>
      </dl>
      <div className="contact__actions">
        <a className="btn" href={`mailto:${email}`}>
          <IconMail size={16} />
          {c.writeEmail}
        </a>
        {wa && (
          <a className="btn" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
            <IconWhatsapp size={16} />
            {c.whatsapp}
          </a>
        )}
      </div>
    </section>
  );
}

/** Responsable del caso: asignarse o asignar a alguien del personal con el rol indicado. */
export function AssigneeCard<M extends CaseModule>({ module, item, roles }: { module: M; item: CaseMap[M]; roles: string[] }) {
  const { t } = usePrefs();
  const c = t.cases.common;
  const me = useSessionUser();
  const toast = useToast();
  const update = useUpdateCase(module);
  const staff = useStaff();
  const options = (staff.data ?? []).filter((s) => s.roles.some((r) => roles.includes(r) || r === "administrator"));
  const assignee = (item as { assignee: string | null }).assignee;
  // Con Backend, las solicitudes de privacidad no tienen responsable: las atiende quien tenga el permiso.
  if (!api.capabilities.caseAssign.includes(module)) return null;

  const assign = (name: string) =>
    update.mutate(
      { id: item.id, patch: { assignee: name } as unknown as Partial<CaseMap[M]>, event: { label: "assigned", note: name }, actor: me.name },
      { onSuccess: () => toast.success(c.updated) },
    );

  return (
    <section className="panel side-panel">
      <h2 className="panel__title">{c.assignee}</h2>
      <label className="sr-only" htmlFor={`${module}-assignee`}>
        {c.assignTo}
      </label>
      <select id={`${module}-assignee`} className="select" value={assignee ?? ""} onChange={(e) => e.target.value && assign(e.target.value)} disabled={update.isPending}>
        <option value="">{c.unassigned}</option>
        {options.map((s) => (
          <option key={s.id} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
      {assignee !== me.name && (
        <button type="button" className="btn btn--block" onClick={() => assign(me.name)} disabled={update.isPending}>
          {c.takeIt}
        </button>
      )}
    </section>
  );
}

/** Historial con nota interna: cada cambio queda con fecha y responsable. */
export function HistoryCard<M extends CaseModule>({ module, item }: { module: M; item: CaseMap[M] }) {
  const { t } = usePrefs();
  const c = t.cases.common;
  const me = useSessionUser();
  const toast = useToast();
  const update = useUpdateCase(module);
  const [note, setNote] = useState("");
  const history = (item as { history: CaseEvent[] }).history;

  return (
    <section className="panel side-panel">
      <h2 className="panel__title">{c.history}</h2>
      {/* Con Backend, las notas internas existen solo en las reclamaciones (la API no las guarda en las demás colas). */}
      {api.capabilities.caseNotes.includes(module) && (
      <form
        className="note-form"
        onSubmit={(e) => {
          e.preventDefault();
          const text = note.trim();
          if (!text) return;
          update.mutate(
            { id: item.id, patch: {}, event: { label: "note", note: text }, actor: me.name },
            {
              onSuccess: () => {
                setNote("");
                toast.success(c.noteAdded);
              },
            },
          );
        }}
      >
        <label className="sr-only" htmlFor={`${module}-note`}>
          {c.note}
        </label>
        <textarea id={`${module}-note`} className="textarea" rows={2} placeholder={c.notePh} value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} />
        <button type="submit" className="btn" disabled={!note.trim() || update.isPending}>
          {c.addNote}
        </button>
      </form>
      )}
      <Timeline events={history} />
    </section>
  );
}

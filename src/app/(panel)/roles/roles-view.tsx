"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Skeleton } from "@/components/ui/bits";
import { IconArrowRight, IconInfo } from "@/components/ui/icons";
import { GROUP_ORDER, useAccessCopy } from "@/components/users/access-copy";
import { IconCheck, IconDash } from "@/components/users/account-icons";
import { PERMISSIONS, ROLE_PERMISSIONS, STAFF_ROLES } from "@/data/permissions";
import type { User } from "@/data/types";
import { useUserList } from "@/lib/api/queries";
import { usePrefs } from "@/lib/prefs";
import { useRolesCopy } from "./roles-copy";
import "./roles.css";

/**
 * Qué puede hacer cada persona (brief de diseño §6.1 y §6.2): consulta por persona arriba, los puestos con quién los
 * tiene y la tabla para comparar. Todo en frases ("Ver las cotizaciones"), sin claves técnicas. Los permisos son la
 * copia fiel del Backend en src/data/permissions.ts.
 */
export function RolesView() {
  const { t } = usePrefs();
  const r = useRolesCopy();
  const a = useAccessCopy();
  const staff = useUserList({ page: 0, size: 200, kind: "staff", sort: { id: "name", desc: false } });
  const customers = useUserList({ page: 0, size: 1, kind: "customer" });
  const people = staff.data?.items ?? [];
  const holders = (role: string) => people.filter((u) => u.roles.includes(role as never));

  return (
    <>
      <header className="title-row roles-title">
        <div>
          <h1 className="title-row__title">{r.title}</h1>
          <p className="title-row__sub roles-title__lead">{r.lead}</p>
        </div>
        <div className="title-row__actions">
          <Link href="/usuarios?tipo=personal" className="btn btn--primary">
            {r.change}
            <IconArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <Lookup people={people} loading={!staff.data} />

      <section className="panel jobs" aria-labelledby="jobs-title">
        <h2 id="jobs-title" className="panel__title jobs__title">
          {r.jobsTitle}
        </h2>
        <ul className="jobs__list">
          {STAFF_ROLES.map((role) => {
            const list = holders(role);
            return (
              <li key={role} className="job-row">
                <div className="job-row__name">
                  <h3>{t.roles[role]}</h3>
                  <span className="job-row__count">{staff.data ? r.people(list.length) : <Skeleton w={80} h={14} />}</span>
                </div>
                <p className="job-row__text">{a.roleText[role]}</p>
                <div className="job-row__people">
                  {!staff.data ? (
                    <Skeleton w={160} h={28} />
                  ) : (
                    <ul className="faces">
                      {list.slice(0, 3).map((u) => (
                        <li key={u.id}>
                          <Link href={`/usuarios/${u.id}`} className="face">
                            <Avatar name={u.name} size="sm" />
                            <span>{u.name}</span>
                          </Link>
                        </li>
                      ))}
                      {list.length > 3 && <li className="faces__more">{r.andMore(list.length - 3)}</li>}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
          <li className="job-row job-row--customers">
            <div className="job-row__name">
              <h3>{t.roles.customer}</h3>
              <span className="job-row__count">{customers.data ? r.people(customers.data.statusCounts.all) : <Skeleton w={80} h={14} />}</span>
            </div>
            <p className="job-row__text">{a.roleText.customer}</p>
            <div className="job-row__people">
              {customers.data && customers.data.statusCounts.all > 0 && (
                <Link href="/usuarios?tipo=clientes" className="card-link">
                  {r.customersCount(customers.data.statusCounts.all)}
                </Link>
              )}
            </div>
          </li>
        </ul>
      </section>

      <section className="panel compare" aria-labelledby="compare-title">
        <div className="panel__head">
          <div>
            <h2 id="compare-title" className="panel__title">
              {r.compareTitle}
            </h2>
            <p className="panel__meta panel__meta--prose">{r.compareLead}</p>
          </div>
        </div>
        <div className="compare__frame" tabIndex={0} role="region" aria-label={r.compareTable}>
          <table className="table compare__table">
            <thead>
              <tr>
                <th scope="col" className="compare__thing">
                  {r.thing}
                </th>
                {STAFF_ROLES.map((role) => (
                  <th key={role} scope="col" className="compare__role">
                    {t.roles[role]}
                  </th>
                ))}
              </tr>
            </thead>
            {GROUP_ORDER.map((group) => (
              <tbody key={group}>
                <tr className="compare__group">
                  <th scope="rowgroup" colSpan={STAFF_ROLES.length + 1}>
                    {a.group[group]}
                  </th>
                </tr>
                {PERMISSIONS.filter((p) => p.group === group).map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="compare__thing">
                      {a.perm[p.id]}
                    </th>
                    {STAFF_ROLES.map((role) => {
                      const ok = ROLE_PERMISSIONS[role].includes(p.id);
                      return (
                        <td key={role} className={`compare__cell${ok ? " is-on" : ""}`}>
                          {ok ? <IconCheck size={16} /> : <IconDash size={14} />}
                          <span className="sr-only">{ok ? r.yes : r.no}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <p className="roles-note">
        <IconInfo size={18} aria-hidden="true" />
        <span>{r.note}</span>
      </p>
    </>
  );
}

/** Consulta por persona: eliges a alguien y ves en frases lo que puede y lo que no puede hacer. */
function Lookup({ people, loading }: { people: User[]; loading: boolean }) {
  const { t } = usePrefs();
  const r = useRolesCopy();
  const a = useAccessCopy();
  const [chosen, setChosen] = useState<string | null>(null);
  // Por defecto, alguien que no es de Administración: así se ve de entrada lo que un puesto permite y lo que no.
  const fallback = people.find((u) => !u.roles.includes("administrator")) ?? people[0];
  const person = people.find((u) => u.id === chosen) ?? fallback;
  const perms = new Set(person ? person.roles.flatMap((role) => ROLE_PERMISSIONS[role]) : []);
  const ordered = GROUP_ORDER.flatMap((g) => PERMISSIONS.filter((p) => p.group === g));
  const yes = ordered.filter((p) => perms.has(p.id));
  const no = ordered.filter((p) => !perms.has(p.id));

  return (
    <section className="panel lookup" aria-labelledby="lookup-title">
      <div className="lookup__head">
        <h2 id="lookup-title" className="panel__title">
          {r.lookupTitle}
        </h2>
        <label className="lookup__pick">
          <span className="field__label">{r.lookupLabel}</span>
          {loading ? (
            <Skeleton w="100%" h={40} />
          ) : (
            <select className="select" value={person?.id ?? ""} onChange={(e) => setChosen(e.target.value)} disabled={!people.length}>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roles.map((role) => t.roles[role]).join(", ")})
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {loading ? (
        <Skeleton w="100%" h={120} />
      ) : !person ? (
        <p className="lookup__empty">{r.lookupEmpty}</p>
      ) : (
        <div className="lookup__result fade-in" key={person.id} aria-live="polite">
          <div className="lookup__who">
            <Avatar name={person.name} />
            <strong>{r.can(person.name)}</strong>
            <Link href={`/usuarios/${person.id}`} className="card-link lookup__open">
              {r.openAccount}
            </Link>
          </div>
          <ul className="lookup__list lookup__list--yes">
            {yes.map((p) => (
              <li key={p.id}>
                <IconCheck size={16} aria-hidden="true" />
                {a.perm[p.id]}
              </li>
            ))}
          </ul>
          {no.length === 0 ? (
            <p className="lookup__all">{r.everything}</p>
          ) : (
            <>
              <p className="lookup__cannot">{r.cannot}</p>
              <ul className="lookup__list lookup__list--no">
                {no.map((p) => (
                  <li key={p.id}>
                    <IconDash size={14} aria-hidden="true" />
                    {a.perm[p.id]}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

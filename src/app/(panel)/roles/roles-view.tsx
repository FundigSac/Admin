"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Skeleton, TitleRow } from "@/components/ui/bits";
import { IconActive, IconChevronRight, IconLegal } from "@/components/ui/icons";
import { PERMISSIONS, ROLE_PERMISSIONS, STAFF_ROLES, type PermissionGroup } from "@/data/permissions";
import { useUserList } from "@/lib/api/queries";
import { usePrefs } from "@/lib/prefs";
import "./roles.css";

const GROUPS: PermissionGroup[] = ["catalog", "sales", "legal", "platform"];

export function RolesView() {
  const { t } = usePrefs();
  const r = t.rolesPage;
  const staff = useUserList({ page: 0, size: 200, kind: "staff", sort: { id: "name", desc: false } });
  const customers = useUserList({ page: 0, size: 1, kind: "customer" });
  const members = (role: string) => staff.data?.items.filter((u) => u.roles.includes(role as never)) ?? [];
  const [closed, setClosed] = useState<PermissionGroup[]>([]);
  const toggle = (g: PermissionGroup) => setClosed((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]));

  return (
    <>
      <TitleRow title={r.title} sub={r.lead} />

      <section className="panel roles-list" aria-labelledby="roles-title">
        <div className="panel__head">
          <h2 id="roles-title" className="panel__title">
            {r.listTitle}
          </h2>
        </div>
        <ul className="rows">
          {STAFF_ROLES.map((role) => {
            const list = members(role);
            return (
              <li key={role} className="row role-row">
                <span className="row__main">
                  <strong>{t.roles[role]}</strong>
                  <span className="row__sub role-row__text">{t.roleText[role]}</span>
                </span>
                <span className="role-row__people">
                  {!staff.data ? (
                    <Skeleton w={90} h={28} />
                  ) : (
                    <>
                      <span className="avatar-stack" aria-hidden="true">
                        {list.slice(0, 3).map((u) => (
                          <Avatar key={u.id} name={u.name} size="sm" />
                        ))}
                      </span>
                      <span className="role-row__count">{r.members(list.length)}</span>
                    </>
                  )}
                </span>
                <span className="role-row__perms num">{ROLE_PERMISSIONS[role].length}/{PERMISSIONS.length}</span>
              </li>
            );
          })}
          <li className="row role-row">
            <span className="row__main">
              <strong>{t.roles.customer}</strong>
              <span className="row__sub role-row__text">{t.roleText.customer}</span>
            </span>
            <span className="role-row__people">
              <span className="role-row__count">{customers.data ? <Link href="/usuarios">{r.members(customers.data.statusCounts.all)}</Link> : <Skeleton w={80} h={14} />}</span>
            </span>
            <span className="role-row__perms cell-muted">{r.customerNote}</span>
          </li>
        </ul>
      </section>

      <section className="panel matrix-panel" aria-labelledby="matrix-title">
        <div className="panel__head">
          <div>
            <h2 id="matrix-title" className="panel__title">
              {r.matrix}
            </h2>
            <p className="panel__meta">{r.matrixDesc}</p>
          </div>
          <button type="button" className="card-link" onClick={() => setClosed(closed.length ? [] : GROUPS)}>
            {closed.length ? r.expandAll : r.collapseAll}
          </button>
        </div>
        <p className="matrix-legend">
          <span className="sr-only">{r.legend}: </span>
          <span className="matrix-legend__item">
            <IconActive size={16} className="matrix-legend__on" />
            {r.granted}
          </span>
          <span className="matrix-legend__item">
            <span className="matrix__off" aria-hidden="true" />
            {r.denied}
          </span>
          <span className="matrix-legend__note">{r.readOnly}</span>
        </p>
        <div className="table-frame" tabIndex={0} role="region" aria-label={r.matrix}>
          <table className="table matrix">
            <thead>
              <tr>
                <th scope="col">{r.permission}</th>
                {STAFF_ROLES.map((role) => (
                  <th key={role} scope="col" className="matrix__role">
                    {t.roles[role]}
                  </th>
                ))}
              </tr>
            </thead>
            {GROUPS.map((group) => {
              const perms = PERMISSIONS.filter((p) => p.group === group);
              const open = !closed.includes(group);
              return (
              <tbody key={group} data-group={group}>
                <tr className="matrix__group">
                  <th scope="rowgroup" colSpan={STAFF_ROLES.length + 1}>
                    <button type="button" className="matrix__toggle" aria-expanded={open} aria-controls={perms.map((p) => `perm-${p.id.replace(":", "-")}`).join(" ")} onClick={() => toggle(group)}>
                      <IconChevronRight size={14} className="matrix__chev" />
                      {r.groupToggle(t.permGroups[group], perms.length)}
                    </button>
                  </th>
                </tr>
                {perms.map((p) => (
                  <tr key={p.id} id={`perm-${p.id.replace(":", "-")}`} hidden={!open}>
                    <th scope="row" className="matrix__perm">
                      {t.perms[p.id]}
                      <span className="matrix__code">{p.id}</span>
                    </th>
                    {STAFF_ROLES.map((role) => {
                      const ok = ROLE_PERMISSIONS[role].includes(p.id);
                      return (
                        <td key={role} className={`matrix__cell${ok ? " is-on" : ""}`}>
                          {/* X13-3: ícono decorativo y el texto real para lectores de pantalla (también en WebKit). */}
                          {ok ? <IconActive size={18} /> : <span className="matrix__off" aria-hidden="true" />}
                          <span className="sr-only">{ok ? r.granted : r.denied}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              );
            })}
          </table>
        </div>
      </section>

      <p className="legal-note roles-source">
        <IconLegal size={16} style={{ display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
        {r.source}
      </p>
    </>
  );
}

"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Skeleton, TitleRow } from "@/components/ui/bits";
import {
  IconActive,
  IconBlocked,
  IconEdit,
  IconMailSent,
  IconQuotes,
  IconRoles,
  IconSearch,
  IconSend,
  IconSignOut,
  IconTrash,
  IconUndo,
  IconUserPlus,
  type AppIcon,
} from "@/components/ui/icons";
import type { Activity, ActivityType } from "@/data/types";
import { useActivity } from "@/lib/api/queries";
import { dayKey, formatDate, formatTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import "./activity.css";

const TYPES: ActivityType[] = ["signup", "login", "verify", "quote", "password", "invite", "roles", "update", "disable", "enable", "delete"];
const ICON: Record<ActivityType, AppIcon> = {
  signup: IconUserPlus,
  login: IconSignOut,
  verify: IconActive,
  quote: IconQuotes,
  password: IconSend,
  invite: IconMailSent,
  roles: IconRoles,
  update: IconEdit,
  disable: IconBlocked,
  enable: IconUndo,
  delete: IconTrash,
};
/** Las acciones del personal se distinguen de las de los clientes con un tono propio. */
const STAFF_TYPES = new Set<ActivityType>(["invite", "roles", "update", "disable", "enable", "delete"]);

export function ActivityView() {
  const { t } = usePrefs();
  const a = t.activity;
  const [q, setQ] = useState("");
  const [type, setType] = useState<ActivityType | "all">("all");
  const [size, setSize] = useState(40);
  const query = useDeferredValue(q.trim());
  const list = useActivity({ page: 0, size, q: query || undefined, type });
  const data = list.data;

  const [today] = useState(() => dayKey(Date.now()));
  const label = (key: number) => (key === today ? a.today : key === today - 86_400_000 ? a.yesterday : formatDate(key, t.locale, { weekday: "long", day: "numeric", month: "long" }));
  const groups = new Map<number, Activity[]>();
  data?.items.forEach((e) => {
    const k = dayKey(e.at);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  });
  const sentence = (e: Activity) =>
    a.sentence(
      e,
      (m) => t.method[m as keyof typeof t.method] ?? m,
      (r) =>
        r
          .split(",")
          .map((x) => t.roles[x as keyof typeof t.roles] ?? x)
          .join(", "),
    );

  return (
    <>
      <TitleRow title={a.title} sub={a.lead} />

      <div className="toolbar activity-toolbar">
        <label className="toolbar__search">
          <span className="sr-only">{a.searchPh}</span>
          <IconSearch size={15} className="toolbar__icon" />
          <input className="input input--sm" type="search" placeholder={a.searchPh} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="toolbar__end">
          <span className="toolbar__count">{data ? a.count(data.totalItems) : ""}</span>
          <label className="sr-only" htmlFor="act-type">
            {a.type}
          </label>
          <select id="act-type" className="select select--sm" value={type} onChange={(e) => setType(e.target.value as ActivityType | "all")}>
            <option value="all">
              {a.type}: {t.common.all.toLowerCase()}
            </option>
            {TYPES.map((k) => (
              <option key={k} value={k}>
                {a.types[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!data ? (
        <div className="feed" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="feed__row">
              <Skeleton w={28} h={28} />
              <Skeleton w="50%" h={14} />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="empty case-empty">
          <strong>{a.empty}</strong>
        </div>
      ) : (
        <div className="feed">
          {[...groups].map(([key, events]) => (
            <section key={key} className="feed__day" aria-label={label(key)}>
              <h2 className="feed__date">{label(key)}</h2>
              <ol className="feed__list fade-in">
                {events.map((e) => {
                  const Icon = ICON[e.type];
                  return (
                    <li key={e.id} className={`feed__row${STAFF_TYPES.has(e.type) ? " is-staff" : ""}`}>
                      <span className="feed__icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <p className="feed__text">
                        {e.type === "delete" ? sentence(e) : <Link href={`/usuarios/${e.userId}`}>{sentence(e)}</Link>}
                        <span className="feed__tag">{a.types[e.type]}</span>
                      </p>
                      <time className="feed__time num" dateTime={new Date(e.at).toISOString()}>
                        {formatTime(e.at, t.locale)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {data.totalItems > data.items.length && (
            <button type="button" className="btn feed__more" onClick={() => setSize((s) => s + 40)} disabled={list.isFetching}>
              {list.isFetching && <span className="spinner" aria-hidden="true" />}
              {a.more}
            </button>
          )}
        </div>
      )}
    </>
  );
}

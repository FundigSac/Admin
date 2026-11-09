"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Skeleton } from "@/components/ui/bits";
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
import { useHistoryCopy } from "./history-copy";
import "./activity.css";

// Historial de cambios: una bitácora por día. Cada fila es la hora, el tipo y una frase con nombres propios ("Karina
// Lozano bloqueó la cuenta de Juan Pérez"). Los cambios hechos por el personal llevan su rótulo, no solo un color.
// Movimiento: la pantalla llega quieta; al buscar, filtrar o pedir más, solo las filas nuevas aparecen con opacidad y
// 8 px (200 ms, pasos de 25 ms con tope de 100 ms).

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
/** Acciones que hace el personal sobre una cuenta (las demás las hace el propio cliente). */
const STAFF_TYPES = new Set<ActivityType>(["invite", "roles", "update", "disable", "enable", "delete"]);
const PAGE = 40;

export function ActivityView() {
  const { t } = usePrefs();
  const h = useHistoryCopy();
  const [q, setQ] = useState("");
  const [type, setType] = useState<ActivityType | "all">("all");
  const [size, setSize] = useState(PAGE);
  const query = useDeferredValue(q.trim());
  const list = useActivity({ page: 0, size, q: query || undefined, type });
  const data = list.data;

  // Qué resultado está a la vista. Las filas solo se animan cuando la persona cambió la búsqueda o el filtro, nunca
  // en la primera carga; con "Ver más", solo las que se agregan al final.
  const sig = `${query}|${type}`;
  const settled = !!data && !list.isPlaceholderData;
  const [shown, setShown] = useState<{ sig: string; animate: boolean; from: number } | null>(null);
  if (settled && shown?.sig !== sig) setShown({ sig, animate: shown !== null, from: 0 });

  const [today] = useState(() => dayKey(Date.now()));
  const dayLabel = (key: number) => {
    const date = formatDate(key, t.locale, { weekday: "long", day: "numeric", month: "long" });
    return key === today ? `${h.today} · ${date}` : key === today - 86_400_000 ? `${h.yesterday} · ${date}` : date;
  };

  const groups = new Map<number, Activity[]>();
  data?.items.forEach((e) => {
    const k = dayKey(e.at);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  });

  const roles = (r: string) =>
    r
      .split(",")
      .filter(Boolean)
      .map((x) => t.roles[x as keyof typeof t.roles] ?? x)
      .join(", ");

  // Cada pieza con nombre aparece una sola vez por frase, así que su papel sirve de key. React 19 ya no acepta que
  // Children.toArray le ponga keys a un arreglo de elementos sin ellas: lo avisa en consola.
  const sentence = (e: Activity) => {
    const user =
      e.type === "delete" ? (
        <strong key="user">{e.userName}</strong>
      ) : (
        <Link key="user" href={`/usuarios/${e.userId}`}>
          {e.userName}
        </Link>
      );
    const actor = e.actor ? <strong key="actor">{e.actor}</strong> : null;
    const detail =
      e.type === "quote" && e.detail ? (
        <span key="detail" className="code">
          {e.detail}
        </span>
      ) : null;
    return h.sentence(e.type, { user, actor, method: h.method[e.detail ?? "email"] ?? e.detail ?? "", roles: roles(e.detail ?? ""), detail });
  };

  const clear = () => {
    setQ("");
    setType("all");
    setSize(PAGE);
  };

  const filtered = q.trim() !== "" || type !== "all";
  let index = 0;

  return (
    <div className="history">
      <header className="history-head">
        <h1 className="history-head__title">{h.title}</h1>
        <p className="history-head__lead">{h.lead}</p>
      </header>

      <div className="history-tools" role="search">
        <label className="history-tools__search">
          <span className="history-tools__label">{h.search}</span>
          <span className="field__control">
            <IconSearch size={18} className="field__icon" aria-hidden="true" />
            <input
              className="input"
              type="search"
              name="q"
              placeholder={h.searchPh}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSize(PAGE);
              }}
            />
          </span>
        </label>
        <label className="history-tools__type">
          <span className="history-tools__label">{h.type}</span>
          <select
            className="select"
            value={type}
            onChange={(e) => {
              setType(e.target.value as ActivityType | "all");
              setSize(PAGE);
            }}
          >
            <option value="all">{h.all}</option>
            {TYPES.map((k) => (
              <option key={k} value={k}>
                {h.types[k]}
              </option>
            ))}
          </select>
        </label>
        <p className="history-tools__count" aria-live="polite">
          {data ? h.count(data.totalItems) : <Skeleton w={110} h={14} />}
        </p>
      </div>

      {list.isError && !data ? (
        <div className="history-empty" role="alert">
          <p className="history-empty__title">{h.loadError}</p>
          <button type="button" className="btn" onClick={() => list.refetch()}>
            {h.retry}
          </button>
        </div>
      ) : !data ? (
        <div className="log" aria-busy="true" aria-hidden="true">
          <div className="log__day">
            <div className="log__date">
              <Skeleton w={220} h={16} />
            </div>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="log__row">
                <Skeleton w={44} h={14} />
                <Skeleton w={32} h={32} />
                <Skeleton w={`${48 + ((i * 13) % 30)}%`} h={14} />
              </div>
            ))}
          </div>
        </div>
      ) : data.items.length === 0 ? (
        <div className="history-empty">
          <p className="history-empty__title">{h.emptyTitle}</p>
          <p>{h.emptyText}</p>
          {filtered && (
            <button type="button" className="btn" onClick={clear}>
              {h.clear}
            </button>
          )}
        </div>
      ) : (
        <div className="log" key={shown?.sig ?? sig}>
          {[...groups].map(([key, events]) => (
            <section key={key} className="log__day" aria-labelledby={`day-${key}`}>
              <h2 id={`day-${key}`} className="log__date">
                <span className="log__date-text">{dayLabel(key)}</span>
                <span className="log__date-count">{h.dayCount(events.length)}</span>
              </h2>
              <ol className="log__list">
                {events.map((e) => {
                  const i = index++;
                  const Icon = ICON[e.type];
                  const staff = STAFF_TYPES.has(e.type);
                  // Solo las primeras filas visibles se animan; el resto aparece ya en su sitio.
                  const fromMore = !!shown && shown.from > 0 && i >= shown.from;
                  const fresh = !!shown && ((shown.animate && i < 12) || (fromMore && i < shown.from + 12));
                  const delay = fromMore && shown ? i - shown.from : i;
                  return (
                    <li
                      key={e.id}
                      className={`log__row${staff ? " is-staff" : ""}${fresh ? " is-new" : ""}`}
                      style={fresh ? ({ "--i": Math.min(Math.max(delay, 0), 4) } as React.CSSProperties) : undefined}
                    >
                      <time className="log__time code" dateTime={new Date(e.at).toISOString()}>
                        {formatTime(e.at, t.locale)}
                      </time>
                      <span className="log__icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <span className="log__body">
                        <span className="log__text">{sentence(e)}</span>
                        {staff && <span className="log__by">{h.staff}</span>}
                      </span>
                      <span className="log__tag">{h.tag[e.type]}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {data.totalItems > data.items.length && (
            <button
              type="button"
              className="btn log__more"
              onClick={() => {
                setShown((s) => (s ? { ...s, animate: false, from: data.items.length } : s));
                setSize((v) => v + PAGE);
              }}
              disabled={list.isFetching}
            >
              {list.isFetching && <span className="spinner" aria-hidden="true" />}
              {list.isFetching ? h.loadingMore : h.more}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

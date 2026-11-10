"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSessionUser } from "@/components/shell/session-context";
import { Avatar, MethodIcon, TitleRow } from "@/components/ui/bits";
import { IconActive, IconDesktop, IconMobile } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/users/confirm-dialog";
import { STAFF } from "@/data/demo-account";
import { api } from "@/lib/api";
import { BACKEND_MODE } from "@/lib/backend-mode";
import { useActivity, useCaseList, useResetDemo, useUserList } from "@/lib/api/queries";
import { formatNumber, relativeTime } from "@/lib/format";
import { PAGE_SIZES, usePrefs, useStoredValue, type Density, type Theme } from "@/lib/prefs";
import "./settings.css";

const TABS = ["profile", "preferences", "notifications", "security", "data"] as const;
type Tab = (typeof TABS)[number];
const NOTIFS = ["signup", "digest", "pending", "security"] as const;

/** Sello "Guardado" que aparece un momento junto al control que se guardó solo. */
function useSaved() {
  const [at, setAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    saved: at,
    mark: (key: string) => {
      setAt(key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAt(null), 1800);
    },
  };
}

export function SettingsView() {
  const { t, lang, setLang, theme, setTheme, density, setDensity, pageSize, setPageSize } = usePrefs();
  const s = t.settings;
  const me = useSessionUser();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "profile";
  const { saved, mark } = useSaved();
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = useResetDemo();
  const sample = useUserList({ page: 0, size: 1, kind: "customer", sort: { id: "registeredAt", desc: true } });
  const latest = sample.data?.items[0];
  // Con Backend, los roles vienen de la sesión firmada; en la demostración, del personal de prueba.
  const myRoles = me.roles ?? STAFF.find((x) => x.email === me.email)?.roles;
  const mine = useActivity({ page: 0, size: 5, q: me.name });
  const counts = {
    users: useUserList({ page: 0, size: 1 }).data?.statusCounts.all,
    quotes: useCaseList("quotes", { page: 0, size: 1 }).data?.statusCounts.all,
    inquiries: useCaseList("inquiries", { page: 0, size: 1 }).data?.statusCounts.all,
    claims: useCaseList("claims", { page: 0, size: 1 }).data?.statusCounts.all,
    privacy: useCaseList("privacy", { page: 0, size: 1 }).data?.statusCounts.all,
  };
  const sentence = (e: Parameters<typeof t.activity.sentence>[0]) =>
    t.activity.sentence(e, (m) => t.method[m as keyof typeof t.method] ?? m, (r) => r.split(",").map((x) => t.roles[x as keyof typeof t.roles] ?? x).join(", "));

  const stamp = (k: string) => (saved === k ? <span className="saved-stamp">{s.saved}</span> : null);
  const [otherSeenAt] = useState(() => Date.now() - 26 * 3_600_000);

  return (
    <>
      <TitleRow title={s.title} sub={s.lead} />

      <div className="tabs settings-tabs" role="tablist" aria-label={s.title}>
        {TABS.map((k) => (
          <Link key={k} href={`/configuracion?tab=${k}`} role="tab" className="tabs__tab" aria-selected={tab === k} replace scroll={false}>
            {s.tabs[k]}
          </Link>
        ))}
      </div>
      <label className="sr-only" htmlFor="settings-tab">
        {s.title}
      </label>
      <select id="settings-tab" className="select settings-select" value={tab} onChange={(e) => router.replace(`/configuracion?tab=${e.target.value}`, { scroll: false })}>
        {TABS.map((k) => (
          <option key={k} value={k}>
            {s.tabs[k]}
          </option>
        ))}
      </select>

      <div className="settings fade-in" key={tab}>
        {tab === "profile" && (
          <>
          <Row title={s.profileTitle} desc={s.profileDesc}>
            <div className="profile-card">
              <Avatar name={me.name} size="lg" />
              <dl className="kvs kvs--stack">
                <div className="kv">
                  <dt>{s.name}</dt>
                  <dd>{me.name}</dd>
                </div>
                <div className="kv">
                  <dt>{s.email}</dt>
                  <dd>{me.email}</dd>
                </div>
                <div className="kv">
                  <dt>{s.role}</dt>
                  <dd>{myRoles?.length ? myRoles.map((r) => t.roles[r as keyof typeof t.roles] ?? r).join(", ") : "—"}</dd>
                </div>
              </dl>
            </div>
          </Row>
          <Row title={s.myActivity} desc={s.myActivityDesc}>
            {!mine.data ? null : mine.data.items.length === 0 ? (
              <p className="field__hint">{s.noMyActivity}</p>
            ) : (
              <ul className="rows">
                {mine.data.items.map((e) => (
                  <li key={e.id} className="row">
                    <span className="row__main">
                      <span>{sentence(e)}</span>
                    </span>
                    <span className="row__end">{relativeTime(e.at, t.locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Row>
          </>
        )}

        {tab === "preferences" && (
          <Row title={s.prefsTitle} desc={s.prefsDesc}>
            <div className="setting">
              <span className="setting__label" id="pref-theme">
                {s.theme} {stamp("theme")}
              </span>
              <div className="segmented" role="group" aria-labelledby="pref-theme">
                {(["light", "dark", "system"] as Theme[]).map((v) => (
                  <button key={v} type="button" aria-pressed={theme === v} onClick={() => (setTheme(v), mark("theme"))}>
                    {s.themeOpt[v]}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <span className="setting__label" id="pref-lang">
                {s.language} {stamp("lang")}
              </span>
              <div className="segmented" role="group" aria-labelledby="pref-lang">
                {(["es", "en"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={lang === v} onClick={() => (setLang(v), mark("lang"))} lang={v}>
                    {v === "es" ? "Español" : "English"}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <span className="setting__label" id="pref-density">
                {s.density} {stamp("density")}
              </span>
              <div className="segmented" role="group" aria-labelledby="pref-density">
                {(["comfortable", "compact"] as Density[]).map((v) => (
                  <button key={v} type="button" aria-pressed={density === v} onClick={() => (setDensity(v), mark("density"))}>
                    {s.densityOpt[v]}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <label className="setting__label" htmlFor="pref-size">
                {s.pageSize} {stamp("size")}
              </label>
              <select id="pref-size" className="select select--sm setting__select" value={pageSize} onChange={(e) => (setPageSize(Number(e.target.value)), mark("size"))}>
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </Row>
        )}

        {tab === "notifications" && (
          <>
            <Row title={s.notifTitle} desc={s.notifDesc}>
              {NOTIFS.map((k) => (
                <NotifSwitch key={k} id={k} title={s.notif[k].title} text={s.notif[k].text} onSaved={() => mark(`n-${k}`)} saved={saved === `n-${k}`} savedLabel={s.saved} />
              ))}
            </Row>
            <Row title={s.previewTitle} desc={s.notif.signup.text}>
              <article className="mail-preview" aria-label={s.previewTitle}>
                <p className="mail-preview__from">FUNDIGSAC · {me.email}</p>
                <h3 className="mail-preview__subject">{s.previewSubject(latest?.name ?? "—")}</h3>
                <p className="mail-preview__body">
                  {latest && <MethodIcon method={latest.method} size={14} />}
                  {latest ? s.previewBody(latest.name, t.method[latest.method], latest.company ?? "") : "—"}
                </p>
                {latest && (
                  <Link className="btn mail-preview__cta" href={`/usuarios/${latest.id}`}>
                    {s.previewCta}
                  </Link>
                )}
              </article>
            </Row>
          </>
        )}

        {tab === "security" && (
          <>
            <Row title={s.securityTitle} desc={s.securityDesc}>
              <div className="setting setting--block">
                <span className="setting__label">{s.accessMethod}</span>
                <p className="setting__value">
                  <IconActive size={16} className="ok-icon" />
                  {s.accessMethodValue}
                </p>
                <p className="field__hint prose">{s.accessMethodText}</p>
              </div>
              <div className="setting">
                <span>
                  <span className="setting__label">{s.passkeys}</span>
                  <span className="field__hint">{s.passkeysText}</span>
                </span>
                <span className="pill">{s.soon}</span>
              </div>
            </Row>
            <Row title={s.sessionsTitle} desc={s.soon}>
              <ul className="sessions">
                {s.devices.map((d, i) => (
                  <li key={d.name} className="session">
                    {i === 0 ? <IconDesktop size={20} /> : <IconMobile size={20} />}
                    <span className="row__main">
                      <strong>{d.name}</strong>
                      <span className="row__sub">
                        {d.place} · {i === 0 ? s.thisDevice : s.lastSeen(relativeTime(otherSeenAt, t.locale))}
                      </span>
                    </span>
                    {i === 0 && <span className="pill pill--active">{s.deviceNow}</span>}
                  </li>
                ))}
              </ul>
              <button type="button" className="btn" disabled title={s.soon}>
                {s.closeOthers}
              </button>
            </Row>
          </>
        )}

        {tab === "data" && (
          <>
          <Row title={s.source} desc={BACKEND_MODE ? s.sourceLiveNote : s.sourceNextNote}>
            <dl className="kvs">
              {BACKEND_MODE ? (
                <div className="kv">
                  <dt>{t.common.live}</dt>
                  <dd className="num">{s.sourceLive}</dd>
                </div>
              ) : (
                <div className="kv">
                  <dt>{t.common.preview}</dt>
                  <dd>{s.sourceNow}</dd>
                </div>
              )}
              <div className="kv" hidden={BACKEND_MODE}>
                <dt>{s.soon}</dt>
                <dd className="num">{s.sourceNext}</dd>
              </div>
            </dl>
          </Row>
          <Row title={s.stored} desc={s.dataDesc}>
            <table className="table">
              <tbody>
                {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
                  <tr key={k}>
                    <td>{s.modules[k]}</td>
                    <td className="n num">{counts[k] === undefined ? "—" : formatNumber(counts[k] as number, t.locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Row>
          {/* Restablecer solo existe en la demostración: con Backend los datos son reales. */}
          {api.capabilities.resetDemo && (
            <Row title={s.dataTitle} desc={s.resetConfirm}>
              <p className="setting__value">{sample.data ? s.usersCount(sample.data.statusCounts.all) : "—"}</p>
              <div>
                <button type="button" className="btn btn--danger-outline" onClick={() => setConfirmReset(true)} disabled={reset.isPending}>
                  {reset.isPending && <span className="spinner" aria-hidden="true" />}
                  {reset.isPending ? s.resetting : s.reset}
                </button>
              </div>
            </Row>
          )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={s.reset}
        text={s.resetConfirm}
        confirmLabel={s.reset}
        busy={reset.isPending}
        onClose={() => setConfirmReset(false)}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: () => {
              setConfirmReset(false);
              toast.success(t.toast.demoReset);
            },
          })
        }
      />
    </>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="settings-row">
      <div className="settings-row__label">
        <h2 className="panel__title">{title}</h2>
        <p className="panel__meta">{desc}</p>
      </div>
      <div className="panel settings-row__panel">{children}</div>
    </section>
  );
}

function NotifSwitch({ id, title, text, onSaved, saved, savedLabel }: { id: string; title: string; text: string; onSaved: () => void; saved: boolean; savedLabel: string }) {
  const [value, setValue] = useStoredValue(`fa-notif-${id}`, id === "security" || id === "signup" ? "1" : "0");
  return (
    <div className="setting">
      <span>
        <label className="setting__label" htmlFor={`notif-${id}`}>
          {title} {saved && <span className="saved-stamp">{savedLabel}</span>}
        </label>
        <span className="field__hint">{text}</span>
      </span>
      <input
        id={`notif-${id}`}
        type="checkbox"
        role="switch"
        className="switch"
        checked={value === "1"}
        onChange={(e) => {
          setValue(e.target.checked ? "1" : "0");
          onSaved();
        }}
      />
    </div>
  );
}

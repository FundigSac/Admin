"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { resolvePermissions } from "@/components/shell/access";
import { useSessionUser } from "@/components/shell/session-context";
import { Avatar, Skeleton } from "@/components/ui/bits";
import { IconMoon, IconSun } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { IconLanguage, IconShield } from "@/components/users/account-icons";
import { ConfirmDialog } from "@/components/users/confirm-dialog";
import { STAFF } from "@/data/demo-account";
import type { PermissionId } from "@/data/permissions";
import { api } from "@/lib/api";
import { useActivity, useCaseList, useResetDemo, useUserList } from "@/lib/api/queries";
import { BACKEND_MODE } from "@/lib/backend-mode";
import { relativeTime } from "@/lib/format";
import { PAGE_SIZES, usePrefs, type Lang, type Theme } from "@/lib/prefs";
import { settingsCopy, useSettingsCopy } from "./settings-copy";
import "./settings.css";

const THEMES: Theme[] = ["light", "dark", "system"];
const LANGS: { id: Lang; label: string }[] = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
];
// Enlaces antiguos (?tab=...) y el menú de la cuenta llevan a su bloque dentro de la única hoja de Ajustes.
const TAB_TO_BLOCK: Record<string, string> = { preferences: "preferencias", profile: "cuenta", security: "cuenta", notifications: "avisos", data: "datos" };

/** Título y frase de propósito; también se ven mientras carga la pantalla. */
export function SettingsTitle() {
  const s = useSettingsCopy();
  return (
    <header className="title-row settings-title">
      <div>
        <h1 className="title-row__title">{s.title}</h1>
        <p className="title-row__sub settings-title__lead">{s.lead}</p>
      </div>
    </header>
  );
}

export function SettingsView() {
  const { lang, setLang, theme, setTheme, density, setDensity, pageSize, setPageSize } = usePrefs();
  const s = useSettingsCopy();
  const me = useSessionUser();
  const toast = useToast();
  const params = useSearchParams();

  // Con Backend los roles vienen de la sesión firmada; en la demostración, del personal de prueba (o lo ve todo).
  const myRoles = me.roles ?? STAFF.find((x) => x.email === me.email)?.roles;
  const perms = resolvePermissions(myRoles);
  const can = (p: PermissionId) => perms === null || perms.includes(p);
  const isAdmin = can("users:manage");

  // Borrador de preferencias: se aplica todo junto con "Guardar cambios" (brief §6.3).
  const [draftLang, setDraftLang] = useState<Lang | null>(null);
  const [draftTheme, setDraftTheme] = useState<Theme | null>(null);
  const [draftSize, setDraftSize] = useState<number | null>(null);
  const [draftDensity, setDraftDensity] = useState<"comfortable" | "compact" | null>(null);
  const nextLang = draftLang ?? lang;
  const nextTheme = draftTheme ?? theme;
  const nextSize = draftSize ?? pageSize;
  const nextDensity = draftDensity ?? density;
  const dirty = nextLang !== lang || nextTheme !== theme || nextSize !== pageSize || nextDensity !== density;

  const discard = () => {
    setDraftLang(null);
    setDraftTheme(null);
    setDraftSize(null);
    setDraftDensity(null);
  };

  const save = () => {
    if (nextTheme !== theme) setTheme(nextTheme);
    if (nextSize !== pageSize) setPageSize(nextSize);
    if (nextDensity !== density) setDensity(nextDensity);
    if (nextLang !== lang) setLang(nextLang);
    discard();
    toast.success(settingsCopy(nextLang).bar.saved);
  };

  // Al salir del navegador con cambios sin guardar, el navegador pregunta antes de perderlos.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const tab = params.get("tab");
  useEffect(() => {
    const block = tab ? TAB_TO_BLOCK[tab] : undefined;
    if (block && block !== "preferencias") document.getElementById(block)?.scrollIntoView({ block: "start" });
  }, [tab]);

  return (
    <>
      <SettingsTitle />

      <div className="settings-sheet">
        <Block id="preferencias" title={s.prefs.title} desc={s.prefs.desc}>
          <Choice label={s.prefs.language} hint={s.prefs.languageHint} id="pref-lang" icon={<IconLanguage size={20} />}>
            {LANGS.map((v) => (
              <button key={v.id} type="button" lang={v.id} aria-pressed={nextLang === v.id} onClick={() => setDraftLang(v.id)}>
                {v.label}
              </button>
            ))}
          </Choice>
          <Choice label={s.prefs.theme} hint={s.prefs.themeHint} id="pref-theme" icon={nextTheme === "dark" ? <IconMoon size={20} /> : <IconSun size={20} />}>
            {THEMES.map((v) => (
              <button key={v} type="button" aria-pressed={nextTheme === v} onClick={() => setDraftTheme(v)}>
                {s.prefs.themeOpt[v]}
              </button>
            ))}
          </Choice>
          <Choice label={s.prefs.size} hint={s.prefs.sizeHint} id="pref-size">
            {PAGE_SIZES.map((v) => (
              <button key={v} type="button" className="num" aria-pressed={nextSize === v} onClick={() => setDraftSize(v)}>
                {v}
              </button>
            ))}
          </Choice>
          {/* Filas compactas solo en escritorio: en el teléfono los controles mantienen 48 px para el dedo. */}
          <div className="pref-desktop-only">
            <Choice label={s.prefs.density} hint={s.prefs.densityHint} id="pref-density">
              {(["comfortable", "compact"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={nextDensity === v} onClick={() => setDraftDensity(v)}>
                  {s.prefs.densityOpt[v]}
                </button>
              ))}
            </Choice>
          </div>
        </Block>

        <Block id="cuenta" title={s.account.title} desc={s.account.desc}>
          <div className="me-card">
            <Avatar name={me.name} size="lg" />
            <dl className="me-card__data">
              <div>
                <dt>{s.account.name}</dt>
                <dd>{me.name}</dd>
              </div>
              <div>
                <dt>{s.account.email}</dt>
                <dd>{me.email}</dd>
              </div>
              <div>
                <dt>{s.account.job}</dt>
                <dd>
                  <JobNames roles={myRoles} empty={s.account.noJob} />
                  {isAdmin && (
                    <Link href="/roles" className="card-link me-card__link">
                      {s.account.jobLink}
                    </Link>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div className="me-access">
            <IconShield size={22} className="me-access__icon" />
            <div>
              <h3 className="me-access__title">{s.account.access}</h3>
              <p className="me-access__text">{s.account.accessText}</p>
            </div>
          </div>
          {can("audit:read") && <MyRecent />}
        </Block>

        {isAdmin && <AdminBlocks />}
      </div>

      {/* Barra fija al pie: el único botón principal de Ajustes, activo solo si hay cambios. */}
      <div className={`save-bar${dirty ? " is-dirty" : ""}`} role="region" aria-label={s.bar.label}>
        <p className="save-bar__status" aria-live="polite">
          <span className="save-bar__dot" aria-hidden="true" />
          {dirty ? s.bar.dirty : s.bar.clean}
        </p>
        <div className="save-bar__actions">
          {dirty && (
            <button type="button" className="btn btn--ghost" onClick={discard}>
              {s.bar.discard}
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={save} disabled={!dirty}>
            {s.bar.save}
          </button>
        </div>
      </div>
    </>
  );
}

function JobNames({ roles, empty }: { roles?: readonly string[]; empty: string }) {
  const { t } = usePrefs();
  if (!roles?.length) return <span>{empty}</span>;
  return <span>{roles.map((r) => t.roles[r as keyof typeof t.roles] ?? r).join(", ")}</span>;
}

/** Lo último que hizo la persona en el panel (sale del Historial de cambios). */
function MyRecent() {
  const { t } = usePrefs();
  const s = useSettingsCopy();
  const me = useSessionUser();
  const mine = useActivity({ page: 0, size: 5, q: me.name });
  const sentence = (e: Parameters<typeof t.activity.sentence>[0]) =>
    t.activity.sentence(e, (m) => t.method[m as keyof typeof t.method] ?? m, (r) => r.split(",").map((x) => t.roles[x as keyof typeof t.roles] ?? x).join(", "));
  return (
    <div className="me-recent">
      <h3 className="me-recent__title">{s.account.recent}</h3>
      {!mine.data ? (
        <Skeleton w="100%" h={48} />
      ) : mine.data.items.length === 0 ? (
        <p className="me-recent__empty">{s.account.recentEmpty}</p>
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
    </div>
  );
}

/** Avisos por correo y Datos del panel: solo administración. */
function AdminBlocks() {
  const s = useSettingsCopy();
  const toast = useToast();
  const reset = useResetDemo();
  const [confirmReset, setConfirmReset] = useState(false);
  const counts = {
    users: useUserList({ page: 0, size: 1 }).data?.statusCounts.all,
    quotes: useCaseList("quotes", { page: 0, size: 1 }).data?.statusCounts.all,
    inquiries: useCaseList("inquiries", { page: 0, size: 1 }).data?.statusCounts.all,
    claims: useCaseList("claims", { page: 0, size: 1 }).data?.statusCounts.all,
    privacy: useCaseList("privacy", { page: 0, size: 1 }).data?.statusCounts.all,
  };

  return (
    <>
      <Block id="avisos" title={s.notices.title} desc={s.notices.desc}>
        {!BACKEND_MODE && <p className="notice settings-demo">{s.notices.demo}</p>}
        <table className="table table--cards mail-table" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {s.notices.when}
              </th>
              <th scope="col" role="columnheader">
                {s.notices.what}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {s.notices.rows.map((r) => (
              <tr key={r.when} role="row">
                <td role="cell" data-primary="">
                  {r.when}
                </td>
                <td role="cell" className="mail-table__what">
                  {r.what}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block id="datos" title={s.data.title} desc={s.data.desc}>
        <p className="data-source">
          <span className={`pill ${BACKEND_MODE ? "pill--active" : "pill--progress"}`}>
            <span className="pill__dot" aria-hidden="true" />
            {BACKEND_MODE ? s.data.liveTag : s.data.demoTag}
          </span>
          <span className="data-source__text">{BACKEND_MODE ? s.data.sourceLive : s.data.sourceDemo}</span>
        </p>
        <h3 className="data-counts__title">{s.data.counts}</h3>
        <dl className="data-counts">
          {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
            <div key={k} className="data-counts__item">
              <dt>{s.data.modules[k]}</dt>
              <dd className="num">{counts[k] === undefined ? <Skeleton w={40} h={22} /> : s.count(counts[k] as number)}</dd>
            </div>
          ))}
        </dl>
        {/* Restablecer solo existe en la demostración: con Backend los datos son reales. */}
        {api.capabilities.resetDemo && (
          <div className="data-reset">
            <p className="data-reset__text">{s.data.resetText}</p>
            <button type="button" className="btn btn--danger-outline" onClick={() => setConfirmReset(true)} disabled={reset.isPending}>
              {reset.isPending && <span className="spinner" aria-hidden="true" />}
              {reset.isPending ? s.data.resetting : s.data.reset}
            </button>
          </div>
        )}
      </Block>

      <ConfirmDialog
        open={confirmReset}
        title={s.data.resetTitle}
        text={s.data.resetText}
        confirmLabel={s.data.resetOk}
        busy={reset.isPending}
        onClose={() => setConfirmReset(false)}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: () => {
              setConfirmReset(false);
              toast.success(s.data.resetDone);
            },
          })
        }
      />
    </>
  );
}

function Block({ id, title, desc, children }: { id: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="block" id={id} aria-labelledby={`${id}-title`}>
      <div className="block__label">
        <h2 id={`${id}-title`} className="block__title">
          {title}
        </h2>
        <p className="block__desc">{desc}</p>
      </div>
      <div className="block__body">{children}</div>
    </section>
  );
}

/** Una preferencia: rótulo, ayuda y sus opciones como botones (role=group, aria-pressed). */
function Choice({ label, hint, id, icon, children }: { label: string; hint: string; id: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="choice">
      <div className="choice__text">
        <span className="choice__label" id={id}>
          {icon && <span className="choice__icon">{icon}</span>}
          {label}
        </span>
        <span className="choice__hint" id={`${id}-hint`}>
          {hint}
        </span>
      </div>
      <div className="segmented choice__options" role="group" aria-labelledby={id} aria-describedby={`${id}-hint`}>
        {children}
      </div>
    </div>
  );
}

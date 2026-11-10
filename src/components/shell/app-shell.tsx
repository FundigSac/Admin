"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Logo } from "@/components/ui/bits";
import { IconHelp, IconSearch, IconSettings, IconSignOut, IconUpDown } from "@/components/ui/icons";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useQueueCounts } from "@/lib/api/queries";
import { useT } from "@/lib/prefs";
import { endSession, type SessionUser } from "@/lib/session";
import { CommandPalette } from "./command-palette";
import { GuideDialog } from "./guide-dialog";
import { buildNav, sectionOf, type NavSection, type QueueKey } from "./nav";
import { SessionProvider } from "./session-context";
import { useShellCopy } from "./shell-copy";
import "./shell.css";

type Props = {
  user: SessionUser;
  /** Permisos efectivos de la sesión; null cuando la sesión no informa roles (demostración: lo ve todo). */
  permissions: string[] | null;
  children: React.ReactNode;
};

/**
 * Marco del panel. Escritorio: menú de cuatro secciones a la izquierda, barra superior con la sección, la búsqueda
 * y la ayuda, y la hoja de trabajo. Teléfono y tableta: barra inferior fija con las mismas cuatro secciones.
 */
export function AppShell({ user, permissions, children }: Props) {
  const t = useT();
  const c = useShellCopy();
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const queues = useQueueCounts();

  const nav = useMemo(() => buildNav(permissions), [permissions]);
  const currentKey = sectionOf(pathname);
  const current = nav.find((s) => s.key === currentKey);

  const waiting = (key?: QueueKey) => (key && queues.data ? queues.data[key] : 0);
  const sectionWaiting = (s: NavSection) => s.pages.reduce((sum, p) => sum + waiting(p.queue), 0);

  // Las pestañas de sección solo aparecen en la portada de cada lista, no dentro de una ficha.
  const tabs = current && current.pages.length > 1 && current.pages.some((p) => p.href === pathname) ? current.pages : null;

  const modules = useMemo(() => nav.flatMap((s) => s.pages.flatMap((p) => (p.queue ? [p.queue] : []))), [nav]);
  const canManageUsers = nav.some((s) => s.key === "accounts");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = async () => {
    await endSession();
    router.replace("/login");
    router.refresh();
  };

  const account = (compact: boolean) => (
    <Menu
      placement={compact ? "bottom" : "top"}
      align={compact ? "end" : "start"}
      className={compact ? "topbar__account" : "sidebar__account"}
      trigger={(p) =>
        compact ? (
          <button type="button" className="account-icon" aria-label={c.account(user.name)} {...p}>
            <Avatar name={user.name} size="sm" />
          </button>
        ) : (
          <button type="button" className="account-btn" aria-label={c.account(user.name)} {...p}>
            <Avatar name={user.name} size="sm" />
            <span className="account-btn__text">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </span>
            <IconUpDown size={16} aria-hidden="true" />
          </button>
        )
      }
    >
      <MenuItem icon={<IconSettings size={18} />} onSelect={() => router.push("/configuracion?tab=preferences")}>
        {c.preferences}
      </MenuItem>
      <div className="menu__sep" role="separator" />
      <MenuItem icon={<IconSignOut size={18} />} onSelect={logout}>
        {c.logout}
      </MenuItem>
    </Menu>
  );

  const count = (n: number, solid: boolean) =>
    n > 0 ? (
      <span className={`count${solid ? "" : " count--soft"}`}>
        <span aria-hidden="true">{n}</span>
        <span className="sr-only">{c.pending(n)}</span>
      </span>
    ) : null;

  return (
    <SessionProvider user={user}>
      <a href="#contenido" className="skip-link">
        {t.nav.skip}
      </a>
      <div className="app">
        <aside className="sidebar">
          <Link href="/panel" aria-label={c.homeLink} className="sidebar__logo">
            <Logo priority />
          </Link>

          <nav className="sidebar__nav" aria-label={c.nav.label}>
            <ul className="side-list">
              {nav.map((s) => {
                const Icon = s.icon;
                const active = s.key === currentKey;
                return (
                  <li key={s.key}>
                    <Link href={s.href} className="side-item" aria-current={active ? "page" : undefined}>
                      <Icon size={22} weight={active ? "fill" : "duotone"} aria-hidden="true" />
                      <span className="side-item__label">{c.nav[s.key]}</span>
                      {count(sectionWaiting(s), true)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {account(false)}
        </aside>

        <div className="frame">
          <header className="topbar">
            <Link href="/panel" aria-label={c.homeLink} className="topbar__brand">
              <Image src="/brand/fundigsac-icon.svg" alt="" width={28} height={28} />
            </Link>
            <div className="topbar__title">{currentKey ? c.nav[currentKey] : c.app}</div>
            <button type="button" className="search-field" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K" aria-haspopup="dialog">
              <IconSearch size={18} aria-hidden="true" />
              <span className="search-field__text">{c.search}</span>
            </button>
            <button type="button" className="btn btn--ghost topbar__help" onClick={() => setGuideOpen(true)} aria-haspopup="dialog">
              <IconHelp size={20} aria-hidden="true" />
              <span className="topbar__help-text">{c.help}</span>
            </button>
            {account(true)}
          </header>

          <main id="contenido" className="sheet" tabIndex={-1}>
            {tabs && current && (
              <nav className="section-tabs" aria-label={current.key === "requests" ? c.subnav.requests : c.subnav.settings}>
                <ul className="section-tabs__list">
                  {tabs.map((p) => {
                    const Icon = p.icon;
                    const active = p.href === pathname;
                    return (
                      <li key={p.href}>
                        <Link href={p.href} className="section-tab" aria-current={active ? "page" : undefined}>
                          <Icon size={18} weight={active ? "fill" : "duotone"} aria-hidden="true" />
                          <span>{c.pages[p.key]}</span>
                          {count(waiting(p.queue), false)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
            <div className="route">{children}</div>
          </main>
        </div>
      </div>

      <nav className="tabbar" aria-label={c.nav.label}>
        <ul className="tabbar__list">
          {nav.map((s) => {
            const Icon = s.icon;
            const active = s.key === currentKey;
            const n = sectionWaiting(s);
            return (
              <li key={s.key}>
                <Link href={s.href} className="tabbar__item" aria-current={active ? "page" : undefined}>
                  <span className="tabbar__icon">
                    <Icon size={24} weight={active ? "fill" : "duotone"} aria-hidden="true" />
                    {n > 0 && (
                      <span className="tabbar__badge" aria-hidden="true">
                        {n > 99 ? "99+" : n}
                      </span>
                    )}
                  </span>
                  <span className="tabbar__label">{c.nav[s.key]}</span>
                  {n > 0 && <span className="sr-only">{c.pending(n)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} nav={nav} modules={modules} canSearchPeople={canManageUsers} />
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} nav={nav} />
    </SessionProvider>
  );
}

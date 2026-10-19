"use client";

import { IconActivity, IconClose, IconMenu, IconOverview, IconRoles, IconSearch, IconSettings, IconSignOut, IconUpDown, IconUsers, type AppIcon } from "@/components/ui/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Logo } from "@/components/ui/bits";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useT } from "@/lib/prefs";
import { endSession, type SessionUser } from "@/lib/session";
import { CommandPalette } from "./command-palette";
import { LangToggle, ThemeToggle } from "./pref-toggles";
import { SessionProvider } from "./session-context";
import "./shell.css";

export type NavKey = "overview" | "users" | "activity" | "roles" | "settings";
type NavItem = { href: string; key: NavKey; icon: AppIcon };

export const NAV: { group: "general" | "admin"; items: NavItem[] }[] = [
  {
    group: "general",
    items: [
      { href: "/panel", key: "overview", icon: IconOverview },
      { href: "/usuarios", key: "users", icon: IconUsers },
      { href: "/actividad", key: "activity", icon: IconActivity },
    ],
  },
  {
    group: "admin",
    items: [
      { href: "/roles", key: "roles", icon: IconRoles },
      { href: "/configuracion", key: "settings", icon: IconSettings },
    ],
  },
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Al navegar se cierra el menú del teléfono (ajuste de estado durante el render, sin efecto).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setNavOpen(false);
  }

  const current = NAV.flatMap((g) => g.items).find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));

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

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  const logout = () => {
    endSession();
    router.replace("/login");
    router.refresh();
  };

  return (
    <SessionProvider user={user}>
      <a href="#contenido" className="skip-link">
        {t.nav.skip}
      </a>
      <div className="app">
        <aside className={`sidebar${navOpen ? " is-open" : ""}`} aria-label={t.nav.main}>
          <div className="sidebar__brand">
            <Link href="/panel" aria-label={t.nav.home} className="sidebar__logo">
              <Logo priority />
            </Link>
            <button type="button" className="icon-btn sidebar__close" onClick={() => setNavOpen(false)} aria-label={t.nav.closeMenu}>
              <IconClose size={18} aria-hidden="true" />
            </button>
          </div>
          <p className="sidebar__scope">{t.common.app}</p>

          <nav className="sidebar__nav">
            {NAV.map((group) => (
              <div key={group.group} className="sidebar__group">
                <p className="sidebar__label">{t.nav[group.group]}</p>
                <ul className="sidebar__list">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = current?.href === item.href;
                    return (
                      <li key={item.href}>
                        <Link href={item.href} className="nav-item" aria-current={active ? "page" : undefined}>
                          <Icon size={16} aria-hidden="true" />
                          {t.nav[item.key]}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="sidebar__mobile-prefs">
            <LangToggle />
            <ThemeToggle className="icon-btn icon-btn--outline" />
          </div>

          <Menu
            placement="top"
            align="start"
            className="sidebar__account"
            trigger={(p) => (
              <button type="button" className="account-btn" {...p} aria-label={`${t.topbar.account}: ${user.name}`}>
                <Avatar name={user.name} size="sm" />
                <span className="account-btn__text">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </span>
                <IconUpDown size={15} aria-hidden="true" />
              </button>
            )}
          >
            <MenuItem icon={<IconSettings size={16} />} onSelect={() => router.push("/configuracion")}>
              {t.nav.profile}
            </MenuItem>
            <div className="menu__sep" role="separator" />
            <MenuItem icon={<IconSignOut size={16} />} onSelect={logout}>
              {t.nav.logout}
            </MenuItem>
          </Menu>
        </aside>
        {navOpen && <div className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

        <div className="frame">
          <header className="topbar">
            <button type="button" className="icon-btn topbar__menu" onClick={() => setNavOpen(true)} aria-label={t.nav.openMenu} aria-expanded={navOpen}>
              <IconMenu size={19} aria-hidden="true" />
            </button>
            <span className="topbar__title">{current ? t.nav[current.key] : t.common.app}</span>
            <button type="button" className="search-btn" onClick={() => setPaletteOpen(true)} aria-label={t.topbar.searchLabel} aria-keyshortcuts="Control+K">
              <IconSearch size={15} aria-hidden="true" />
              <span className="search-btn__text">{t.topbar.search}</span>
              <kbd className="kbd">{t.topbar.shortcut}</kbd>
            </button>
            <div className="topbar__end">
              <LangToggle />
              <ThemeToggle />
            </div>
          </header>
          <main id="contenido" className="sheet" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </SessionProvider>
  );
}

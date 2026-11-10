"use client";

import { IconHelp, IconActivity, IconComplaints, IconInquiries, IconPrivacy, IconQuotes, IconClose, IconMenu, IconOverview, IconRoles, IconSearch, IconSettings, IconSignOut, IconUpDown, IconUsers, type AppIcon } from "@/components/ui/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Logo } from "@/components/ui/bits";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useQueueCounts } from "@/lib/api/queries";
import type { Copy } from "@/lib/i18n/es";
import { useT } from "@/lib/prefs";
import { endSession, type SessionUser } from "@/lib/session";
import { CommandPalette } from "./command-palette";
import { GuideDialog } from "./guide-dialog";
import { LangToggle, ThemeToggle } from "./pref-toggles";
import { SessionProvider } from "./session-context";
import "./shell.css";

export type NavKey = "overview" | "users" | "activity" | "roles" | "settings" | "quotes" | "inquiries" | "claims" | "privacy";
type NavItem = { href: string; key: NavKey; icon: AppIcon };
type QueueKey = "quotes" | "inquiries" | "claims" | "privacy";
type NavGroup = "general" | "service" | "admin";

export function navLabel(t: Copy, key: NavKey) {
  return key === "quotes" || key === "inquiries" || key === "claims" || key === "privacy" ? t.cases.nav[key] : t.nav[key];
}

function groupLabel(t: Copy, group: NavGroup) {
  return group === "service" ? t.cases.nav.group : t.nav[group];
}

export const NAV: { group: NavGroup; items: NavItem[] }[] = [
  {
    group: "general",
    items: [
      { href: "/panel", key: "overview", icon: IconOverview },
      { href: "/usuarios", key: "users", icon: IconUsers },
      { href: "/actividad", key: "activity", icon: IconActivity },
    ],
  },
  {
    group: "service",
    items: [
      { href: "/cotizaciones", key: "quotes", icon: IconQuotes },
      { href: "/consultas", key: "inquiries", icon: IconInquiries },
      { href: "/reclamaciones", key: "claims", icon: IconComplaints },
      { href: "/privacidad", key: "privacy", icon: IconPrivacy },
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const queues = useQueueCounts();

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

  const logout = async () => {
    await endSession();
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
                <p className="sidebar__label">{groupLabel(t, group.group)}</p>
                <ul className="sidebar__list">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = current?.href === item.href;
                    return (
                      <li key={item.href}>
                        <Link href={item.href} className="nav-item" aria-current={active ? "page" : undefined}>
                          <Icon size={16} aria-hidden="true" />
                          <span className="nav-item__label">{navLabel(t, item.key)}</span>
                          {queues.data && item.key in queues.data && (queues.data[item.key as QueueKey] as number) > 0 ? (
                            <span className="nav-count" aria-label={`${queues.data[item.key as QueueKey]}`}>
                              {queues.data[item.key as QueueKey] as number}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="sidebar__mobile-prefs">
            <button type="button" className="btn" onClick={() => setGuideOpen(true)}>
              <IconHelp size={16} />
              {t.guide.open}
            </button>
            <LangToggle />
            <ThemeToggle className="icon-btn icon-btn--outline" />
          </div>

          <Menu
            placement="top"
            align="start"
            className="sidebar__account"
            trigger={(p) => (
              <button type="button" className="account-btn" {...p}>
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
            <span className="topbar__title">{current ? navLabel(t, current.key) : t.common.app}</span>
            <button type="button" className="search-btn" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K">
              <IconSearch size={15} aria-hidden="true" />
              <span className="search-btn__text">{t.topbar.search}</span>
              <kbd className="kbd">{t.topbar.shortcut}</kbd>
            </button>
            <div className="topbar__end">
              <button type="button" className="icon-btn" onClick={() => setGuideOpen(true)} aria-label={t.guide.open} title={t.guide.open}>
                <IconHelp size={19} />
              </button>
              <LangToggle />
              <ThemeToggle />
            </div>
          </header>
          <main id="contenido" className="sheet" tabIndex={-1}>
            {/* La clave por ruta reinicia la llegada escalonada de cada pantalla. */}
            <div key={pathname} className="route">
              {children}
            </div>
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </SessionProvider>
  );
}

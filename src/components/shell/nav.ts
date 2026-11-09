import { IconActivity, IconComplaints, IconHome, IconInquiries, IconPrivacy, IconQuotes, IconRequests, IconRoles, IconSettings, IconUsers, type AppIcon } from "@/components/ui/icons";
import type { PermissionId } from "@/data/permissions";

// Cuatro secciones sin grupos (brief de diseño, §6.1). Las rutas no cambian: solo su lugar en el menú.
// Solicitudes reúne las cuatro colas en pestañas; Ajustes reúne preferencias, permisos e historial.

export type SectionKey = "home" | "requests" | "accounts" | "settings";
export type PageKey = "home" | "quotes" | "inquiries" | "claims" | "privacy" | "accounts" | "preferences" | "roles" | "activity";
export type QueueKey = "quotes" | "inquiries" | "claims" | "privacy";

export type NavPage = { key: PageKey; href: string; icon: AppIcon; perm?: PermissionId; queue?: QueueKey };
export type NavSection = { key: SectionKey; icon: AppIcon; pages: NavPage[]; href: string };

const SECTIONS: Omit<NavSection, "href">[] = [
  { key: "home", icon: IconHome, pages: [{ key: "home", href: "/panel", icon: IconHome }] },
  {
    key: "requests",
    icon: IconRequests,
    pages: [
      { key: "quotes", href: "/cotizaciones", icon: IconQuotes, perm: "quote:read", queue: "quotes" },
      { key: "inquiries", href: "/consultas", icon: IconInquiries, perm: "inquiry:read", queue: "inquiries" },
      { key: "claims", href: "/reclamaciones", icon: IconComplaints, perm: "complaint:read", queue: "claims" },
      { key: "privacy", href: "/privacidad", icon: IconPrivacy, perm: "privacy:read", queue: "privacy" },
    ],
  },
  { key: "accounts", icon: IconUsers, pages: [{ key: "accounts", href: "/usuarios", icon: IconUsers, perm: "users:manage" }] },
  {
    key: "settings",
    icon: IconSettings,
    pages: [
      { key: "preferences", href: "/configuracion", icon: IconSettings },
      { key: "roles", href: "/roles", icon: IconRoles, perm: "users:manage" },
      { key: "activity", href: "/actividad", icon: IconActivity, perm: "audit:read" },
    ],
  },
];

/** Secciones y páginas que la persona puede usar; null en permisos significa "todas". */
export function buildNav(perms: readonly string[] | null): NavSection[] {
  const can = (p?: PermissionId) => !p || perms === null || perms.includes(p);
  return SECTIONS.map((s) => ({ ...s, pages: s.pages.filter((p) => can(p.perm)) }))
    .filter((s) => s.pages.length > 0)
    .map((s) => ({ ...s, href: s.pages[0].href }));
}

export function isWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sección a la que pertenece una ruta, aunque el menú de esa persona no la muestre. */
export function sectionOf(pathname: string): SectionKey | null {
  return SECTIONS.find((s) => s.pages.some((p) => isWithin(pathname, p.href)))?.key ?? null;
}

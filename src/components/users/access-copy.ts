import type { PermissionGroup, PermissionId } from "@/data/permissions";
import type { UserRole } from "@/data/types";
import { usePrefs } from "@/lib/prefs";

// Lo que permite cada puesto, dicho en frases (brief de diseño §6.2: "catalog:read" pasa a "Puede ver el catálogo").
// Lo usan Cuentas (ficha) y "Qué puede hacer cada persona". Las claves siguen siendo las del Backend
// (src/data/permissions.ts); aquí solo cambia cómo se leen.

const es = {
  roleText: {
    customer: "Se registró en fundigsac.com para cotizar y guardar productos. No entra a este panel.",
    administrator: "Puede hacer todo: atender solicitudes, publicar textos legales, revisar el historial y manejar las cuentas del equipo.",
    sales: "Atiende las cotizaciones y las consultas que llegan desde el sitio. Puede ver el catálogo.",
    catalog_editor: "Crea y corrige productos del catálogo. No los publica: eso lo hace el Revisor de catálogo.",
    catalog_reviewer: "Revisa los cambios del catálogo y los publica en el sitio.",
    legal_support: "Responde el Libro de Reclamaciones (15 días hábiles por reclamo) y los pedidos de datos personales (10 días hábiles). Publica los textos legales y puede leer las consultas.",
    read_only: "Puede mirar el catálogo, las cotizaciones, las consultas y los reclamos. No cambia nada.",
  } satisfies Record<UserRole, string>,
  group: {
    sales: "Solicitudes de clientes",
    legal: "Reclamos y datos personales",
    catalog: "Catálogo de productos",
    platform: "Cuentas y control del panel",
  } satisfies Record<PermissionGroup, string>,
  perm: {
    "quote:read": "Ver las cotizaciones",
    "quote:manage": "Atender y responder cotizaciones",
    "inquiry:read": "Ver las consultas",
    "inquiry:manage": "Responder consultas",
    "complaint:read": "Ver los reclamos",
    "complaint:manage": "Responder reclamos",
    "privacy:read": "Ver los pedidos de datos personales",
    "privacy:manage": "Atender pedidos de datos personales",
    "legal:publish": "Publicar textos legales",
    "catalog:read": "Ver el catálogo",
    "catalog:write": "Crear y corregir productos",
    "catalog:publish": "Publicar cambios del catálogo",
    "users:manage": "Agregar, bloquear y eliminar cuentas, y cambiar puestos",
    "audit:read": "Ver el historial de cambios",
    "notifications:manage": "Revisar y reenviar los correos automáticos",
  } satisfies Record<PermissionId, string>,
  joinList: (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`),
};

export type AccessCopy = typeof es;

const en: AccessCopy = {
  roleText: {
    customer: "Signed up on fundigsac.com to request quotes and save products. Does not use this panel.",
    administrator: "Can do everything: handle requests, publish legal texts, review the history and manage staff accounts.",
    sales: "Handles the quote requests and inquiries that come in from the website. Can view the catalog.",
    catalog_editor: "Creates and corrects catalog products. Does not publish them; the Catalog reviewer does that.",
    catalog_reviewer: "Reviews catalog changes and publishes them on the website.",
    legal_support: "Answers the Complaints Book (15 business days per complaint) and personal data requests (10 business days). Publishes legal texts and can read inquiries.",
    read_only: "Can look at the catalog, quotes, inquiries and complaints. Cannot change anything.",
  },
  group: {
    sales: "Customer requests",
    legal: "Complaints and personal data",
    catalog: "Product catalog",
    platform: "Accounts and panel control",
  },
  perm: {
    "quote:read": "View quotes",
    "quote:manage": "Handle and answer quotes",
    "inquiry:read": "View inquiries",
    "inquiry:manage": "Answer inquiries",
    "complaint:read": "View complaints",
    "complaint:manage": "Answer complaints",
    "privacy:read": "View personal data requests",
    "privacy:manage": "Handle personal data requests",
    "legal:publish": "Publish legal texts",
    "catalog:read": "View the catalog",
    "catalog:write": "Create and correct products",
    "catalog:publish": "Publish catalog changes",
    "users:manage": "Add, block and delete accounts, and change jobs",
    "audit:read": "View the change history",
    "notifications:manage": "Review and resend automatic emails",
  },
  joinList: (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`),
};

const COPY = { es, en };

export function useAccessCopy(): AccessCopy {
  return COPY[usePrefs().lang];
}

/** Orden de lectura de los grupos: primero lo que llega de clientes, al final el control del panel. */
export const GROUP_ORDER: PermissionGroup[] = ["sales", "legal", "catalog", "platform"];

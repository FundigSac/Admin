import type { UserRole } from "./types";

// Copia fiel de com.fundigsac.shared.security.Permission y com.fundigsac.identity.domain.Role del Backend.
// Si el Backend cambia un rol, se actualiza aquí y la matriz de /roles lo refleja.

export const PERMISSIONS = [
  { id: "catalog:read", group: "catalog" },
  { id: "catalog:write", group: "catalog" },
  { id: "catalog:publish", group: "catalog" },
  { id: "quote:read", group: "sales" },
  { id: "quote:manage", group: "sales" },
  { id: "inquiry:read", group: "sales" },
  { id: "inquiry:manage", group: "sales" },
  { id: "complaint:read", group: "legal" },
  { id: "complaint:manage", group: "legal" },
  { id: "privacy:read", group: "legal" },
  { id: "privacy:manage", group: "legal" },
  { id: "legal:publish", group: "legal" },
  { id: "users:manage", group: "platform" },
  { id: "audit:read", group: "platform" },
  { id: "notifications:manage", group: "platform" },
] as const;

export type PermissionId = (typeof PERMISSIONS)[number]["id"];
export type PermissionGroup = (typeof PERMISSIONS)[number]["group"];

const ALL = PERMISSIONS.map((p) => p.id);

export const ROLE_PERMISSIONS: Record<UserRole, readonly PermissionId[]> = {
  customer: [],
  administrator: ALL,
  sales: ["quote:read", "quote:manage", "inquiry:read", "inquiry:manage", "catalog:read"],
  catalog_editor: ["catalog:read", "catalog:write"],
  catalog_reviewer: ["catalog:read", "catalog:publish"],
  legal_support: ["complaint:read", "complaint:manage", "privacy:read", "privacy:manage", "legal:publish", "inquiry:read"],
  read_only: ["catalog:read", "quote:read", "inquiry:read", "complaint:read"],
};

export const ROLES: UserRole[] = ["customer", "administrator", "sales", "catalog_editor", "catalog_reviewer", "legal_support", "read_only"];
export const STAFF_ROLES: UserRole[] = ROLES.filter((r) => r !== "customer");

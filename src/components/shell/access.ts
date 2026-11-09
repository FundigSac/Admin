import { PERMISSIONS, ROLE_PERMISSIONS, type PermissionId } from "@/data/permissions";
import type { UserRole } from "@/data/types";

// Qué secciones del menú ve cada persona. Ocultar una sección no la protege: eso lo hacen el proxy y el Backend.
// Aquí solo se evita mostrar caminos que el rol no puede usar.

const KNOWN = new Set<string>(PERMISSIONS.map((p) => p.id));

/** Acepta "quote:read", "QUOTE:READ" o "QUOTE_READ" y devuelve la forma del panel. */
function normalize(permission: string) {
  const value = permission.trim().toLowerCase();
  return value.includes(":") ? value : value.replace("_", ":");
}

/**
 * Permisos efectivos a partir de los roles y los permisos que trae la sesión.
 * Devuelve null cuando la sesión no informa roles (la demostración entra como administración y lo ve todo).
 */
export function resolvePermissions(roles?: readonly string[], permissions?: readonly string[]): PermissionId[] | null {
  if (!roles && !permissions) return null;
  const out = new Set<PermissionId>();
  for (const p of permissions ?? []) {
    const id = normalize(p);
    if (KNOWN.has(id)) out.add(id as PermissionId);
  }
  for (const r of roles ?? []) {
    const role = r.trim().toLowerCase();
    if (Object.hasOwn(ROLE_PERMISSIONS, role)) ROLE_PERMISSIONS[role as UserRole].forEach((p) => out.add(p));
  }
  return [...out];
}

import "server-only";
import { randomUUID } from "node:crypto";
import { ACCESS_TTL_SECONDS, randomToken, sha256Hex, signAccessToken, verifyAccessToken } from "./crypto";
import { db, type Tx } from "./db";
import { forbidden, Problem, unauthorized } from "./http";

/** Igual que com.fundigsac.shared.security.Permission (autoridad tal como la devuelve /staff/profile). */
export const PERMISSIONS = [
  "catalog:read", "catalog:write", "catalog:publish", "quote:read", "quote:manage", "inquiry:read", "inquiry:manage",
  "complaint:read", "complaint:manage", "privacy:read", "privacy:manage", "legal:publish", "users:manage", "audit:read",
  "notifications:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Igual que com.fundigsac.identity.domain.Role: menor privilegio por función. */
export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  CUSTOMER: [],
  ADMINISTRATOR: PERMISSIONS,
  SALES: ["quote:read", "quote:manage", "inquiry:read", "inquiry:manage", "catalog:read"],
  CATALOG_EDITOR: ["catalog:read", "catalog:write"],
  CATALOG_REVIEWER: ["catalog:read", "catalog:publish"],
  LEGAL_SUPPORT: ["complaint:read", "complaint:manage", "privacy:read", "privacy:manage", "legal:publish", "inquiry:read"],
  READ_ONLY: ["catalog:read", "quote:read", "inquiry:read", "complaint:read"],
};
export const STAFF_ROLES = Object.keys(ROLE_PERMISSIONS).filter((r) => r !== "CUSTOMER");

export const permissionsOf = (roles: string[]) => [...new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r] ?? []))].sort();

export type Principal = { id: string; kind: "STAFF" | "CUSTOMER"; email: string; fullName: string; roles: string[]; permissions: string[] };

// Como el Backend: 12 h para el personal, 14 días para clientes.
const refreshTtl = (kind: "STAFF" | "CUSTOMER") => (kind === "STAFF" ? 12 * 3600 : 14 * 24 * 3600);

export type Tokens = { accessToken: string; tokenType: "Bearer"; expiresIn: number; refreshToken: string; refreshExpiresIn: number };

/** Abre una sesión: token de acceso de 15 minutos y refresh rotativo de 7 días (solo se guarda su hash). */
export async function issueTokens(tx: Tx, user: { id: string; kind: "STAFF" | "CUSTOMER"; security_stamp: number }, familyId: string = randomUUID()): Promise<Tokens> {
  const refresh = randomToken(32);
  await tx`insert into app.refresh_tokens (id, user_id, family_id, token_hash, issued_at, expires_at)
           values (${randomUUID()}, ${user.id}, ${familyId}, ${sha256Hex(refresh)}, now(), now() + make_interval(secs => ${refreshTtl(user.kind)}))`;
  return {
    accessToken: signAccessToken(user.id, user.kind, user.security_stamp),
    tokenType: "Bearer",
    expiresIn: ACCESS_TTL_SECONDS,
    refreshToken: refresh,
    refreshExpiresIn: refreshTtl(user.kind),
  };
}

/**
 * Rota el refresh: el usado queda revocado y reemplazado. Si llega uno ya revocado (robo o repetición) se revoca toda
 * su familia, como el Backend.
 */
export async function rotateRefresh(refreshToken: unknown): Promise<Tokens> {
  if (typeof refreshToken !== "string" || refreshToken.length < 20 || refreshToken.length > 200) throw unauthorized("INVALID_SESSION");
  // La revocación por reutilización debe quedar confirmada: el error se lanza fuera de la transacción.
  const outcome = await db().begin(async (tx): Promise<Tokens | string> => {
    const [row] = await tx<{ id: string; user_id: string; family_id: string; revoked_at: Date | null; expires_at: Date }[]>`
      select id, user_id, family_id, revoked_at, expires_at from app.refresh_tokens where token_hash = ${sha256Hex(refreshToken)} for update`;
    if (!row) return "INVALID_SESSION";
    if (row.revoked_at) {
      await tx`update app.refresh_tokens set revoked_at = now() where family_id = ${row.family_id} and revoked_at is null`;
      return "INVALID_SESSION";
    }
    if (row.expires_at.getTime() <= Date.now()) return "INVALID_SESSION";
    const [user] = await tx<{ id: string; kind: "STAFF" | "CUSTOMER"; status: string; security_stamp: number }[]>`
      select id, kind, status, security_stamp from app.user_accounts where id = ${row.user_id}`;
    if (!user || user.status !== "ACTIVE") {
      await tx`update app.refresh_tokens set revoked_at = now() where family_id = ${row.family_id} and revoked_at is null`;
      return "INVALID_SESSION";
    }
    const tokens = await issueTokens(tx, user, row.family_id);
    const [next] = await tx<{ id: string }[]>`select id from app.refresh_tokens where token_hash = ${sha256Hex(tokens.refreshToken)}`;
    await tx`update app.refresh_tokens set revoked_at = now(), replaced_by = ${next.id} where id = ${row.id}`;
    return tokens;
  });
  if (typeof outcome === "string") throw unauthorized(outcome);
  return outcome;
}

export async function revokeRefresh(refreshToken: unknown): Promise<void> {
  if (typeof refreshToken !== "string" || refreshToken.length > 200) return;
  await db()`update app.refresh_tokens set revoked_at = now() where token_hash = ${sha256Hex(refreshToken)} and revoked_at is null`;
}

/** Quién llama, a partir del Bearer. La cuenta debe seguir activa y con el mismo sello de seguridad. */
export async function principal(request: Request): Promise<Principal> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const claims = token ? verifyAccessToken(token) : null;
  if (!claims) throw unauthorized("INVALID_TOKEN");
  const [user] = await db()<{ id: string; kind: "STAFF" | "CUSTOMER"; email: string; full_name: string; status: string; security_stamp: number; roles: string[] }[]>`
    select u.id, u.kind, u.email, u.full_name, u.status, u.security_stamp,
           coalesce(array_agg(r.role) filter (where r.role is not null), '{}') as roles
      from app.user_accounts u left join app.user_roles r on r.user_id = u.id
     where u.id = ${claims.sub} group by u.id`;
  if (!user || user.status !== "ACTIVE" || user.security_stamp !== claims.stamp) throw unauthorized("INVALID_TOKEN");
  return { id: user.id, kind: user.kind, email: user.email, fullName: user.full_name, roles: user.roles, permissions: permissionsOf(user.roles) };
}

export async function requireStaff(request: Request, ...needed: Permission[]): Promise<Principal> {
  const p = await principal(request);
  if (p.kind !== "STAFF") throw forbidden("FORBIDDEN");
  for (const perm of needed) if (!p.permissions.includes(perm)) throw forbidden("FORBIDDEN");
  return p;
}

export async function requireCustomer(request: Request): Promise<Principal> {
  const p = await principal(request);
  if (p.kind !== "CUSTOMER") throw forbidden("FORBIDDEN");
  return p;
}

/** Cliente opcional: un token inválido o ausente no impide enviar formularios públicos. */
export async function optionalPrincipal(request: Request): Promise<Principal | null> {
  try {
    return await principal(request);
  } catch (e) {
    if (e instanceof Problem) return null;
    throw e;
  }
}

export async function audit(tx: Tx, actorId: string | null, action: string, resourceType: string, resourceId: string, details: Record<string, unknown> = {}): Promise<void> {
  await tx`insert into app.audit_events (id, occurred_at, recorded_at, actor_id, action, resource_type, resource_id, details)
           values (${randomUUID()}, clock_timestamp(), now(), ${actorId}, ${action}, ${resourceType}, ${resourceId}, ${tx.json(details as never)})`;
}

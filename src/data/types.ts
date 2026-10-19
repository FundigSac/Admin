// Modelo de una cuenta del sitio. Sigue el contrato del Backend (AccountView en com.fundigsac.identity y la tabla
// user_accounts de V2__identity.sql) y suma lo que pide el formulario de /registro del frontend: método de alta,
// boletín y la página de origen. Así, conectar el Backend después solo cambia el adaptador de src/lib/api.

export type AccountKind = "customer" | "staff";
export type SignupMethod = "email" | "google" | "facebook";
/** PENDING_VERIFICATION, ACTIVE y DISABLED del Backend. DELETED no se lista: la cuenta queda anonimizada. */
export type UserStatus = "active" | "pending" | "disabled";
/** Roles del enum com.fundigsac.identity.domain.Role. */
export type UserRole = "customer" | "administrator" | "sales" | "catalog_editor" | "catalog_reviewer" | "legal_support" | "read_only";
/** Página del sitio desde la que se creó la cuenta. */
export type SignupSource = "registro" | "carrito" | "cotizar" | "login";

export type User = {
  id: string;
  kind: AccountKind;
  name: string;
  email: string;
  company: string | null;
  ruc: string | null;
  phone: string | null;
  method: SignupMethod;
  status: UserStatus;
  roles: UserRole[];
  emailVerified: boolean;
  newsletter: boolean;
  /** Versión del aviso de privacidad aceptada al registrarse (Ley 29733). */
  privacyNoticeVersion: string;
  source: SignupSource;
  registeredAt: number;
  lastActiveAt: number | null;
  quotes: number;
  cartItems: number;
  sessions: number;
  city: string;
  device: "desktop" | "mobile";
  notes: string;
  /** Versión optimista: el Backend la exige en If-Match para modificar la cuenta. */
  version: number;
};

export type ActivityType = "signup" | "login" | "verify" | "quote" | "password" | "disable" | "enable" | "roles" | "update" | "delete" | "invite";

export type Activity = {
  id: string;
  at: number;
  type: ActivityType;
  userId: string;
  userName: string;
  /** Quién hizo la acción: el propio usuario (null) o un miembro del personal. */
  actor: string | null;
  detail?: string;
};

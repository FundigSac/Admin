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

// ───────── Atención: lo que llega desde los formularios del sitio ─────────
// Cada caso sigue los campos del formulario correspondiente del frontend (src/modules/leads/forms.ts y
// src/app/_legal/claim-message.ts) y los módulos quotation, inquiry, complaint y privacy del Backend.

export type CaseEvent = { at: number; label: string; actor: string | null; note?: string };

export type QuoteStatus = "new" | "reviewing" | "sent" | "won" | "lost";
export type QuoteSource = "general" | "product" | "procurement" | "cart";
export type ProjectType = "saneamiento" | "matrices" | "alcantarillado" | "otro";
export type ProductFamily = "valvulas" | "tuberias" | "marcos_tapas" | "mixto";

export type QuoteItem = { product: string; dn: string; qty: number; unit: "und" | "m" };

export type Quote = {
  id: string;
  code: string;
  createdAt: number;
  status: QuoteStatus;
  source: QuoteSource;
  company: string;
  ruc: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  projectType: ProjectType;
  destination: string;
  family: ProductFamily;
  items: QuoteItem[];
  deliveryBy: number | null;
  message: string;
  assignee: string | null;
  userId: string | null;
  history: CaseEvent[];
};

export type InquiryStatus = "new" | "answered" | "closed";
export type InquiryReason = "documentacion" | "reunion";

export type Inquiry = {
  id: string;
  code: string;
  createdAt: number;
  status: InquiryStatus;
  fullName: string;
  company: string;
  ruc: string;
  position: string;
  email: string;
  phone: string;
  reason: InquiryReason;
  message: string;
  reply: string | null;
  assignee: string | null;
  history: CaseEvent[];
};

export type ClaimKind = "reclamo" | "queja";
export type ClaimStatus = "received" | "in_progress" | "answered";
export type DocType = "DNI" | "CE" | "RUC" | "Pasaporte";

export type Claim = {
  id: string;
  /** Número correlativo de la hoja del Libro de Reclamaciones. */
  code: string;
  createdAt: number;
  /** Plazo legal: 15 días hábiles improrrogables (art. 24.1 del Código, mod. Ley 31435). */
  dueAt: number;
  kind: ClaimKind;
  status: ClaimStatus;
  name: string;
  docType: DocType;
  docNumber: string;
  address: string;
  phone: string;
  email: string;
  minor: boolean;
  representative: { name: string; doc: string } | null;
  goodType: "PRODUCTO" | "SERVICIO" | null;
  product: string | null;
  amount: number | null;
  currency: "PEN" | "USD";
  place: string | null;
  eventDate: number;
  orderRef: string | null;
  facts: string;
  request: string;
  responseChannel: "Correo electrónico" | "Carta al domicilio";
  answer: { text: string; at: number; actor: string } | null;
  assignee: string | null;
  history: CaseEvent[];
};

export type PrivacyStatus = "received" | "identity" | "processing" | "done";
export type PrivacyChannel = "form" | "email" | "whatsapp";

export type PrivacyRequest = {
  id: string;
  code: string;
  createdAt: number;
  /** Supresión de cuenta y datos: 10 días hábiles (art. 69.3 del D.S. 016-2024-JUS). */
  dueAt: number;
  status: PrivacyStatus;
  name: string;
  email: string;
  channel: PrivacyChannel;
  userId: string | null;
  reason: string;
  history: CaseEvent[];
};

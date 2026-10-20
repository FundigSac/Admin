import type { Activity, ActivityType, CaseEvent, Claim, Inquiry, PrivacyRequest, Quote, SignupMethod, User, UserRole, UserStatus } from "@/data/types";

// Contrato entre el panel y su origen de datos. Hoy lo cumple el adaptador local (mock-adapter.ts); al conectar el
// Backend se implementa con fetch a /api/v1/staff/** y nada más del panel cambia.

/** Igual que com.fundigsac.shared.application.PageResult. */
export type PageResult<T> = { items: T[]; page: number; size: number; totalItems: number; totalPages: number };

export type SortKey = "name" | "registeredAt" | "lastActiveAt" | "quotes" | "status";
export type RangeKey = "7d" | "30d" | "90d" | "all";

export type UserListParams = {
  page: number;
  size: number;
  q?: string;
  status?: UserStatus | "all";
  method?: SignupMethod | "all";
  role?: UserRole | "all";
  kind?: "customer" | "staff" | "all";
  range?: RangeKey;
  sort?: { id: SortKey; desc: boolean };
};

export type UserListResult = PageResult<User> & {
  /** Conteos por estado con los mismos filtros (menos el de estado) para las pestañas. */
  statusCounts: Record<UserStatus | "all", number>;
};

export type DashboardStats = {
  total: number;
  newInRange: number;
  newPrevRange: number;
  pending: number;
  activeWeek: number;
  disabled: number;
  verifiedRate: number;
  newsletterRate: number;
  series: { day: number; count: number }[];
  byMethod: Record<SignupMethod, number>;
  byStatus: Record<UserStatus, number>;
  bySource: { source: string; count: number }[];
  byCity: { city: string; count: number }[];
  latest: User[];
  /** Embudo del periodo: cuentas nuevas que verificaron su correo y que enviaron al menos una cotización. */
  funnel: { registered: number; verified: number; quoted: number };
  /** Pendientes de verificar, la más antigua primero, y cuántas llevan más de 48 h. */
  pendingOldest: User[];
  pendingOver48h: number;
  generatedAt: number;
};

export type ActivityParams = { page: number; size: number; q?: string; type?: ActivityType | "all"; userId?: string };

export type UserDraft = {
  name: string;
  email: string;
  company: string | null;
  ruc: string | null;
  phone: string | null;
  kind: "customer" | "staff";
  roles: UserRole[];
  status: UserStatus;
  notes?: string;
};

export type CaseModule = "quotes" | "inquiries" | "claims" | "privacy";
export type CaseMap = { quotes: Quote; inquiries: Inquiry; claims: Claim; privacy: PrivacyRequest };
export type CaseSort = "newest" | "oldest" | "due";
export type CaseListParams = { page: number; size: number; q?: string; status?: string; sort?: CaseSort };
export type CaseListResult<T> = PageResult<T> & { statusCounts: Record<string, number> };
/** Lo que espera atención en cada cola (nuevas o abiertas) y los plazos legales más próximos. */
export type QueueCounts = {
  quotes: number;
  inquiries: number;
  claims: number;
  privacy: number;
  due: { module: "claims" | "privacy"; id: string; code: string; name: string; dueAt: number }[];
};

/** Miembro del personal que puede atender casos (responsables de cotizaciones, consultas y reclamaciones). */
export type StaffMember = { id: string; name: string; email: string; roles: UserRole[] };

/**
 * Qué permite cada origen de datos. La demostración lo simula todo; el Backend no da de alta clientes (se registran en
 * el sitio y aceptan el aviso de privacidad), no cambia correos desde el panel y guarda notas internas solo en las
 * reclamaciones.
 */
export type ApiCapabilities = {
  createCustomers: boolean;
  editEmail: boolean;
  resetDemo: boolean;
  /** El estado se elige en el formulario (demo) o solo con las acciones Activar y Desactivar (Backend). */
  statusInForm: boolean;
  caseNotes: readonly CaseModule[];
  caseAssign: readonly CaseModule[];
};

export type UsersApi = {
  capabilities: ApiCapabilities;
  listStaff(): Promise<StaffMember[]>;
  listUsers(params: UserListParams): Promise<UserListResult>;
  getUser(id: string): Promise<User | null>;
  stats(range: RangeKey): Promise<DashboardStats>;
  listActivity(params: ActivityParams): Promise<PageResult<Activity>>;
  createUser(draft: UserDraft, actor: string): Promise<User>;
  updateUser(id: string, patch: Partial<UserDraft>, actor: string): Promise<User>;
  setStatus(ids: string[], status: "active" | "disabled", actor: string): Promise<void>;
  deleteUsers(ids: string[], actor: string): Promise<void>;
  resendVerification(id: string): Promise<void>;
  sendPasswordReset(id: string, actor: string): Promise<void>;
  exportCsv(params: UserListParams): Promise<string>;
  reset(): Promise<void>;
  listCases<M extends CaseModule>(module: M, params: CaseListParams): Promise<CaseListResult<CaseMap[M]>>;
  getCase<M extends CaseModule>(module: M, id: string): Promise<CaseMap[M] | null>;
  updateCase<M extends CaseModule>(module: M, id: string, patch: Partial<CaseMap[M]>, event: Omit<CaseEvent, "at" | "actor">, actor: string): Promise<CaseMap[M]>;
  queueCounts(): Promise<QueueCounts>;
};

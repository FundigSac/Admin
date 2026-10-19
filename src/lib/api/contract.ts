import type { Activity, ActivityType, SignupMethod, User, UserRole, UserStatus } from "@/data/types";

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

export type UsersApi = {
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
};

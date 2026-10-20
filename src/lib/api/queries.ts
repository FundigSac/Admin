"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from ".";
import type { CaseEvent } from "@/data/types";
import type { ActivityParams, CaseListParams, CaseMap, CaseModule, RangeKey, UserDraft, UserListParams } from "./contract";

// Claves de caché centralizadas: cada filtro que cambia la respuesta va en la clave.
export const keys = {
  users: ["users"] as const,
  list: (p: UserListParams) => ["users", "list", p] as const,
  user: (id: string) => ["users", "detail", id] as const,
  stats: (range: RangeKey) => ["stats", range] as const,
  activity: (p: ActivityParams) => ["activity", p] as const,
};

export function useUserList(params: UserListParams, enabled = true) {
  return useQuery({ queryKey: keys.list(params), queryFn: () => api.listUsers(params), placeholderData: keepPreviousData, enabled });
}

export function useUser(id: string) {
  return useQuery({ queryKey: keys.user(id), queryFn: () => api.getUser(id) });
}

export function useStats(range: RangeKey) {
  return useQuery({ queryKey: keys.stats(range), queryFn: () => api.stats(range), placeholderData: keepPreviousData });
}

export function useActivity(params: ActivityParams) {
  return useQuery({ queryKey: keys.activity(params), queryFn: () => api.listActivity(params), placeholderData: keepPreviousData });
}

/** Tras cualquier cambio se invalidan listas, fichas, métricas y auditoría: todo el panel queda coherente. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: keys.users }), qc.invalidateQueries({ queryKey: ["stats"] }), qc.invalidateQueries({ queryKey: ["activity"] })]);
}

export function useCreateUser() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ draft, actor }: { draft: UserDraft; actor: string }) => api.createUser(draft, actor), onSuccess: invalidate });
}

export function useUpdateUser() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch, actor }: { id: string; patch: Partial<UserDraft>; actor: string }) => api.updateUser(id, patch, actor),
    onSuccess: invalidate,
  });
}

export function useSetStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ ids, status, actor }: { ids: string[]; status: "active" | "disabled"; actor: string }) => api.setStatus(ids, status, actor),
    onSuccess: invalidate,
  });
}

export function useDeleteUsers() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ ids, actor }: { ids: string[]; actor: string }) => api.deleteUsers(ids, actor), onSuccess: invalidate });
}

export function useResendVerification() {
  return useMutation({ mutationFn: (id: string) => api.resendVerification(id) });
}

export function usePasswordReset() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ id, actor }: { id: string; actor: string }) => api.sendPasswordReset(id, actor), onSuccess: invalidate });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.reset(), onSuccess: () => qc.invalidateQueries() });
}

// ───────── Colas de atención (cotizaciones, consultas, reclamaciones y privacidad) ─────────

export function useCaseList<M extends CaseModule>(module: M, params: CaseListParams) {
  return useQuery({ queryKey: ["cases", module, "list", params], queryFn: () => api.listCases(module, params), placeholderData: keepPreviousData });
}

export function useCase<M extends CaseModule>(module: M, id: string) {
  return useQuery({ queryKey: ["cases", module, "detail", id], queryFn: () => api.getCase(module, id) });
}

export function useUpdateCase<M extends CaseModule>(module: M) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch, event, actor }: { id: string; patch: Partial<CaseMap[M]>; event: Omit<CaseEvent, "at" | "actor">; actor: string }) => api.updateCase(module, id, patch, event, actor),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["cases"] }), qc.invalidateQueries({ queryKey: ["queues"] }), qc.invalidateQueries({ queryKey: ["stats"] })]),
  });
}

export function useQueueCounts() {
  return useQuery({ queryKey: ["queues"], queryFn: () => api.queueCounts(), staleTime: 15_000 });
}

/** Personal que puede atender casos (en la demostración, el de prueba; con Backend, las cuentas del personal). */
export function useStaff() {
  return useQuery({ queryKey: ["staff"], queryFn: () => api.listStaff(), staleTime: 60_000 });
}

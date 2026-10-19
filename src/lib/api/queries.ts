"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from ".";
import type { ActivityParams, RangeKey, UserDraft, UserListParams } from "./contract";

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

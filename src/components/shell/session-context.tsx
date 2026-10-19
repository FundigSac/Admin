"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/session";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** Quién usa el panel: firma cada cambio en la auditoría. */
export function useSessionUser() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSessionUser fuera del panel");
  return user;
}

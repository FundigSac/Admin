"use client";

import type { User, UserStatus } from "@/data/types";
import { useT } from "@/lib/prefs";
import { useUsersCopy } from "./users-copy";

/** Estado de una cuenta con marca y texto (el color nunca va solo), en el lenguaje de Cuentas. */
export function AccountStatus({ status }: { status: UserStatus }) {
  const c = useUsersCopy();
  return (
    <span className={`pill pill--${status}`} title={c.statusHint[status]}>
      <span className="pill__dot" aria-hidden="true" />
      {c.status[status]}
    </span>
  );
}

/** Puesto de una cuenta: "Cliente" o los puestos del personal en una frase. */
export function useJobLabel() {
  const t = useT();
  return (u: Pick<User, "kind" | "roles">) => (u.kind === "customer" ? t.roles.customer : u.roles.map((r) => t.roles[r]).join(", "));
}

/** Dato con su rótulo. Sin valor dice "Sin dato" en lugar de dejar un guion que nadie entiende. */
export function Datum({ label, children }: { label: string; children?: React.ReactNode }) {
  const c = useUsersCopy();
  const empty = children === null || children === undefined || children === "" || children === false;
  return (
    <div className="datum">
      <dt>{label}</dt>
      <dd className={empty ? "datum__empty" : undefined}>{empty ? c.missing : children}</dd>
    </div>
  );
}

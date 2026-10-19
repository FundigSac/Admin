"use client";

import { CircleCheck, Clock3, Mail, ShieldBan } from "lucide-react";
import Image from "next/image";
import type { SignupMethod, UserStatus } from "@/data/types";
import { avatarHue, initials } from "@/lib/format";
import { useT } from "@/lib/prefs";

export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return <Image className={className} src="/brand/fundigsac.svg" alt="FUNDIGSAC" width={708} height={159} priority={priority} />;
}

export function Avatar({ name, size }: { name: string; size?: "sm" | "lg" }) {
  return (
    <span className={`avatar${size ? ` avatar--${size}` : ""}`} style={{ "--h": avatarHue(name) } as React.CSSProperties} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

const STATUS_ICON = { active: CircleCheck, pending: Clock3, disabled: ShieldBan } as const;

/** Estado con ícono + texto: el color nunca es la única señal. */
export function StatusBadge({ status }: { status: UserStatus }) {
  const t = useT();
  const Icon = STATUS_ICON[status];
  return (
    <span className={`pill pill--${status}`} title={t.statusHint[status]}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
      {t.status[status]}
    </span>
  );
}

function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

function FacebookMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.8-4.67 4.54-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12Z" />
      <path fill="#fff" d="m16.67 15.47.53-3.47h-3.33V9.76c0-.95.47-1.88 1.96-1.88h1.51V4.93s-1.37-.24-2.68-.24c-2.74 0-4.54 1.66-4.54 4.67V12H7.08v3.47h3.04v8.38a12.1 12.1 0 0 0 3.75 0v-8.38h2.8Z" />
    </svg>
  );
}

export function MethodIcon({ method, size = 16 }: { method: SignupMethod; size?: number }) {
  if (method === "google") return <GoogleMark size={size} />;
  if (method === "facebook") return <FacebookMark size={size} />;
  return <Mail size={size} strokeWidth={2} aria-hidden="true" style={{ color: "var(--text-3)" }} />;
}

export function MethodChip({ method }: { method: SignupMethod }) {
  const t = useT();
  return (
    <span className="chip">
      <MethodIcon method={method} />
      {t.method[method]}
    </span>
  );
}

export function Skeleton({ w, h = 14 }: { w?: number | string; h?: number }) {
  return <span className="skeleton" style={{ width: w ?? "100%", height: h }} aria-hidden="true" />;
}

export function TitleRow({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="title-row">
      <div>
        <h1 className="title-row__title">{title}</h1>
        {sub && <p className="title-row__sub">{sub}</p>}
      </div>
      {actions && <div className="title-row__actions">{actions}</div>}
    </header>
  );
}

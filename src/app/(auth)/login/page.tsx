import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <AuthShell>
      {/* useSearchParams (lee ?next=) necesita un límite de Suspense. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

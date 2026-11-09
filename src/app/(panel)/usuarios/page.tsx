import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountsTitle, UsersView } from "./users-view";

export const metadata: Metadata = { title: "Cuentas" };

export default function UsersPage() {
  // La lista lee los filtros de la dirección (useSearchParams) y espera al cliente; el título y la frase de propósito
  // salen en el HTML inicial para que lo primero que se pinte ya diga qué es la pantalla.
  return (
    <Suspense fallback={<AccountsTitle />}>
      <UsersView />
    </Suspense>
  );
}

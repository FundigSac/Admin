import type { Metadata } from "next";
import { Suspense } from "react";
import { ClaimsList } from "./claims-list";

export const metadata: Metadata = { title: "Libro de Reclamaciones" };

export default function ClaimsPage() {
  return (
    <Suspense>
      <ClaimsList />
    </Suspense>
  );
}

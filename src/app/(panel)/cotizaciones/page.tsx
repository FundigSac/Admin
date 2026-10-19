import type { Metadata } from "next";
import { Suspense } from "react";
import { QuotesList } from "./quotes-list";

export const metadata: Metadata = { title: "Cotizaciones" };

export default function Page() {
  return (
    <Suspense>
      <QuotesList />
    </Suspense>
  );
}

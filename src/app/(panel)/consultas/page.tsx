import type { Metadata } from "next";
import { Suspense } from "react";
import { InquiriesList } from "./inquiries-list";

export const metadata: Metadata = { title: "Consultas" };

export default function Page() {
  return (
    <Suspense>
      <InquiriesList />
    </Suspense>
  );
}

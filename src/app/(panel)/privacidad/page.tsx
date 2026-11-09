import type { Metadata } from "next";
import { Suspense } from "react";
import { PrivacyList } from "./privacy-list";

export const metadata: Metadata = { title: "Datos personales" };

export default function Page() {
  return (
    <Suspense>
      <PrivacyList />
    </Suspense>
  );
}

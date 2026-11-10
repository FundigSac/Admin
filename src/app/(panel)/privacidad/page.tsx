import type { Metadata } from "next";
import { Suspense } from "react";
import { PrivacyList } from "./privacy-list";

export const metadata: Metadata = { title: "Privacidad" };

export default function Page() {
  return (
    <Suspense>
      <PrivacyList />
    </Suspense>
  );
}

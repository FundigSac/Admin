import type { Metadata } from "next";
import { Suspense } from "react";
import { UsersView } from "./users-view";

export const metadata: Metadata = { title: "Usuarios" };

export default function UsersPage() {
  return (
    <Suspense>
      <UsersView />
    </Suspense>
  );
}

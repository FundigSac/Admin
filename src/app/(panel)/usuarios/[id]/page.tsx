import type { Metadata } from "next";
import { UserDetail } from "./user-detail";

export const metadata: Metadata = { title: "Ficha de usuario" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  return <UserDetail id={(await params).id} />;
}

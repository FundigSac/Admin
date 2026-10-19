import type { Metadata } from "next";
import { ClaimDetail } from "./claim-detail";

export const metadata: Metadata = { title: "Hoja de reclamación" };

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  return <ClaimDetail id={(await params).id} />;
}

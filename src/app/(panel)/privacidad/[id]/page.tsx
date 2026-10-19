import type { Metadata } from "next";
import { PrivacyDetail } from "./privacy-detail";

export const metadata: Metadata = { title: "Solicitud de eliminación" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PrivacyDetail id={(await params).id} />;
}

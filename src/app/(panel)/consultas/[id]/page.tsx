import type { Metadata } from "next";
import { InquiryDetail } from "./inquiry-detail";

export const metadata: Metadata = { title: "Consulta" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <InquiryDetail id={(await params).id} />;
}

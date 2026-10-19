import type { Metadata } from "next";
import { QuoteDetail } from "./quote-detail";

export const metadata: Metadata = { title: "Cotización" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <QuoteDetail id={(await params).id} />;
}

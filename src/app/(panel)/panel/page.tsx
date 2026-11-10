import type { Metadata } from "next";
import { OverviewView } from "./overview-view";

export const metadata: Metadata = { title: "Resumen" };

export default function OverviewPage() {
  return <OverviewView />;
}

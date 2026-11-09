import type { Metadata } from "next";
import { ActivityView } from "./activity-view";

export const metadata: Metadata = { title: "Historial de cambios" };

export default function ActivityPage() {
  return <ActivityView />;
}

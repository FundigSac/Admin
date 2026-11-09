import type { Metadata } from "next";
import { RolesView } from "./roles-view";

export const metadata: Metadata = { title: "Qué puede hacer cada persona" };

export default function RolesPage() {
  return <RolesView />;
}

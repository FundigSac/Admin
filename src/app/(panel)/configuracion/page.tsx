import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsTitle, SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  // La hoja lee ?tab= para llevar a su bloque; el título sale en el HTML inicial mientras tanto.
  return (
    <Suspense fallback={<SettingsTitle />}>
      <SettingsView />
    </Suspense>
  );
}

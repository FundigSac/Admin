import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { parseSession, SESSION_COOKIE } from "@/lib/session";
import "@/styles/screens.css";
// Estilos de colas y fichas: compartidos por todas las pantallas del panel (tablas, notas legales, barras de filtros).
import "@/components/cases/cases.css";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // El proxy ya redirige sin sesión; esto cubre una cookie alterada o ilegible.
  const user = parseSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login");
  return <AppShell user={user}>{children}</AppShell>;
}

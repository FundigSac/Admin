import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolvePermissions } from "@/components/shell/access";
import { AppShell } from "@/components/shell/app-shell";
import { BACKEND_MODE } from "@/lib/backend-mode";
import { readPanelUser } from "@/lib/server/session";
import { parseSession, SESSION_COOKIE, type SessionUser } from "@/lib/session";
import "@/styles/screens.css";
// Estilos de colas y fichas: compartidos por todas las pantallas del panel (tablas, notas legales, barras de filtros).
import "@/components/cases/cases.css";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // El proxy ya redirige sin sesión; esto cubre una cookie alterada, ilegible o vencida.
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  let user: SessionUser | null;
  // El menú muestra solo las secciones que el rol puede usar; los permisos reales los aplica el Backend.
  let permissions: string[] | null = null;
  if (BACKEND_MODE) {
    const panel = await readPanelUser(raw);
    user = panel ? { id: panel.id, name: panel.name, email: panel.email, roles: panel.roles } : null;
    if (panel) permissions = resolvePermissions(panel.roles, panel.permissions);
  } else {
    user = parseSession(raw);
    permissions = user ? resolvePermissions(user.roles) : null;
  }
  if (!user) redirect("/login");
  return (
    <AppShell user={user} permissions={permissions}>
      {children}
    </AppShell>
  );
}

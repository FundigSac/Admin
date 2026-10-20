import { NextResponse, type NextRequest } from "next/server";
import { STAFF } from "@/data/demo-account";
import { BACKEND_MODE } from "@/lib/backend-mode";
import { readPanelUser } from "@/lib/server/session";
import { parseSession, SESSION_COOKIE } from "@/lib/session";

// Chequeo de sesión antes de servir el panel: sin cookie no se entra y con cookie no se vuelve al login. Con Backend
// la cookie es httpOnly y está firmada (se verifica la firma); en la demostración es la cookie de diseño. La
// autorización real la hace el Backend en cada solicitud.
const PUBLIC = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Solo en desarrollo y en la demostración: ?__demo abre una sesión de diseño para que el inspector y las capturas
  // automáticas lleguen al panel. Con Backend o en producción esta rama no existe.
  if (!BACKEND_MODE && process.env.NODE_ENV === "development" && request.nextUrl.searchParams.has("__demo")) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("__demo");
    const res = NextResponse.redirect(clean);
    res.cookies.set(SESSION_COOKIE, JSON.stringify({ name: STAFF[0].name, email: STAFF[0].email }), { path: "/", sameSite: "strict" });
    return res;
  }
  // Una cookie ilegible o con firma inválida cuenta como sin sesión (si no, el login y el panel se redirigirían entre sí).
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = BACKEND_MODE ? (await readPanelUser(raw)) !== null : parseSession(raw) !== null;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (signedIn && (isPublic || pathname === "/")) return NextResponse.redirect(new URL("/panel", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/|brand/|media/|favicon.ico|icon.svg|robots.txt).*)"],
};

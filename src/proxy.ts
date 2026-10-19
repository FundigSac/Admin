import { NextResponse, type NextRequest } from "next/server";
import { STAFF } from "@/data/demo-account";
import { parseSession, SESSION_COOKIE } from "@/lib/session";

// Chequeo optimista de sesión: sin cookie no se entra al panel y con cookie no se vuelve al login.
// La autorización real la hará el Backend en cada solicitud cuando esté conectado.
const PUBLIC = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Solo en desarrollo: ?__demo abre una sesión de demostración para que el inspector de diseño y las capturas
  // automáticas lleguen al panel. En producción esta rama no existe.
  if (process.env.NODE_ENV === "development" && request.nextUrl.searchParams.has("__demo")) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("__demo");
    const res = NextResponse.redirect(clean);
    res.cookies.set(SESSION_COOKIE, JSON.stringify({ name: STAFF[0].name, email: STAFF[0].email }), { path: "/", sameSite: "strict" });
    return res;
  }
  // Una cookie ilegible cuenta como sin sesión (si no, el login y el panel se redirigirían entre sí).
  const signedIn = parseSession(request.cookies.get(SESSION_COOKIE)?.value) !== null;
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

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Chequeo optimista de sesión: sin cookie no se entra al panel y con cookie no se vuelve al login.
// La autorización real la hará el Backend en cada solicitud cuando esté conectado.
const PUBLIC = ["/login", "/recuperar"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
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

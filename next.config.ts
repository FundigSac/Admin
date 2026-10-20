import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Política de contenido sin terceros: fuentes, imágenes y scripts salen del propio dominio (next/font aloja la
 * tipografía). 'unsafe-inline' en script-src lo exigen los scripts de hidratación de Next; 'unsafe-eval' solo en
 * desarrollo (React Refresh). Mejora futura: nonces por petición desde el proxy.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Panel interno: nunca en buscadores, aunque alguien comparta el enlace.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Permite varios `next dev` en paralelo sobre la misma carpeta (sesiones de trabajo o QA): NEXT_DIST_DIR=.next-xyz
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  // Sin metadata en streaming: como el panel es dinámico (lee la cookie de sesión), Next mandaba el <title> al final
  // del cuerpo y a veces aún no existía cuando lo leía un lector de pantalla (axe: document-title). Los títulos son
  // estáticos, así que esperar por ellos no cuesta nada.
  htmlLimitedBots: /.*/,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

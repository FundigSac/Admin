import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import { Providers } from "@/components/providers";
import { LANG_COOKIE, THEME_SCRIPT, type Lang } from "@/lib/prefs-shared";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";
import "@/styles/motion.css";

// Dirección "registro industrial": IBM Plex Sans para leer y trabajar (nació en ingeniería y lee bien a 13-14 px)
// y Plex Mono, una sola variante, solo para lo que se copia o se compara carácter a carácter: códigos de caso, RUC/DNI y horas.
// Plex Sans es variable: sin fijar pesos se sirve un único archivo para 400-600 (con pesos fijos eran tres descargas
// compitiendo con el LCP). La mono no se precarga: aparece en tablas y fichas, nunca en el primer texto que se pinta.
const plex = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-plex-mono", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Gestor de usuarios | FUNDIGSAC", template: "%s | FUNDIGSAC Admin" },
  description: "Panel de administración de cuentas registradas en el sitio web de FUNDIGSAC.",
  applicationName: "FUNDIGSAC Admin",
  // Panel interno: nunca debe aparecer en buscadores.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef3f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0d" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang: Lang = (await cookies()).get(LANG_COOKIE)?.value === "en" ? "en" : "es";
  return (
    <html lang={lang === "es" ? "es-PE" : "en"} className={`${plex.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body>
        {/* Aplica el tema guardado antes de pintar, para que no parpadee. */}
        <Script id="theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <Providers initialLang={lang}>{children}</Providers>
      </body>
    </html>
  );
}

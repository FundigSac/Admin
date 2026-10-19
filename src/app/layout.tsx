import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import { Providers } from "@/components/providers";
import { LANG_COOKIE, THEME_SCRIPT, type Lang } from "@/lib/prefs-shared";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";
import "@/styles/motion.css";

// Una sola familia: Plus Jakarta Sans, la tipografía de títulos del sitio de FUNDIGSAC.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jakarta", display: "swap" });

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
    <html lang={lang === "es" ? "es-PE" : "en"} className={jakarta.variable} suppressHydrationWarning>
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

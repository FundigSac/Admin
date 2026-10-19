"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/bits";
import { useT } from "@/lib/prefs";

export default function NotFound() {
  const t = useT();
  return (
    <main className="not-found">
      <Logo className="not-found__logo" />
      <p className="not-found__code">404</p>
      <h1>{t.notFound.title}</h1>
      <p>{t.notFound.text}</p>
      <Link href="/panel" className="btn btn--primary">
        {t.notFound.cta}
      </Link>
    </main>
  );
}

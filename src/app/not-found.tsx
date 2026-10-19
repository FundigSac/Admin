"use client";

import { Compass } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/bits";
import { useT } from "@/lib/prefs";

export default function NotFound() {
  const t = useT();
  return (
    <main className="not-found">
      <Logo className="not-found__logo" />
      <div className="empty">
        <span className="empty__icon" aria-hidden="true">
          <Compass size={26} />
        </span>
        <p className="not-found__code">404</p>
        <h1 className="empty__title">{t.notFound.title}</h1>
        <p className="empty__text">{t.notFound.text}</p>
        <Link href="/panel" className="btn btn--primary" style={{ marginTop: 12 }}>
          {t.notFound.cta}
        </Link>
      </div>
    </main>
  );
}

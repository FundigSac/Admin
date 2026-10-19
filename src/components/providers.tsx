"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { PrefsProvider, type Lang } from "@/lib/prefs";
import { ToastProvider } from "./ui/toast";

export function Providers({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  // Un QueryClient por pestaña; los datos se consideran frescos 30 s para no repetir pedidos al navegar.
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } }));
  return (
    <QueryClientProvider client={client}>
      <PrefsProvider initialLang={initialLang}>
        <ToastProvider>{children}</ToastProvider>
      </PrefsProvider>
    </QueryClientProvider>
  );
}

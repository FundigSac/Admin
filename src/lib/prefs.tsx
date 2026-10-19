"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { en } from "./i18n/en";
import { es, type Copy } from "./i18n/es";

export type Lang = "es" | "en";
export type Theme = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";

export const LANG_COOKIE = "fa-lang";
const THEME_KEY = "fa-theme";
const DENSITY_KEY = "fa-density";
const PAGE_SIZE_KEY = "fa-page-size";
export const PAGE_SIZES = [10, 20, 50] as const;

const COPY: Record<Lang, Copy> = { es, en };

/** Se ejecuta antes de pintar (en <head>) para que no parpadee el tema equivocado. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";var c=localStorage.getItem("${DENSITY_KEY}");if(c)document.documentElement.dataset.density=c;}catch(e){document.documentElement.dataset.theme="light";}})();`;

// Preferencias en localStorage leídas con useSyncExternalStore: el servidor usa el valor por defecto y el cliente
// el guardado, sin desajustes de hidratación ni efectos que copien estado.
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readLocal(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const fallback = new Map<string, string>();

function writeLocal(key: string, value: string) {
  fallback.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: la preferencia vive en memoria mientras dure la pestaña.
  }
  listeners.forEach((cb) => cb());
}

function useLocal(key: string, initial: string) {
  return useSyncExternalStore(
    subscribe,
    () => readLocal(key) ?? fallback.get(key) ?? initial,
    () => initial,
  );
}

const subscribeScheme = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

type Prefs = {
  lang: Lang;
  t: Copy;
  setLang: (lang: Lang) => void;
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  density: Density;
  setDensity: (density: Density) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
};

const PrefsContext = createContext<Prefs | null>(null);

export function PrefsProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const theme = useLocal(THEME_KEY, "system") as Theme;
  const density = useLocal(DENSITY_KEY, "comfortable") as Density;
  const savedSize = Number(useLocal(PAGE_SIZE_KEY, "10"));
  const pageSize = (PAGE_SIZES as readonly number[]).includes(savedSize) ? savedSize : 10;
  const systemDark = useSyncExternalStore(
    subscribeScheme,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.documentElement.lang = next === "es" ? "es-PE" : "en";
    document.cookie = `${LANG_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const setTheme = useCallback((next: Theme) => writeLocal(THEME_KEY, next), []);
  const setDensity = useCallback((next: Density) => writeLocal(DENSITY_KEY, next), []);
  const setPageSize = useCallback((next: number) => writeLocal(PAGE_SIZE_KEY, String(next)), []);

  const value = useMemo<Prefs>(
    () => ({ lang, t: COPY[lang], setLang, theme, resolvedTheme, setTheme, density, setDensity, pageSize, setPageSize }),
    [lang, setLang, theme, resolvedTheme, setTheme, density, setDensity, pageSize, setPageSize],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs fuera de PrefsProvider");
  return ctx;
}

export function useT() {
  return usePrefs().t;
}

/** Ajuste simple guardado en este navegador (por ejemplo, los avisos por correo mientras no haya Backend). */
export function useStoredValue(key: string, initial: string): [string, (value: string) => void] {
  const value = useLocal(key, initial);
  const set = useCallback((next: string) => writeLocal(key, next), [key]);
  return [value, set];
}

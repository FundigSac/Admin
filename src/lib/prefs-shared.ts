// Constantes de preferencias compartidas por el servidor (layout raíz) y el cliente (PrefsProvider).
// Viven fuera de prefs.tsx porque un módulo "use client" no entrega valores al servidor, solo referencias.

export type Lang = "es" | "en";

export const LANG_COOKIE = "fa-lang";
export const THEME_KEY = "fa-theme";
export const DENSITY_KEY = "fa-density";

/** Se ejecuta antes de pintar para aplicar el tema y la densidad guardados, sin parpadeo. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";var c=localStorage.getItem("${DENSITY_KEY}");if(c)document.documentElement.dataset.density=c;}catch(e){document.documentElement.dataset.theme="light";}})();`;

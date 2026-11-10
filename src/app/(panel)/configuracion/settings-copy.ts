import type { Lang } from "@/lib/prefs";
import { usePrefs } from "@/lib/prefs";

// Textos de Ajustes (brief de diseño §6.1 y §6.3). Mis preferencias para todo el personal; Avisos y Datos del panel
// solo para administración. Los avisos describen los correos que de verdad envía el Backend
// (com.fundigsac.notification.application.NotificationListeners); no hay interruptores que no hagan nada.

const n = (v: number) => v.toLocaleString("es-PE");

const es = {
  title: "Ajustes",
  lead: "Elige el idioma del panel, el tema claro u oscuro y cuántas filas ver en Cuentas. Lo que cambies se aplica al pulsar Guardar cambios, abajo.",
  prefs: {
    title: "Mis preferencias",
    desc: "Solo cambian el panel en este navegador. No afectan a nadie más.",
    language: "Idioma",
    languageHint: "Cambia los textos de todo el panel.",
    theme: "Tema",
    themeHint: "Con «Igual que mi equipo», el panel sigue el modo claro u oscuro de tu computadora o celular.",
    themeOpt: { light: "Claro", dark: "Oscuro", system: "Igual que mi equipo" },
    size: "Filas por página en Cuentas",
    sizeHint: "Con más filas ves más cuentas sin cambiar de página.",
  },
  account: {
    title: "Tu cuenta",
    desc: "Así te ve el resto del equipo en el Historial de cambios.",
    name: "Nombre",
    email: "Correo",
    job: "Puesto",
    noJob: "Sin puesto asignado",
    jobLink: "Ver qué permite cada puesto",
    access: "Cómo entras",
    accessText: "Pides un código de 6 números que llega a tu correo. Vence a los 10 minutos y sirve una sola vez. No hay contraseña que recordar ni que te puedan robar.",
    recent: "Lo último que hiciste",
    recentEmpty: "Todavía no hiciste cambios en el panel.",
  },
  notices: {
    title: "Avisos por correo",
    desc: "El sistema envía estos correos solo, en el momento en que pasa cada cosa. Nadie tiene que mandarlos a mano.",
    demo: "Esta es una demostración: aquí no se envía ningún correo.",
    when: "Cuando",
    what: "Qué correo sale y a quién",
    rows: [
      { when: "Llega un pedido de cotización", what: "El cliente recibe una confirmación con su folio. El buzón de Ventas recibe el aviso para atenderlo." },
      { when: "Llega una consulta", what: "La persona recibe una confirmación con su folio. El buzón de Ventas recibe el aviso." },
      { when: "Llega una hoja del Libro de Reclamaciones", what: "El cliente recibe una constancia con la fecha límite de respuesta. El buzón de Atención Legal recibe el aviso con esa fecha: hay 15 días hábiles para responder." },
      { when: "Llega un pedido de datos personales", what: "La persona recibe una constancia con su folio. El buzón de Privacidad recibe el aviso: hay 10 días hábiles para atenderlo." },
      { when: "Respondes desde el panel", what: "La respuesta a una consulta, un reclamo o un pedido de datos personales le llega por correo a quien la pidió. Si el reclamo pidió respuesta por carta, el aviso va al buzón de Atención Legal." },
      { when: "Un cliente se registra en el sitio", what: "Recibe el enlace para confirmar su correo. Si lo pierde, puedes reenviarlo desde su cuenta." },
      { when: "Invitas a alguien del equipo", what: "Recibe el enlace al panel. Para entrar pide un código que le llega al correo." },
    ],
  },
  data: {
    title: "Datos del panel",
    desc: "De dónde salen las cuentas y las solicitudes que ves.",
    liveTag: "Datos reales",
    demoTag: "Demostración",
    sourceLive: "Del sistema de FUNDIGSAC: son clientes y solicitudes reales.",
    sourceDemo: "De una demostración guardada en este navegador. Nada de lo que hagas aquí llega a clientes reales.",
    counts: "Lo que hay guardado hoy",
    modules: { users: "Cuentas", quotes: "Cotizaciones", inquiries: "Consultas", claims: "Reclamos", privacy: "Pedidos de datos personales" },
    reset: "Volver a los datos de demostración",
    resetting: "Restableciendo…",
    resetText: "Borra lo que cambiaste en esta demostración y deja las cuentas y solicitudes de ejemplo como al principio.",
    resetTitle: "¿Volver a los datos de demostración?",
    resetOk: "Sí, restablecer",
    resetDone: "Listo. La demostración volvió a sus datos de ejemplo.",
  },
  bar: {
    label: "Guardar preferencias",
    dirty: "Tienes cambios sin guardar en Mis preferencias.",
    clean: "No hay cambios por guardar.",
    discard: "Descartar",
    save: "Guardar cambios",
    saved: "Preferencias guardadas.",
  },
  count: (v: number) => n(v),
};

export type SettingsCopy = typeof es;

const m = (v: number) => v.toLocaleString("en-US");

const en: SettingsCopy = {
  title: "Settings",
  lead: "Choose the panel language, light or dark theme and how many rows to see in Accounts. Your changes apply when you press Save changes, below.",
  prefs: {
    title: "My preferences",
    desc: "They only change the panel in this browser. Nobody else is affected.",
    language: "Language",
    languageHint: "Changes the text across the whole panel.",
    theme: "Theme",
    themeHint: "With \"Same as my device\", the panel follows the light or dark mode of your computer or phone.",
    themeOpt: { light: "Light", dark: "Dark", system: "Same as my device" },
    size: "Rows per page in Accounts",
    sizeHint: "More rows let you see more accounts without changing page.",
  },
  account: {
    title: "Your account",
    desc: "This is how the rest of the team sees you in the Change history.",
    name: "Name",
    email: "Email",
    job: "Job",
    noJob: "No job assigned",
    jobLink: "See what each job allows",
    access: "How you sign in",
    accessText: "You request a 6-digit code that arrives in your email. It expires after 10 minutes and works once. There is no password to remember or to have stolen.",
    recent: "What you did last",
    recentEmpty: "You have not made any changes in the panel yet.",
  },
  notices: {
    title: "Email notices",
    desc: "The system sends these emails on its own, the moment each thing happens. Nobody has to send them by hand.",
    demo: "This is a demo: no emails are sent from here.",
    when: "When",
    what: "Which email goes out and to whom",
    rows: [
      { when: "A quote request comes in", what: "The customer gets a confirmation with their reference. The Sales inbox gets the notice to handle it." },
      { when: "An inquiry comes in", what: "The person gets a confirmation with their reference. The Sales inbox gets the notice." },
      { when: "A Complaints Book entry comes in", what: "The customer gets a receipt with the reply deadline. The Legal inbox gets the notice with that date: there are 15 business days to reply." },
      { when: "A personal data request comes in", what: "The person gets a receipt with their reference. The Privacy inbox gets the notice: there are 10 business days to handle it." },
      { when: "You reply from the panel", what: "The reply to an inquiry, complaint or personal data request reaches the person by email. If the complaint asked for a reply by letter, the notice goes to the Legal inbox." },
      { when: "A customer signs up on the website", what: "They get the link to confirm their email. If they lose it, you can resend it from their account." },
      { when: "You invite someone from the team", what: "They get the link to the panel. To sign in they request a code sent to their email." },
    ],
  },
  data: {
    title: "Panel data",
    desc: "Where the accounts and requests you see come from.",
    liveTag: "Real data",
    demoTag: "Demo",
    sourceLive: "From the FUNDIGSAC system: these are real customers and requests.",
    sourceDemo: "From a demo stored in this browser. Nothing you do here reaches real customers.",
    counts: "What is stored today",
    modules: { users: "Accounts", quotes: "Quotes", inquiries: "Inquiries", claims: "Complaints", privacy: "Personal data requests" },
    reset: "Go back to the demo data",
    resetting: "Resetting…",
    resetText: "Erases what you changed in this demo and puts the sample accounts and requests back as they were.",
    resetTitle: "Go back to the demo data?",
    resetOk: "Yes, reset",
    resetDone: "Done. The demo is back to its sample data.",
  },
  bar: {
    label: "Save preferences",
    dirty: "You have unsaved changes in My preferences.",
    clean: "No changes to save.",
    discard: "Discard",
    save: "Save changes",
    saved: "Preferences saved.",
  },
  count: (v: number) => m(v),
};

const COPY = { es, en };

export function settingsCopy(lang: Lang): SettingsCopy {
  return COPY[lang];
}

export function useSettingsCopy(): SettingsCopy {
  return COPY[usePrefs().lang];
}

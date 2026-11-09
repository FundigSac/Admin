import { usePrefs } from "@/lib/prefs";
import type { PageKey, SectionKey } from "./nav";

// Textos del marco del panel (menú, barra superior, búsqueda y guía). Viven junto al marco para que el menú nuevo
// no dependa de los textos de cada pantalla. Frases cortas, en segunda persona y sin claves técnicas.

const es = {
  app: "Panel FUNDIGSAC",
  homeLink: "Ir a Inicio",
  nav: {
    label: "Secciones del panel",
    home: "Inicio",
    requests: "Solicitudes",
    accounts: "Cuentas",
    settings: "Ajustes",
  } satisfies Record<SectionKey | "label", string>,
  pages: {
    home: "Inicio",
    quotes: "Cotizaciones",
    inquiries: "Consultas",
    claims: "Reclamos",
    privacy: "Datos personales",
    accounts: "Cuentas",
    preferences: "Mis preferencias",
    roles: "Qué puede hacer cada persona",
    activity: "Historial de cambios",
  } satisfies Record<PageKey, string>,
  subnav: { requests: "Tipos de solicitud", settings: "Partes de Ajustes" },
  pending: (n: number) => (n === 1 ? "1 por atender" : `${n} por atender`),
  search: "Buscar por nombre, correo o código",
  help: "Ayuda",
  account: (name: string) => `Tu cuenta: ${name}`,
  preferences: "Mis preferencias",
  logout: "Cerrar sesión",
  palette: {
    placeholder: "Nombre, correo o código de una solicitud",
    pages: "Secciones",
    requests: "Solicitudes",
    people: "Personas",
    empty: "No hay resultados. Prueba con el código completo o con el correo.",
    hint: "Usa las flechas para moverte, Enter para abrir y Esc para cerrar. Ctrl K abre esta búsqueda desde cualquier pantalla.",
  },
  guide: {
    sections: {
      home: "Lo que tienes que atender hoy. Primero aparece lo que vence antes.",
      requests:
        "Todo lo que llega desde el sitio web: pedidos de cotización, mensajes de contacto, hojas del Libro de Reclamaciones y pedidos para borrar datos personales. Un reclamo se responde en 15 días hábiles y un pedido de datos personales en 10.",
      accounts: "Los clientes que se registraron en el sitio y las personas de FUNDIGSAC que usan este panel.",
      settings: "Tu idioma, el tema claro u oscuro y los avisos por correo. Si administras el panel, aquí ves también qué puede hacer cada persona y el historial de cambios.",
    } satisfies Record<SectionKey, string>,
    tips: [
      "Escribe en Buscar el nombre o el correo de una persona, o el código de una solicitud, para ir directo a ella.",
      "Ctrl K abre la búsqueda desde cualquier pantalla.",
      "Los días hábiles no cuentan sábados, domingos ni feriados.",
    ],
  },
};

export type ShellCopy = typeof es;

const en: ShellCopy = {
  app: "FUNDIGSAC panel",
  homeLink: "Go to Home",
  nav: {
    label: "Panel sections",
    home: "Home",
    requests: "Requests",
    accounts: "Accounts",
    settings: "Settings",
  },
  pages: {
    home: "Home",
    quotes: "Quotes",
    inquiries: "Inquiries",
    claims: "Complaints",
    privacy: "Personal data",
    accounts: "Accounts",
    preferences: "My preferences",
    roles: "Who can do what",
    activity: "Change history",
  },
  subnav: { requests: "Request types", settings: "Settings pages" },
  pending: (n: number) => (n === 1 ? "1 waiting" : `${n} waiting`),
  search: "Search by name, email or code",
  help: "Help",
  account: (name: string) => `Your account: ${name}`,
  preferences: "My preferences",
  logout: "Sign out",
  palette: {
    placeholder: "Name, email or request code",
    pages: "Sections",
    requests: "Requests",
    people: "People",
    empty: "No results. Try the full code or the email address.",
    hint: "Use the arrow keys to move, Enter to open and Esc to close. Ctrl K opens this search from any screen.",
  },
  guide: {
    sections: {
      home: "What you need to handle today, with the nearest deadline first.",
      requests:
        "Everything that comes in from the website: quote requests, contact messages, Complaints Book entries and requests to delete personal data. A complaint must be answered within 15 business days and a personal data request within 10.",
      accounts: "Customers who signed up on the website and the FUNDIGSAC staff who use this panel.",
      settings: "Your language, light or dark theme and email notices. If you run the panel, you also see who can do what and the change history.",
    },
    tips: [
      "Type a person's name or email, or a request code, in Search to go straight to it.",
      "Ctrl K opens the search from any screen.",
      "Business days do not count Saturdays, Sundays or public holidays.",
    ],
  },
};

const COPY = { es, en };

export function useShellCopy(): ShellCopy {
  return COPY[usePrefs().lang];
}

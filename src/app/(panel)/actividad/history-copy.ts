import type { ReactNode } from "react";
import type { ActivityType } from "@/data/types";
import { usePrefs } from "@/lib/prefs";

// Textos del Historial de cambios. Cada movimiento se cuenta como una frase con nombres propios: quién lo hizo, a
// qué cuenta y qué cambió. Las frases reciben los nombres ya armados (enlace a la cuenta, responsable resaltado).

type Parts = { user: ReactNode; actor: ReactNode | null; method: string; roles: string; detail: ReactNode };

const n = (v: number) => v.toLocaleString("es-PE");
const nEn = (v: number) => v.toLocaleString("en-US");

const es = {
  title: "Historial de cambios",
  lead: "Aquí queda anotado lo que pasa con las cuentas: quién se registró, quién entró y qué cambió el personal, con la hora exacta. Sirve para saber quién hizo qué y cuándo.",
  search: "Buscar por persona",
  searchPh: "Nombre de la cuenta o de quien hizo el cambio",
  type: "Qué pasó",
  all: "Todo",
  count: (v: number) => (v === 1 ? "1 movimiento" : `${n(v)} movimientos`),
  dayCount: (v: number) => (v === 1 ? "1 movimiento" : `${n(v)} movimientos`),
  today: "Hoy",
  yesterday: "Ayer",
  more: "Ver más movimientos",
  loadingMore: "Cargando…",
  staff: "Cambio del personal",
  emptyTitle: "No hay movimientos con esta búsqueda.",
  emptyText: "Prueba con otro nombre o elige «Todo» en «Qué pasó».",
  clear: "Quitar filtros",
  loadError: "No pudimos cargar el historial. Revisa la conexión y vuelve a intentarlo.",
  retry: "Volver a intentar",
  types: {
    signup: "Cuentas creadas",
    login: "Inicios de sesión",
    verify: "Correos confirmados",
    quote: "Cotizaciones enviadas",
    password: "Contraseñas",
    invite: "Invitaciones al personal",
    roles: "Cambios de puesto",
    update: "Datos editados",
    disable: "Cuentas bloqueadas",
    enable: "Cuentas reactivadas",
    delete: "Cuentas eliminadas",
  } satisfies Record<ActivityType, string>,
  tag: {
    signup: "Registro",
    login: "Ingreso",
    verify: "Correo confirmado",
    quote: "Cotización",
    password: "Contraseña",
    invite: "Invitación",
    roles: "Puesto",
    update: "Edición",
    disable: "Bloqueo",
    enable: "Reactivación",
    delete: "Eliminación",
  } satisfies Record<ActivityType, string>,
  method: { email: "su correo", google: "Google", facebook: "Facebook" } as Record<string, string>,
  sentence: (type: ActivityType, p: Parts): ReactNode[] => {
    switch (type) {
      case "signup":
        return p.actor ? [p.actor, " creó la cuenta de ", p.user] : [p.user, " se registró con ", p.method];
      case "login":
        return [p.user, " inició sesión"];
      case "verify":
        return [p.user, " confirmó su correo"];
      case "quote":
        return p.detail ? [p.user, " envió la cotización ", p.detail] : [p.user, " envió una cotización"];
      case "password":
        return p.actor ? [p.actor, " le envió a ", p.user, " un enlace para cambiar la contraseña"] : [p.user, " cambió su contraseña"];
      case "disable":
        return [p.actor ?? "El sistema", " bloqueó la cuenta de ", p.user];
      case "enable":
        return [p.actor ?? "El sistema", " reactivó la cuenta de ", p.user];
      case "roles":
        return [p.actor ?? "El sistema", " cambió el puesto de ", p.user, " a ", p.roles];
      case "update":
        return [p.actor ?? "El sistema", " editó los datos de ", p.user];
      case "delete":
        return [p.actor ?? "El sistema", " eliminó la cuenta de ", p.user];
      case "invite":
        return [p.actor ?? "El sistema", " invitó a ", p.user, " como ", p.roles];
    }
  },
};

export type HistoryCopy = typeof es;

const en: HistoryCopy = {
  title: "Change history",
  lead: "Everything that happens to the accounts is written down here: who signed up, who signed in and what the staff changed, with the exact time. Use it to find out who did what and when.",
  search: "Search by person",
  searchPh: "Account name or the person who made the change",
  type: "What happened",
  all: "Everything",
  count: (v: number) => (v === 1 ? "1 entry" : `${nEn(v)} entries`),
  dayCount: (v: number) => (v === 1 ? "1 entry" : `${nEn(v)} entries`),
  today: "Today",
  yesterday: "Yesterday",
  more: "Show more entries",
  loadingMore: "Loading…",
  staff: "Staff change",
  emptyTitle: "No entries match this search.",
  emptyText: "Try another name or pick “Everything” under “What happened”.",
  clear: "Clear filters",
  loadError: "We could not load the history. Check the connection and try again.",
  retry: "Try again",
  types: {
    signup: "Accounts created",
    login: "Sign-ins",
    verify: "Emails confirmed",
    quote: "Quotes sent",
    password: "Passwords",
    invite: "Staff invitations",
    roles: "Position changes",
    update: "Details edited",
    disable: "Accounts blocked",
    enable: "Accounts reactivated",
    delete: "Accounts deleted",
  },
  tag: {
    signup: "Sign-up",
    login: "Sign-in",
    verify: "Email confirmed",
    quote: "Quote",
    password: "Password",
    invite: "Invitation",
    roles: "Position",
    update: "Edit",
    disable: "Block",
    enable: "Reactivation",
    delete: "Deletion",
  },
  method: { email: "their email", google: "Google", facebook: "Facebook" },
  sentence: (type: ActivityType, p: Parts): ReactNode[] => {
    switch (type) {
      case "signup":
        return p.actor ? [p.actor, " created the account for ", p.user] : [p.user, " signed up with ", p.method];
      case "login":
        return [p.user, " signed in"];
      case "verify":
        return [p.user, " confirmed their email"];
      case "quote":
        return p.detail ? [p.user, " sent quote ", p.detail] : [p.user, " sent a quote"];
      case "password":
        return p.actor ? [p.actor, " sent ", p.user, " a link to change the password"] : [p.user, " changed their password"];
      case "disable":
        return [p.actor ?? "The system", " blocked the account of ", p.user];
      case "enable":
        return [p.actor ?? "The system", " reactivated the account of ", p.user];
      case "roles":
        return [p.actor ?? "The system", " changed the position of ", p.user, " to ", p.roles];
      case "update":
        return [p.actor ?? "The system", " edited the details of ", p.user];
      case "delete":
        return [p.actor ?? "The system", " deleted the account of ", p.user];
      case "invite":
        return [p.actor ?? "The system", " invited ", p.user, " as ", p.roles];
    }
  },
};

const COPY = { es, en };

export function useHistoryCopy(): HistoryCopy {
  return COPY[usePrefs().lang];
}

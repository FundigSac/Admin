import { usePrefs } from "@/lib/prefs";

// Textos de "Qué puede hacer cada persona" (Ajustes, solo administración). Lo que permite cada puesto, en frases,
// está en src/components/users/access-copy.ts porque la ficha de una cuenta lo muestra igual.

const n = (v: number) => v.toLocaleString("es-PE");

const es = {
  title: "Qué puede hacer cada persona",
  lead: "Cada persona del equipo tiene uno o más puestos. El puesto decide qué partes del panel ve y qué puede cambiar. Si alguien tiene dos puestos, puede hacer lo de ambos.",
  change: "Cambiar el puesto de alguien",
  lookupTitle: "Consulta por persona",
  lookupLabel: "Elige a alguien del equipo",
  lookupEmpty: "Todavía no hay personal registrado.",
  can: (name: string) => `${name} puede:`,
  cannot: "No puede:",
  openAccount: "Abrir su cuenta",
  everything: "Puede hacer todo lo que permite el panel.",
  jobsTitle: "Puestos del equipo",
  people: (v: number) => (v === 0 ? "Nadie tiene este puesto" : v === 1 ? "1 persona" : `${n(v)} personas`),
  andMore: (v: number) => `y ${n(v)} más`,
  customersCount: (v: number) => (v === 1 ? "Ver la cuenta del cliente" : `Ver las ${n(v)} cuentas de clientes`),
  compareTitle: "Comparar puestos",
  compareTable: "Tabla para comparar puestos",
  compareLead: "Cada fila es algo que se puede hacer en el panel. La marca indica qué puestos lo permiten.",
  thing: "Lo que se puede hacer",
  yes: "Sí",
  no: "No",
  note: "Los puestos y lo que permite cada uno están fijados en el sistema de FUNDIGSAC. Para crear un puesto nuevo o cambiar lo que permite, pídeselo al equipo técnico.",
};

export type RolesCopy = typeof es;

const m = (v: number) => v.toLocaleString("en-US");

const en: RolesCopy = {
  title: "Who can do what",
  lead: "Everyone on the team has one or more jobs. The job decides which parts of the panel they see and what they can change. Someone with two jobs can do what both allow.",
  change: "Change someone's job",
  lookupTitle: "Look up a person",
  lookupLabel: "Choose someone from the team",
  lookupEmpty: "No staff accounts yet.",
  can: (name: string) => `${name} can:`,
  cannot: "Cannot:",
  openAccount: "Open their account",
  everything: "Can do everything the panel allows.",
  jobsTitle: "Team jobs",
  people: (v: number) => (v === 0 ? "Nobody has this job" : v === 1 ? "1 person" : `${m(v)} people`),
  andMore: (v: number) => `and ${m(v)} more`,
  customersCount: (v: number) => (v === 1 ? "See the customer account" : `See the ${m(v)} customer accounts`),
  compareTitle: "Compare jobs",
  compareTable: "Table comparing jobs",
  compareLead: "Each row is something that can be done in the panel. The mark shows which jobs allow it.",
  thing: "What can be done",
  yes: "Yes",
  no: "No",
  note: "Jobs and what each one allows are fixed in the FUNDIGSAC system. To create a new job or change what it allows, ask the technical team.",
};

const COPY = { es, en };

export function useRolesCopy(): RolesCopy {
  return COPY[usePrefs().lang];
}

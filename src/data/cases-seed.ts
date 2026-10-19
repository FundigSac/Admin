import { addBusinessDays } from "@/lib/business-days";
import { STAFF } from "./demo-account";
import type { CaseEvent, Claim, Inquiry, PrivacyRequest, ProductFamily, ProjectType, Quote, QuoteItem, QuoteSource, QuoteStatus, User } from "./types";

// Casos de demostración de los formularios del sitio: cotizaciones, contacto, Libro de Reclamaciones y solicitudes
// de eliminación de datos. Empresas y personas ficticias; productos del catálogo real de FUNDIGSAC.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const SALES = STAFF.filter((s) => s.roles.includes("sales")).map((s) => s.name);
const LEGAL = STAFF.find((s) => s.roles.includes("legal_support"))!.name;
const ADMIN = STAFF[0].name;

const PRODUCTS: Record<Exclude<ProductFamily, "mixto">, { name: string; dns: string[]; unit: "und" | "m"; qty: [number, number] }[]> = {
  valvulas: [
    { name: "Válvula compuerta FUNDIGSAC con garantía extendida", dns: ["DN 100", "DN 150", "DN 200", "DN 250", "DN 300"], unit: "und", qty: [4, 60] },
    { name: "Válvula mariposa con reductor", dns: ["DN 200", "DN 300", "DN 400", "DN 500"], unit: "und", qty: [2, 24] },
    { name: "Válvula de aire triple efecto", dns: ["DN 50", "DN 80", "DN 100"], unit: "und", qty: [6, 40] },
  ],
  tuberias: [
    { name: "Tubería de hierro dúctil K9 junta automática", dns: ["DN 150", "DN 200", "DN 300", "DN 400"], unit: "m", qty: [120, 2400] },
  ],
  marcos_tapas: [
    { name: "Marco y tapa de buzón D400", dns: ["Ø 600"], unit: "und", qty: [10, 180] },
    { name: "Marco y tapa de caja de válvula", dns: ["300 × 300"], unit: "und", qty: [20, 300] },
  ],
};

const WALK_INS = [
  { company: "Consorcio Saneamiento Chancay", email: "logistica@consorciochancay.pe" },
  { company: "Obras Hidráulicas Norte S.A.C.", email: "compras@ohnorte.pe" },
  { company: "Consorcio Agua Segura Altiplano", email: "adquisiciones@aguasegura.pe" },
  { company: "Ingeniería y Redes del Centro S.A.C.", email: "proyectos@iredes.pe" },
];

const DESTINATIONS = ["Lima", "Arequipa", "La Libertad", "Piura", "Cusco", "Junín", "Ica", "Lambayeque", "Cajamarca", "Puno", "Tacna", "Áncash"];
const ROLES = ["Jefe de logística", "Residente de obra", "Ingeniero de proyectos", "Gerente general", "Encargado de compras", "Supervisor de obra"];

const QUOTE_MESSAGES = [
  "Requerimos precio y plazo de entrega para obra de mejoramiento del sistema de agua potable. Necesitamos fichas técnicas y certificado de calidad.",
  "Cotizar con entrega en obra. Indicar si cuentan con stock inmediato y condiciones de pago a 30 días.",
  "Proyecto de ampliación de redes. Adjuntaremos planos si lo requieren. Favor confirmar compatibilidad con tubería existente.",
  "Licitación en curso: necesitamos la cotización antes del cierre de propuestas, con garantía y carta de fabricante.",
  "Reposición de válvulas en línea de conducción. Consultar si incluyen kit de montaje y pernos.",
  "Necesitamos precio por volumen para tres frentes de obra; la entrega puede ser parcial.",
];

const INQUIRIES: { reason: Inquiry["reason"]; message: string }[] = [
  { reason: "documentacion", message: "Solicito la ficha técnica y el certificado de prueba hidrostática de la válvula compuerta DN 200 para presentarla al supervisor." },
  { reason: "reunion", message: "Queremos coordinar una reunión técnica para evaluar sus válvulas en un proyecto de riego tecnificado en la región." },
  { reason: "documentacion", message: "¿Pueden enviarnos el catálogo de marcos y tapas con las clases de carga disponibles?" },
  { reason: "reunion", message: "Somos distribuidores en el sur del país y nos interesa conversar sobre condiciones comerciales." },
  { reason: "documentacion", message: "Necesito los planos dimensionales de la válvula mariposa DN 400 para el expediente técnico." },
  { reason: "documentacion", message: "Por favor envíen el manual de instalación y mantenimiento de las válvulas de aire." },
  { reason: "reunion", message: "Quisiera agendar una visita a su planta para el área de control de calidad de nuestra empresa." },
];

const CLAIMS: Omit<Claim, "id" | "code" | "createdAt" | "dueAt" | "status" | "answer" | "assignee" | "history" | "eventDate">[] = [
  {
    kind: "reclamo", name: "Rosa Quispe Mamani", docType: "DNI", docNumber: "45879632", address: "Av. Los Incas 482, Cusco", phone: "+51 984 512 337", email: "rosa.quispe@gmail.com",
    minor: false, representative: null, goodType: "PRODUCTO", product: "Válvulas", amount: 1840.5, currency: "PEN", place: null, orderRef: "F001-004215",
    facts: "Recibí dos válvulas compuerta DN 150 y una presenta el recubrimiento epóxico dañado en la brida, con óxido visible al desembalar.",
    request: "Solicito el cambio de la válvula dañada por una nueva en un plazo no mayor de una semana.", responseChannel: "Correo electrónico",
  },
  {
    kind: "queja", name: "Constructora Los Andes S.A.C.", docType: "RUC", docNumber: "20548123675", address: "Jr. Huallaga 315, Huancayo", phone: "+51 964 220 118", email: "logistica@losandes.pe",
    minor: false, representative: null, goodType: null, product: null, amount: null, currency: "PEN", place: "WhatsApp", orderRef: null,
    facts: "Escribimos tres veces por WhatsApp para confirmar la fecha de despacho y no obtuvimos respuesta durante cuatro días.",
    request: "Que se nos asigne un ejecutivo de ventas con respuesta en el día.", responseChannel: "Correo electrónico",
  },
  {
    kind: "reclamo", name: "Luis Huamán Rojas", docType: "DNI", docNumber: "70214598", address: "Calle Real 1020, El Tambo, Junín", phone: "+51 954 778 901", email: "luis.huaman@outlook.com",
    minor: false, representative: null, goodType: "SERVICIO", product: "Entrega o despacho", amount: 350, currency: "PEN", place: null, orderRef: "COT-2026-0388",
    facts: "El despacho llegó dos días después de la fecha confirmada y tuve que pagar horas extra a la cuadrilla.",
    request: "Solicito la devolución del costo del flete.", responseChannel: "Correo electrónico",
  },
  {
    kind: "reclamo", name: "Agroexportadora Santa Rosa S.A.", docType: "RUC", docNumber: "20601547831", address: "Panamericana Sur km 302, Ica", phone: "+51 956 300 145", email: "compras@santarosa.pe",
    minor: false, representative: null, goodType: "PRODUCTO", product: "Tuberías", amount: 12600, currency: "USD", place: null, orderRef: "F001-004198",
    facts: "Seis tubos de hierro dúctil DN 300 llegaron con el anillo de junta incompleto, lo que impidió el montaje en la fecha prevista.",
    request: "Reposición de los anillos faltantes y descuento por los días de paralización.", responseChannel: "Correo electrónico",
  },
  {
    kind: "queja", name: "Carmen Salazar Ticona", docType: "DNI", docNumber: "41236587", address: "Av. Ejército 712, Arequipa", phone: "+51 959 410 223", email: "carmen.salazar@gmail.com",
    minor: false, representative: null, goodType: null, product: null, amount: null, currency: "PEN", place: "Atención telefónica", orderRef: null,
    facts: "La llamada fue transferida varias veces y finalmente se cortó sin que pudiera consultar mi pedido.",
    request: "Que mejoren la atención telefónica y me devuelvan la llamada.", responseChannel: "Carta al domicilio",
  },
  {
    kind: "reclamo", name: "Diego Paredes Flores", docType: "DNI", docNumber: "76321458", address: "Mz. B Lt. 4, Urb. Santa Rosa, Piura", phone: "+51 969 845 112", email: "pa.paredes@gmail.com",
    minor: true, representative: { name: "Ana Flores Benites", doc: "40125874" }, goodType: "PRODUCTO", product: "Marcos y tapas", amount: 420, currency: "PEN", place: null, orderRef: "B001-002741",
    facts: "La tapa de caja de válvula no encaja en el marco entregado; la diferencia es de unos 5 mm.",
    request: "Cambio del juego completo de marco y tapa.", responseChannel: "Correo electrónico",
  },
  {
    kind: "reclamo", name: "Montajes Industriales Rímac S.A.C.", docType: "RUC", docNumber: "20512874569", address: "Av. Argentina 2850, Callao", phone: "+51 947 663 228", email: "operaciones@rimac-montajes.pe",
    minor: false, representative: null, goodType: "PRODUCTO", product: "Acoples", amount: 980, currency: "PEN", place: null, orderRef: "F001-004260",
    facts: "Los acoples universales DN 200 enviados no corresponden al rango de diámetro exterior solicitado en la orden.",
    request: "Cambio por el modelo correcto sin costo adicional.", responseChannel: "Correo electrónico",
  },
];

function pad(n: number, size: number) {
  return String(n).padStart(size, "0");
}

function event(at: number, label: string, actor: string | null, note?: string): CaseEvent {
  return { at: Math.round(at), label, actor, note };
}

function ruc20(r: () => number) {
  const body = `20${Array.from({ length: 8 }, () => Math.floor(r() * 10)).join("")}`;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((a, x, i) => a + x * Number(body[i]), 0);
  return `${body}${(11 - (sum % 11)) % 10}`;
}

export function buildCases(now: number, users: User[], r: () => number) {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)];
  const customers = users.filter((u) => u.kind === "customer" && u.company && u.status !== "disabled");

  // ── Cotizaciones ──
  const quotes: Quote[] = [];
  for (let i = 0; i < 38; i += 1) {
    const u = r() < 0.7 ? pick(customers) : null;
    // Empresas que cotizan sin crear cuenta (el formulario de /cotizar no la exige).
    const walkIn = pick(WALK_INS);
    const createdAt = Math.round(now - Math.pow(r(), 1.5) * 75 * DAY - r() * 8 * HOUR);
    const age = now - createdAt;
    const familyKey = pick<Exclude<ProductFamily, "mixto">>(["valvulas", "valvulas", "valvulas", "tuberias", "marcos_tapas"]);
    const mixed = r() < 0.15;
    const items: QuoteItem[] = [];
    const lines = mixed ? 3 : 1 + Math.floor(r() * 2);
    for (let k = 0; k < lines; k += 1) {
      const fam = mixed ? pick<Exclude<ProductFamily, "mixto">>(["valvulas", "tuberias", "marcos_tapas"]) : familyKey;
      const p = pick(PRODUCTS[fam]);
      const raw = p.qty[0] + r() * (p.qty[1] - p.qty[0]);
      items.push({ product: p.name, dn: pick(p.dns), qty: p.unit === "m" ? Math.round(raw / 6) * 6 : Math.round(raw), unit: p.unit });
    }
    const status: QuoteStatus = age < 1.5 * DAY ? "new" : age < 4 * DAY ? pick<QuoteStatus>(["new", "reviewing"]) : age < 12 * DAY ? pick<QuoteStatus>(["reviewing", "sent", "sent"]) : pick<QuoteStatus>(["sent", "won", "won", "lost"]);
    const assignee = status === "new" ? null : pick(SALES);
    const source: QuoteSource = pick(["general", "product", "product", "cart", "procurement"]);
    const history = [event(createdAt, "received", null)];
    if (assignee) history.push(event(createdAt + (2 + r() * 20) * HOUR, "assigned", ADMIN, assignee));
    if (["sent", "won", "lost"].includes(status)) history.push(event(createdAt + (1 + r() * 2) * DAY, "sent", assignee));
    if (status === "won" || status === "lost") history.push(event(createdAt + (5 + r() * 6) * DAY, status, assignee));
    quotes.push({
      id: `q-${pad(i + 1, 4)}`,
      code: `COT-2026-${pad(612 - i * 7, 4)}`,
      createdAt,
      status,
      source,
      company: u?.company ?? walkIn.company,
      ruc: u?.ruc ?? ruc20(r),
      contactName: u?.name ?? `${pick(["Marco", "Elsa", "Iván", "Paola", "Raúl"])} ${pick(["Gamarra", "Ríos", "Mendoza", "Luna", "Vera"])}`,
      contactRole: pick(ROLES),
      email: u?.email ?? walkIn.email,
      phone: u?.phone ?? `+51 9${Math.floor(r() * 90 + 10)} ${Math.floor(r() * 900 + 100)} ${Math.floor(r() * 900 + 100)}`,
      projectType: pick<ProjectType>(["saneamiento", "saneamiento", "matrices", "alcantarillado", "otro"]),
      destination: pick(DESTINATIONS),
      family: mixed ? "mixto" : familyKey,
      items,
      deliveryBy: r() < 0.6 ? createdAt + (15 + Math.floor(r() * 45)) * DAY : null,
      message: pick(QUOTE_MESSAGES),
      assignee,
      userId: u?.id ?? null,
      history: history.sort((a, b) => a.at - b.at),
    });
  }
  quotes.sort((a, b) => b.createdAt - a.createdAt);

  // ── Consultas de contacto ──
  const inquiries: Inquiry[] = INQUIRIES.concat(INQUIRIES.slice(0, 5)).map((q, i) => {
    const u = pick(customers);
    const createdAt = Math.round(now - (i * 2.3 + r() * 2) * DAY - r() * 6 * HOUR);
    const age = now - createdAt;
    const status = age < 1.2 * DAY ? "new" : age < 6 * DAY ? (r() < 0.5 ? "new" : "answered") : r() < 0.7 ? "closed" : "answered";
    const assignee = status === "new" ? null : pick(SALES);
    const history = [event(createdAt, "received", null)];
    if (status !== "new") history.push(event(createdAt + (3 + r() * 30) * HOUR, "replied", assignee));
    if (status === "closed") history.push(event(createdAt + (2 + r() * 3) * DAY, "closed", assignee));
    return {
      id: `c-${pad(i + 1, 4)}`,
      code: `CON-2026-${pad(318 - i * 4, 4)}`,
      createdAt,
      status,
      fullName: u.name,
      company: u.company ?? "",
      ruc: u.ruc ?? ruc20(r),
      position: pick(ROLES),
      email: u.email,
      phone: u.phone ?? "+51 987 654 321",
      reason: q.reason,
      message: q.message,
      reply: status === "new" ? null : "Gracias por escribirnos. Adjuntamos la información solicitada y quedamos atentos a cualquier consulta adicional.",
      assignee,
      history,
    };
  });

  // ── Libro de Reclamaciones ──
  const claimAges = [0.4, 2.2, 5.6, 9.5, 13.8, 18.5, 26];
  const claims: Claim[] = CLAIMS.map((c, i) => {
    const createdAt = Math.round(now - claimAges[i] * DAY - r() * 5 * HOUR);
    const dueAt = addBusinessDays(createdAt, 15);
    const answered = i >= 5;
    const status = answered ? "answered" : i === 0 ? "received" : "in_progress";
    const assignee = status === "received" ? null : LEGAL;
    const history = [event(createdAt, "received", null), event(createdAt + 60_000, "ackSent", null)];
    if (assignee) history.push(event(createdAt + (4 + r() * 20) * HOUR, "assigned", ADMIN, LEGAL));
    const answerAt = createdAt + (6 + r() * 3) * DAY;
    if (answered) history.push(event(answerAt, "answered", LEGAL));
    return {
      ...c,
      id: `r-${pad(i + 1, 4)}`,
      code: `${pad(2026, 4)}-${pad(47 - i, 6)}`,
      createdAt,
      dueAt,
      status,
      eventDate: createdAt - (2 + Math.floor(r() * 6)) * DAY,
      answer: answered
        ? {
            text: "Lamentamos lo ocurrido. Hemos verificado su caso y procederemos con el cambio solicitado sin costo; nuestro equipo coordinará la entrega en un plazo de 5 días hábiles.",
            at: Math.round(answerAt),
            actor: LEGAL,
          }
        : null,
      assignee,
      history,
    };
  });

  // ── Solicitudes de eliminación de cuenta y datos ──
  const privacyAges = [0.6, 3.1, 7.4, 16];
  const privacyStatus: PrivacyRequest["status"][] = ["received", "identity", "processing", "done"];
  const privacy: PrivacyRequest[] = privacyAges.map((d, i) => {
    const u = users.filter((x) => x.kind === "customer")[10 + i * 7];
    const createdAt = Math.round(now - d * DAY - r() * 4 * HOUR);
    const status = privacyStatus[i];
    const history = [event(createdAt, "received", null), event(createdAt + 60_000, "blocked", null)];
    if (i >= 1) history.push(event(createdAt + 1.5 * DAY, "identity", LEGAL));
    if (i >= 2) history.push(event(createdAt + 3 * DAY, "processing", LEGAL));
    if (i >= 3) history.push(event(createdAt + 7 * DAY, "done", LEGAL));
    return {
      id: `p-${pad(i + 1, 4)}`,
      code: `ELIM-2026-${pad(19 - i * 3, 4)}`,
      createdAt,
      dueAt: addBusinessDays(createdAt, 10),
      status,
      name: u.name,
      email: u.email,
      channel: (["form", "email", "form", "whatsapp"] as const)[i],
      userId: u.id,
      reason: ["Ya no necesito la cuenta.", "Cerramos el proyecto y no compraremos más.", "Prefiero no tener mis datos registrados.", "Me registré por error con mi correo personal."][i],
      history,
    };
  });

  return { quotes, inquiries, claims, privacy };
}

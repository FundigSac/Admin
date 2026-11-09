import { usePrefs } from "@/lib/prefs";

// Textos de la pantalla de acceso. Viven junto a ella para que el acceso no dependa de los textos de otras pantallas.
// Frases cortas, en segunda persona; cada error dice qué pasó y qué hacer.

const es = {
  skip: "Saltar al formulario",
  title: "Entra al panel",
  lead: "Escribe tu correo de trabajo y te enviamos un código de 6 números. Con ese código entras; no necesitas contraseña.",
  steps: {
    label: "Cómo se entra",
    current: "Paso actual",
    done: "Hecho",
    items: [
      { title: "Tu correo de trabajo", text: "El mismo que usas en FUNDIGSAC." },
      { title: "El código que te llega", text: "Lo encuentras en tu bandeja de entrada. Vence a los 10 minutos y sirve una sola vez." },
      { title: "Tu lista del día", text: "Al entrar ves lo que tienes que atender, con los plazos legales primero." },
    ],
    short: ["Correo", "Código", "Listo"],
  },
  email: "Correo de trabajo",
  emailPh: "nombre@fundigsac.com",
  remember: "Recordarme en este equipo",
  send: "Enviar código",
  sending: "Enviando…",
  why: "Con un código no hay contraseña que alguien pueda adivinar o copiar. Solo entra quien puede abrir tu correo.",
  required: "Escribe tu correo de trabajo para recibir el código.",
  invalidEmail: "Ese correo está incompleto. Revísalo; debe verse así: nombre@fundigsac.com.",
  codeHeading: "Revisa tu correo",
  codeSub: (email: string) => `Si ${email} es una cuenta del personal de FUNDIGSAC, ya te llegó un código de 6 números.`,
  code: "Código de 6 números",
  codeHint: "Puedes pegarlo. Al completar los 6 números entras solo.",
  expiresIn: (time: string) => `Vence en ${time}`,
  expiredShort: "Venció",
  expired: "Este código ya venció. Pide otro con «Reenviar código».",
  verify: "Entrar",
  verifying: "Comprobando…",
  resend: "Reenviar código",
  resendIn: (s: number) => `Reenviar en ${s} s`,
  resent: "Te enviamos un código nuevo. El anterior ya no sirve.",
  changeEmail: "Usar otro correo",
  wrongCode: (left: number) => (left === 1 ? "Ese código no es correcto. Te queda 1 intento." : `Ese código no es correcto. Te quedan ${left} intentos.`),
  locked: "Usaste los 5 intentos. Pide un código nuevo para seguir.",
  limited: "Hiciste muchos intentos seguidos. Espera unos minutos y vuelve a probar.",
  offline: "No pudimos conectar con el servidor de acceso. Vuelve a probar en unos minutos.",
  incomplete: "Faltan números: el código tiene 6.",
  demo: {
    title: "Estás en la versión de prueba",
    text: "Todavía no salen correos de verdad. Puedes entrar directo con la cuenta de demostración, que tiene permisos de administración, o probar el paso del código.",
    enter: "Entrar a la demo",
    entering: "Entrando…",
    tryCode: "Probar con código",
    inbox: "Bandeja de demostración",
    mail: (code: string) => `Asunto: Tu código de acceso es ${code}`,
    use: "Completar el código",
  },
  footer: {
    preview: "Vista previa con datos de demostración; aún no hay base de datos conectada.",
    live: "Conectado a los datos del Backend de FUNDIGSAC.",
  },
};

export type LoginCopy = typeof es;

const en: LoginCopy = {
  skip: "Skip to the form",
  title: "Sign in to the panel",
  lead: "Type your work email and we will send you a 6-digit code. You sign in with that code; there is no password.",
  steps: {
    label: "How signing in works",
    current: "Current step",
    done: "Done",
    items: [
      { title: "Your work email", text: "The one you use at FUNDIGSAC." },
      { title: "The code we send you", text: "You will find it in your inbox. It expires after 10 minutes and works only once." },
      { title: "Your list for today", text: "Once inside you see what needs your attention, with legal deadlines first." },
    ],
    short: ["Email", "Code", "Done"],
  },
  email: "Work email",
  emailPh: "name@fundigsac.com",
  remember: "Remember me on this computer",
  send: "Send code",
  sending: "Sending…",
  why: "With a code there is no password anyone can guess or copy. Only someone who can open your email gets in.",
  required: "Type your work email to receive the code.",
  invalidEmail: "That email is incomplete. Check it; it should look like name@fundigsac.com.",
  codeHeading: "Check your email",
  codeSub: (email: string) => `If ${email} is a FUNDIGSAC staff account, a 6-digit code is already in your inbox.`,
  code: "6-digit code",
  codeHint: "You can paste it. Once all 6 digits are in, you are signed in.",
  expiresIn: (time: string) => `Expires in ${time}`,
  expiredShort: "Expired",
  expired: "This code has expired. Ask for another with “Resend code”.",
  verify: "Sign in",
  verifying: "Checking…",
  resend: "Resend code",
  resendIn: (s: number) => `Resend in ${s} s`,
  resent: "We sent you a new code. The previous one no longer works.",
  changeEmail: "Use another email",
  wrongCode: (left: number) => (left === 1 ? "That code is not correct. You have 1 attempt left." : `That code is not correct. You have ${left} attempts left.`),
  locked: "You used all 5 attempts. Ask for a new code to continue.",
  limited: "Too many attempts in a row. Wait a few minutes and try again.",
  offline: "We could not reach the sign-in server. Try again in a few minutes.",
  incomplete: "Some digits are missing: the code has 6.",
  demo: {
    title: "You are in the test version",
    text: "No real emails are sent yet. You can go straight in with the demo account, which has administrator permissions, or try the code step.",
    enter: "Enter the demo",
    entering: "Entering…",
    tryCode: "Try with a code",
    inbox: "Demo inbox",
    mail: (code: string) => `Subject: Your sign-in code is ${code}`,
    use: "Fill in the code",
  },
  footer: {
    preview: "Preview with demo data; no database is connected yet.",
    live: "Connected to the FUNDIGSAC Backend data.",
  },
};

const COPY = { es, en };

export function useLoginCopy(): LoginCopy {
  return COPY[usePrefs().lang];
}

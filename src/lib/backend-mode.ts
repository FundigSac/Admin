/**
 * Origen de datos del panel. Con NEXT_PUBLIC_DATA_SOURCE=backend el panel usa el Backend real a través de su BFF
 * (src/app/api): acceso con código enviado por correo, cuentas, actividad y colas de atención. Sin esa variable
 * (despliegue de demostración en Vercel) sigue con los datos simulados del navegador.
 */
export const BACKEND_MODE = process.env.NEXT_PUBLIC_DATA_SOURCE === "backend";

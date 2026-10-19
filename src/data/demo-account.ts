import type { UserRole } from "./types";

// Personal de demostración (fase de diseño: aún no hay backend ni base de datos). El acceso al panel es sin
// contraseña: se pide un código de un solo uso que llega al correo. El administrador coincide con la cuenta que
// siembra el Backend en local (admin@fundigsac.local).
export const ADMIN_NAME = "Administrador FUNDIGSAC";
export const ADMIN_EMAIL = "admin@fundigsac.local";

export const STAFF: readonly { name: string; email: string; roles: UserRole[] }[] = [
  { name: ADMIN_NAME, email: ADMIN_EMAIL, roles: ["administrator"] },
  { name: "Karina Lozano Paz", email: "ventas@fundigsac.local", roles: ["sales"] },
  { name: "Pedro Alvarado Núñez", email: "pedro.alvarado@fundigsac.local", roles: ["sales", "read_only"] },
  { name: "Silvia Ramos Ortiz", email: "legal@fundigsac.local", roles: ["legal_support"] },
  { name: "Tomás Herrera Vega", email: "catalogo@fundigsac.local", roles: ["catalog_editor"] },
  { name: "Lorena Campos Díaz", email: "revision@fundigsac.local", roles: ["catalog_reviewer"] },
];

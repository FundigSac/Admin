import "server-only";
import postgres from "postgres";

/**
 * Conexión a la base del Backend (esquema `app` en Supabase) con el rol `fundigsac_api`, que solo tiene DML y no puede
 * borrar ni reescribir registros con valor legal. Se usa el pooler de transacciones de Supavisor (puerto 6543), así
 * que no hay sentencias preparadas y todo lo que deba ir junto va dentro de `sql.begin`.
 */
let client: postgres.Sql | null = null;

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function db(): postgres.Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new ApiNotConfigured();
  client = postgres(url, {
    prepare: false,
    // Supavisor en modo transacción se cuelga con consultas en pipeline: una a la vez por conexión.
    max_pipeline: 1,
    // Tipos de parámetros como en v3 (Date → timestamptz, boolean, arrays).
    infer: true,
    query_timeout: 15_000,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
    transform: { undefined: null },
  });
  return client;
}

export class ApiNotConfigured extends Error {
  constructor() {
    super("DATABASE_URL no está configurada");
  }
}

export type Tx = postgres.TransactionSql;

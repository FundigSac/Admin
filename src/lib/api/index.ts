import type { UsersApi } from "./contract";
import { mockAdapter } from "./mock-adapter";

// Punto único de acceso a datos. Para conectar el Backend: crear http-adapter.ts que cumpla UsersApi
// (fetch a /api/v1/staff/** a través de un BFF con cookies HttpOnly) y devolverlo aquí.
export const api: UsersApi = mockAdapter;

export * from "./contract";

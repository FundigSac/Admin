import { BACKEND_MODE } from "@/lib/backend-mode";
import type { UsersApi } from "./contract";
import { httpAdapter } from "./http-adapter";
import { mockAdapter } from "./mock-adapter";

// Punto único de acceso a datos: el Backend real (http-adapter, a través del BFF con cookies httpOnly) o la
// demostración en el navegador (mock-adapter), según NEXT_PUBLIC_DATA_SOURCE.
export const api: UsersApi = BACKEND_MODE ? httpAdapter : mockAdapter;

export * from "./contract";

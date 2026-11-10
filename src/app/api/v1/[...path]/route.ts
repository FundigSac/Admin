import { after } from "next/server";
import { routes } from "@/server/api/routes";
import { dispatch } from "@/server/api/router";
import { dispatchOutbox, mailConfigured } from "@/server/api/mail";

/**
 * API de FUNDIGSAC (/api/v1/**), compatible con el contrato del Backend Java. La usan el BFF de este panel y el del
 * sitio público (BACKEND_URL). Corre en Node (no Edge) por el driver de Postgres y scrypt.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(request: Request, { params }: Ctx): Promise<Response> {
  const response = await dispatch(routes, request, (await params).path);
  // Los correos que dejó esta petición en la bandeja se envían después de responder.
  if (request.method !== "GET" && mailConfigured()) after(() => dispatchOutbox(10).catch(() => undefined));
  return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;

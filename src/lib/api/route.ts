import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError, badRequest } from "@/lib/errors";

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response | unknown>;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Wraps a route handler with:
 *  - CSRF defence for mutations (same-origin `Origin` check; JSON or multipart bodies only),
 *  - uniform JSON error responses for ApiError / ZodError / unexpected errors,
 *  - automatic JSON serialisation of plain return values.
 */
export function api<C = unknown>(handler: Handler<C>, opts: { csrf?: boolean } = {}) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      if (MUTATING.has(req.method) && opts.csrf !== false) assertSameOrigin(req);
      const result = await handler(req, ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, code: err.code, details: err.details }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Invalid request.", code: "validation_error", details: err.issues },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "internal" }, { status: 500 });
}

function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      /* invalid */
    }
    if (!host || originHost !== host) throw new ApiError(403, "Cross-site request blocked.", "csrf");
  }
  const type = req.headers.get("content-type") ?? "";
  const hasBody = req.headers.get("content-length") !== "0" && req.method !== "DELETE";
  if (hasBody && type && !type.startsWith("application/json") && !type.startsWith("multipart/form-data")) {
    throw new ApiError(415, "Unsupported content type.", "unsupported_media_type");
  }
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export function readQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export type Params<P> = { params: Promise<P> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Path ids that aren't UUIDs can't exist — answer 404 instead of letting Postgres reject the cast. */
export function uuidParam(id: string, what = "Resource"): string {
  if (!UUID.test(id)) throw new ApiError(404, `${what} not found.`, "not_found");
  return id;
}

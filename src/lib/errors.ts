export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "error",
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, message, "bad_request", details);
export const unauthorized = (message = "Log in to continue.") => new ApiError(401, message, "unauthorized");
export const forbidden = (message = "You don't have permission to do that.") => new ApiError(403, message, "forbidden");
export const notFound = (message = "Not found.") => new ApiError(404, message, "not_found");
export const conflict = (message: string) => new ApiError(409, message, "conflict");
export const tooMany = (message = "Slow down — try again in a moment.") => new ApiError(429, message, "rate_limited");
export const paymentRequired = (message: string) => new ApiError(402, message, "insufficient_credits");

/** Postgres unique_violation. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = findPgError(err);
  if (!e || e.code !== "23505") return false;
  return constraint ? e.constraint === constraint || String(e.message ?? "").includes(constraint) : true;
}

function findPgError(err: unknown): { code?: string; constraint?: string; message?: string } | null {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur && typeof cur === "object"; i++) {
    const c = cur as { code?: string; cause?: unknown };
    if (typeof c.code === "string") return c as { code?: string; constraint?: string; message?: string };
    cur = c.cause;
  }
  return null;
}

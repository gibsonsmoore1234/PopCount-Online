/** Typed fetch wrapper used by TanStack Query hooks. */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type Options = Omit<RequestInit, "body"> & { json?: unknown; form?: FormData };

export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const { json, form, headers, ...rest } = opts;
  const res = await fetch(path, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : form,
    credentials: "same-origin",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; code?: string };
    throw new ApiClientError(res.status, body.error ?? `Request failed (${res.status})`, body.code);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

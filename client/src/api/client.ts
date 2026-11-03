// Integration point 11. Every request goes to the same origin (vite.config.ts proxies /api in dev),
// so the session cookie is sent automatically. `credentials: "include"` keeps that true if the API
// is ever served from another origin.

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// `path` is the full API path, e.g. api<CurrentUser>("/api/auth/me").
// A string body is sent as JSON. A 204 response resolves to undefined.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers, credentials: "include" });

  if (!res.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // Not a JSON error body, e.g. the dev proxy cannot reach the server.
    }
    if (body?.error?.code) {
      throw new ApiError(res.status, body.error.code, body.error.message, body.error.details);
    }
    throw new ApiError(res.status, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

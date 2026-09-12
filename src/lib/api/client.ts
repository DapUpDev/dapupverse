/**
 * The one place the frontend talks HTTP to the DapUp API.
 *
 * - `apiBaseUrl()` is `NEXT_PUBLIC_API_BASE_URL`, inlined at build time.
 *   Unset means "no API": the repositories fall back to the browser-local
 *   mocks, which is how local development and unit tests run.
 * - Every request may carry the Clerk session token. It is read from
 *   clerk-js (`window.Clerk.session.getToken()`) at call time, so a token
 *   is never stored here and is always fresh (they expire after 60 s).
 *   Tests inject a getter instead.
 * - Failures become `ApiError` with the HTTP status; callers decide what
 *   404 or 403 means for them.
 */

export function apiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  const trimmed = raw?.trim().replace(/\/+$/, "");
  return trimmed ? trimmed : null;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

/** Test hook. Production reads the token from clerk-js directly. */
export function setAccessTokenGetter(getter: TokenGetter | null): void {
  tokenGetter = getter;
}

type ClerkGlobal = {
  session?: { getToken?: () => Promise<string | null> } | null;
};

async function accessToken(): Promise<string | null> {
  if (tokenGetter) return tokenGetter();
  if (typeof window === "undefined") return null;
  const clerk = (window as unknown as { Clerk?: ClerkGlobal }).Clerk;
  try {
    return (await clerk?.session?.getToken?.()) ?? null;
  } catch {
    return null;
  }
}

export type ApiRequest = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Query parameters; undefined/empty values are omitted. */
  query?: Record<string, string | undefined>;
};

export async function apiFetch<T>(path: string, init: ApiRequest = {}): Promise<T> {
  const base = apiBaseUrl();
  if (!base) throw new ApiError(0, "API base URL is not configured.");

  const url = new URL(base + path);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const token = await accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!response.ok) {
    let detail = response.statusText || `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      // Non-JSON error body: keep the status text.
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

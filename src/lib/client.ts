const TOKEN_KEY = "fyk:session-token";

export function setSessionToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSessionToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function api<T = any>(url: string, options: ApiOptions = {}): Promise<T> {
  const token = getSessionToken();
  const { body, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((rest.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const init: RequestInit = {
    ...rest,
    headers,
    credentials: "include",
    // Add a 30-second timeout unless the caller already provided a signal
    signal: rest.signal ?? AbortSignal.timeout(30_000),
    body: body != null ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(url, init);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

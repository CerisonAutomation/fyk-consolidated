import { getSupabase } from "@/integrations/supabase/client";

/**
 * Browser → `/api/*` JSON client.
 *
 * THE BUG THIS REPLACES
 * ---------------------
 * It used to read a bearer token from `localStorage["fyk:session-token"]` and
 * attach it as `Authorization: Bearer …`. Nothing in the app ever *wrote* that
 * key (the session is persisted by `@supabase/ssr` in `sb-<ref>-auth-token`
 * cookies, which is also what lets a document render verify it — see
 * `#/lib/document-auth.server`), so:
 *   - every request reached the API anonymous, and
 *   - `setSessionToken()`/`clearSessionToken()` were a standing invitation to
 *     store an auth token in a third localStorage key — which AI_RULES.md
 *     forbids precisely because it is readable by any XSS payload.
 *
 * Now the token is read from the one place that owns it (`supabase.auth`), is
 * never written to a new storage location, and is refreshed automatically
 * because supabase-js handles renewal.
 */

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly payload: unknown = null,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
	body?: unknown;
	/** Extra milliseconds after which the request is aborted. Default 15s. */
	timeoutMs?: number;
}

/**
 * The current Supabase access token, or `null` when signed out / unconfigured.
 * A failing `getSession()` must not turn into a failed API call, so errors
 * degrade to "anonymous".
 */
async function accessToken(): Promise<string | null> {
	const client = getSupabase();
	if (!client) return null;
	try {
		const { data } = await client.auth.getSession();
		return data.session?.access_token ?? null;
	} catch {
		return null;
	}
}

export async function api<T>(
	url: string,
	options: ApiOptions = {},
): Promise<T> {
	const { body, timeoutMs = 15_000, ...rest } = options;
	const token = await accessToken();

	const headers = new Headers(rest.headers);
	if (body !== undefined && !headers.has("content-type")) {
		headers.set("content-type", "application/json");
	}
	if (token) headers.set("authorization", `Bearer ${token}`);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	let response: Response;
	try {
		response = await fetch(url, {
			...rest,
			headers,
			// Same-origin cookies are kept (useful for any future cookie session),
			// but cross-origin credentials are never sent.
			credentials: "same-origin",
			body:
				body === undefined
					? null
					: typeof body === "string"
						? body
						: JSON.stringify(body),
			signal: rest.signal ?? controller.signal,
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new ApiError(0, "The request timed out. Check your connection.");
		}
		throw new ApiError(0, "Network unreachable. Check your connection.");
	} finally {
		clearTimeout(timer);
	}

	if (response.status === 204) return undefined as T;

	const payload: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			extractMessage(payload) ?? `Request failed (${response.status})`;
		// 401 on a token-authenticated call means the session died: ask supabase
		// to refresh so the next attempt carries a fresh token.
		if (response.status === 401) await refreshSession();
		throw new ApiError(response.status, message, payload);
	}
	return payload as T;
}

function extractMessage(payload: unknown): string | null {
	if (payload && typeof payload === "object") {
		const candidate = (payload as { error?: unknown }).error;
		if (typeof candidate === "string" && candidate.trim()) return candidate;
	}
	return null;
}

async function refreshSession(): Promise<void> {
	const client = getSupabase();
	if (!client) return;
	try {
		await client.auth.refreshSession();
	} catch {
		/* the caller's next attempt will surface a real error */
	}
}

/** POST helper mirroring `api()`'s JSON handling. */
export function post<T>(
	url: string,
	body?: unknown,
	options: ApiOptions = {},
): Promise<T> {
	return api<T>(url, { ...options, method: "POST", body });
}

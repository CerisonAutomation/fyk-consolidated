/**
 * The browser's only door to the FYK backend.
 *
 * There is no bearer token here on purpose: the session travels as an httpOnly-
 * capable cookie set by `@supabase/ssr`, so a stolen XSS payload cannot exfiltrate
 * an access token from localStorage, and `credentials: "include"` means every
 * request is authorized the same way in the browser and in tests.
 *
 * The response envelope is unwrapped here, so components deal with data or a
 * thrown `ApiClientError` that is already safe to display.
 */

export type ApiErrorCode =
	| "bad_request"
	| "unauthorized"
	| "forbidden"
	| "not_found"
	| "conflict"
	| "rate_limited"
	| "payload_too_large"
	| "unsupported_media"
	| "dependency_unavailable"
	| "internal_error"
	| "network_error";

export class ApiClientError extends Error {
	readonly status: number;
	readonly code: ApiErrorCode;
	readonly requestId: string | null;
	readonly details?: Record<string, unknown>;
	/** 409/400-class problems should be surfaced inline, not as a toast. */
	readonly retryable: boolean;

	constructor(options: { code: ApiErrorCode; message: string; status: number; requestId?: string | null; details?: Record<string, unknown>; retryable?: boolean }) {
		super(options.message);
		this.name = "ApiClientError";
		this.code = options.code;
		this.status = options.status;
		this.requestId = options.requestId ?? null;
		this.details = options.details;
		this.retryable = options.retryable ?? options.status >= 500;
	}

	get isAuth(): boolean {
		return this.code === "unauthorized";
	}
	get isBlocking(): boolean {
		return this.code === "forbidden" || this.code === "conflict" || this.code === "bad_request";
	}
}

interface Envelope<T> {
	ok: boolean;
	data?: T;
	requestId?: string;
	error?: { code: ApiErrorCode; message: string; details?: Record<string, unknown> };
}

export interface ApiCallOptions {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
	form?: FormData;
	signal?: AbortSignal;
	/** Polling reads opt out of the default 15s timeout. */
	timeoutMs?: number;
}

function newRequestId(): string {
	const random = globalThis.crypto?.randomUUID?.();
	if (random) return random.replace(/-/g, "").slice(0, 20);
	return `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function call<T>(path: string, options: ApiCallOptions, retries = 1): Promise<T> {
	const requestId = newRequestId();
	const isForm = options.form != null;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
	const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;

	let response: Response;
	try {
		// Leading/trailing slashes are trimmed so `api.get("/board/")` and
		// `api.get("board")` hit the same route: the server's matcher treats an empty
		// segment as a mismatch, so an untrimmed slash would 404 in the client.
		const normalized = path.replace(/^\/+/, "").replace(/\/+$/, "");
		response = await fetch(`/api/${normalized}`, {
			method: options.method ?? "GET",
			credentials: "include",
			headers: {
				...(isForm ? {} : { "Content-Type": "application/json" }),
				"X-Request-Id": requestId,
			},
			body: isForm ? options.form : options.body != null ? JSON.stringify(options.body) : undefined,
			signal,
		});
	} catch (error) {
		clearTimeout(timeout);
		const aborted = error instanceof DOMException && error.name === "AbortError";
		if (aborted && options.signal?.aborted) throw new ApiClientError({ code: "network_error", message: "Request cancelled.", status: 0, requestId });
		// One retry for a transient network failure; never for a write that may have
		// already landed, because that would duplicate messages.
		if (retries > 0 && (options.method ?? "GET") === "GET") return call<T>(path, options, retries - 1);
		throw new ApiClientError({
			code: "network_error",
			message: aborted ? "That took too long. Check your connection and try again." : "You appear to be offline. FYK needs a connection.",
			status: 0,
			requestId,
			retryable: true,
		});
	}
	clearTimeout(timeout);

	const text = await response.text();
	let payload: Envelope<T> | null = null;
	try {
		payload = text ? (JSON.parse(text) as Envelope<T>) : null;
	} catch {
		payload = null;
	}

	if (!payload || typeof payload.ok !== "boolean") {
		// A proxy or an unconfigured server answered with HTML. Never forward that.
		throw new ApiClientError({
			code: response.ok ? "internal_error" : "dependency_unavailable",
			message: response.ok ? "The server returned something unexpected." : `The server is unavailable (${response.status}).`,
			status: response.status,
			requestId,
			retryable: true,
		});
	}

	if (!payload.ok) {
		const error = payload.error ?? { code: "internal_error" as const, message: "Something went wrong on our side." };
		// The server decides retryability (429 yes, 409/400 never); a client that
		// guessed would re-send a message the server already stored.
		const shouldRetry = response.headers.get("x-should-retry") === "true";
		throw new ApiClientError({
			code: error.code,
			message: error.message,
			status: response.status,
			requestId: payload.requestId ?? requestId,
			details: error.details,
			retryable: shouldRetry || response.status >= 500,
		});
	}

	return payload.data as T;
}

export const api = {
	get: <T,>(path: string, options?: ApiCallOptions) => call<T>(path, { ...options, method: "GET" }),
	post: <T,>(path: string, body?: unknown, options?: Omit<ApiCallOptions, "body" | "method">) => call<T>(path, { ...options, method: "POST", body }),
	postForm: <T,>(path: string, form: FormData, options?: Omit<ApiCallOptions, "form" | "method">) => call<T>(path, { ...options, method: "POST", form }),
	patch: <T,>(path: string, body?: unknown, options?: Omit<ApiCallOptions, "body" | "method">) => call<T>(path, { ...options, method: "PATCH", body }),
	del: <T,>(path: string, options?: ApiCallOptions) => call<T>(path, { ...options, method: "DELETE" }),
};

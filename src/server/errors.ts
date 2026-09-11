/**
 * Structured error envelopes + redaction for every FYK server response.
 *
 * Rules enforced here (and nowhere else, so they cannot drift):
 *   - A client never receives a raw Postgres/Supabase error, stack trace,
 *     connection string, JWT, or storage path.
 *   - Every error carries a stable machine `code` and the `requestId` of the
 *     request that produced it, so a user report can be matched to a log line.
 *   - Unexpected failures are logged server-side in full and returned as a
 *     generic message.
 */

export type ErrorCode =
	| "bad_request"
	| "unauthorized"
	| "forbidden"
	| "not_found"
	| "conflict"
	| "rate_limited"
	| "payload_too_large"
	| "unsupported_media"
	| "dependency_unavailable"
	| "internal_error";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
	bad_request: 400,
	unauthorized: 401,
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	rate_limited: 429,
	payload_too_large: 413,
	unsupported_media: 415,
	dependency_unavailable: 503,
	internal_error: 500,
};

/** Errors that the UI may show verbatim (they are authored, not leaked). */
export class ApiFailure extends Error {
	readonly status: number;
	constructor(
		readonly code: ErrorCode,
		message: string,
		readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "ApiFailure";
		this.status = STATUS_BY_CODE[code];
	}
}

export function badRequest(message: string, details?: Record<string, unknown>) {
	return new ApiFailure("bad_request", message, details);
}
export function unauthorized(message = "Please sign in to continue.") {
	return new ApiFailure("unauthorized", message);
}
export function forbidden(message = "You are not allowed to do that.") {
	return new ApiFailure("forbidden", message);
}
export function notFound(message = "Not found.") {
	return new ApiFailure("not_found", message);
}
export function conflict(message = "That already exists.") {
	return new ApiFailure("conflict", message);
}
export function dependencyUnavailable(message = "That feature is not available yet.") {
	return new ApiFailure("dependency_unavailable", message);
}
export function unsupported(message: string, details?: Record<string, unknown>) {
	return new ApiFailure("dependency_unavailable", message, details);
}

/**
 * Converts a Postgrest/Storage error into a client-safe ApiFailure.
 *
 * The mapping is deliberately lossy: Postgres messages carry table names,
 * constraint names and sometimes values. The only thing a browser needs is a
 * stable code and an authored sentence; the original error stays in the log.
 */
export function dbFailure(
	error: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
	fallback = "That did not save. Please try again.",
): ApiFailure {
	if (!error) return new ApiFailure("internal_error", fallback);
	// 23505 unique_violation / 42P01 undefined_table etc. (SQLSTATE)
	switch (error.code) {
		case "23505":
			return new ApiFailure("conflict", "You already have that.", { sqlstate: error.code });
		case "23503":
			return new ApiFailure("bad_request", "That record no longer exists.", { sqlstate: error.code });
		case "23514":
			return new ApiFailure("bad_request", "Some of that is not allowed here.", { sqlstate: error.code });
		case "42501":
			return new ApiFailure("forbidden", "You cannot do that.", { sqlstate: error.code });
		case "P0001":
			// A raised exception from one of our own functions: its message is authored.
			return new ApiFailure("bad_request", redact(error.message ?? fallback), { sqlstate: error.code });
		default:
			return new ApiFailure("internal_error", fallback, { sqlstate: error.code ?? null });
	}
}

/* ------------------------------ redaction -------------------------------- */

const REDACTION = "[redacted]";

const SECRET_PATTERNS: Array<[RegExp, string]> = [
	// JWTs (three dot-separated base64url segments)
	[/[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, REDACTION],
	// Supabase keys
	[/\b(sb_(?:publishable|secret|anon)_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/g, REDACTION],
	// postgres connection strings
	[/postgres(?:ql)?:\/\/[^\s"']+/gi, REDACTION],
	// storage paths (never surface internal object keys)
	[/\b(?:avatars-public|chat-media-private|albums-private|photos-public|event-media-public)\/[^\s"']+/g, REDACTION],
	// uuids that leaked out of a db error
	[/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, REDACTION],
];

/** Strips anything that must not reach a browser from a free-text message. */
export function redact(input: string): string {
	let out = input;
	for (const [pattern, replacement] of SECRET_PATTERNS) out = out.replace(pattern, replacement);
	// Constraint and relation names are schema detail: `"reports_pkey"` tells an
	// attacker more than a user needs, so quoted identifiers go too.
	out = out.replace(/"[^"\n]{1,140}"/g, REDACTION);
	// Collapse Postgres detail/hint lines that commonly carry schema names.
	out = out.replace(/\s*(?:DETAIL|HINT|CONTEXT|WHERE|QUERY):[\s\S]*$/gi, "");
	return out.slice(0, 300).trim();
}

/**
 * Maps a PostgREST/Supabase error (or anything else) onto a safe, user-meaningful
 * code + message. `context` lets a handler add specificity ("your message", ...).
 */
export function mapUnknownError(
	error: unknown,
	context = "that",
): { code: ErrorCode; message: string; details?: Record<string, unknown>; retryable?: boolean } {
	// An ApiFailure was authored for a human already; re-mapping it would replace
	// "Write something first." with a generic sentence and lose the field details.
	if (error instanceof ApiFailure) {
		return { code: error.code, message: error.message, details: error.details };
	}
	const raw =
		error instanceof Error
			? error
			: typeof error === "object" && error !== null
				? Object.assign(new Error(String((error as { message?: string }).message ?? "error")), error as object)
				: new Error(String(error));

	const pg = (raw as { code?: string; message?: string }).code ?? "";
	const message = redact(raw.message ?? "Unexpected error");

	switch (pg) {
		case "23505":
			return { code: "conflict", message: `That ${context} already exists.` };
		case "23503":
			return { code: "bad_request", message: `The ${context} references something that no longer exists.` };
		case "23514":
			return { code: "bad_request", message: `Those values are not allowed for ${context}.` };
		case "42501":
			return { code: "forbidden", message: "You do not have permission to do that." };
		case "22P02":
			return { code: "bad_request", message: `That ${context} is not in the right format.` };
		case "PGRST116":
			return { code: "not_found", message: "Not found." };
		case "PGRST301":
			return { code: "unauthorized", message: "Your session expired. Please sign in again." };
		default:
			break;
	}

	// Server-raised domain rules (raised by triggers/policies as plain strings).
	const rules: Array<[RegExp, ErrorCode, string]> = [
		[/not authorized|jwt expired|invalid jwt|invalid claim/i, "unauthorized", "Your session is no longer valid. Please sign in again."],
		[/row-level security|permission denied/i, "forbidden", "You do not have permission to do that."],
		[/post_expired/i, "conflict", "That Board post has expired."],
		[/post_full/i, "conflict", "That post is full."],
		[/owner_cannot_join/i, "forbidden", "You cannot join your own post."],
		[/post_not_found|event not found|not found/i, "not_found", "Not found."],
		[/message_identity_is_immutable|too late to edit|too late to recall|edit window|recall window/i, "forbidden", "That message can no longer be changed."],
		[/pin limit|too many pinned/i, "conflict", "You have reached the pin limit for this conversation."],
		[/blocked/i, "forbidden", "You cannot message this person."],
		[/rate.?limit|too many requests/i, "rate_limited", "Slow down — try again in a minute."],
		[/capacity|full/i, "conflict", "That event is at capacity."],
	];
	for (const [pattern, code, friendly] of rules) {
		if (pattern.test(message)) return { code, message: friendly };
	}

	return { code: "internal_error", message: "Something went wrong on our side. Please try again.", retryable: true };
}

export interface EnvelopeSuccess<T> {
	ok: true;
	data: T;
	requestId: string;
}
export interface EnvelopeFailure {
	ok: false;
	error: { code: ErrorCode; message: string; details?: Record<string, unknown> };
	requestId: string;
}
export type Envelope<T> = EnvelopeSuccess<T> | EnvelopeFailure;

export function errorHeaders(extra?: Record<string, string>): Record<string, string> {
	return { "Cache-Control": "no-store", ...extra };
}

export interface ServerFailure {
	code: ErrorCode;
	message: string;
	details?: Record<string, unknown>;
	retryable?: boolean;
	retryAfterSeconds?: number;
}

export function failureResponse(
	failure: ServerFailure,
	requestId: string,
	extraHeaders?: Record<string, string>,
): Response {
	const status = STATUS_BY_CODE[failure.code];
	const headers: Record<string, string> = {
		"Content-Type": "application/json; charset=utf-8",
		"X-Request-Id": requestId,
		...errorHeaders(extraHeaders),
	};
	if (failure.code === "rate_limited") headers["Retry-After"] = String(failure.retryAfterSeconds ?? 60);
	// A 429 is retryable by definition (wait and send again); a 409/400 is not, and
	// retrying one is how duplicate messages get created.
	if (failure.retryable || failure.code === "rate_limited") headers["X-Should-Retry"] = "true";
	return new Response(
		JSON.stringify({ ok: false, error: { code: failure.code, message: failure.message, details: failure.details }, requestId } satisfies EnvelopeFailure),
		{ status, headers },
	);
}

/* eslint-disable @typescript-eslint/no-unused-vars */

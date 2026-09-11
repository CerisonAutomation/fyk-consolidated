/**
 * Request context for the FYK API: request id, caller resolution, body
 * validation, and the success envelope. One implementation, used by every
 * handler, so no endpoint can accidentally return a bare object or a raw error.
 */

import { z, type ZodIssue } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "#/integrations/supabase/types";
import { ApiFailure, badRequest, type EnvelopeSuccess } from "./errors";
import { requireCaller, resolveCaller, type Caller } from "./supabase-server";

export type ApiClient = SupabaseClient<Database>;

export interface RequestCtx {
	readonly request: Request;
	readonly requestId: string;
	readonly method: string;
	readonly path: string;
	readonly query: URLSearchParams;
	readonly headers: Headers;
	readonly ip: string;
	/** Null for public endpoints; `ctx.auth()` throws for endpoints that need it. */
	readonly callerPromise: Promise<Caller | null>;
	/** Client scoped to the caller — every read/write is subject to RLS. */
	readonly db: () => ApiClient;
	readonly auth: () => Promise<Caller>;
	readonly isAdmin: () => Promise<boolean>;
}

export function newRequestId(headers: Headers): string {
	const inbound = headers.get("x-request-id");
	if (inbound && /^[A-Za-z0-9_.-]{8,64}$/.test(inbound)) return inbound;
	return `fyk_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Client IP used as a rate-limit key. Only the first XFF hop is trusted. */
export function clientIp(headers: Headers): string {
	const forwarded = headers.get("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) return first;
	}
	return headers.get("x-real-ip") ?? "unknown";
}

export interface HandlerDeps {
	request: Request;
	headers: Headers;
	url: URL;
	requestId: string;
	getClient: () => ApiClient;
}

export function buildContext(deps: HandlerDeps): RequestCtx {
	const callerPromise = resolveCaller(deps.headers);
	let cached: ApiClient | null = null;
	return {
		request: deps.request,
		requestId: deps.requestId,
		method: deps.request.method.toUpperCase(),
		path: deps.url.pathname,
		query: deps.url.searchParams,
		headers: deps.headers,
		ip: clientIp(deps.headers),
		callerPromise,
		db: () => {
			if (!cached) cached = deps.getClient();
			return cached;
		},
		auth: () => requireCaller(deps.headers),
		isAdmin: async () => {
			const caller = await callerPromise;
			return caller?.role === "admin";
		},
	};
}

export function success<T>(data: T, requestId: string, extraHeaders?: Record<string, string>): Response {
	const body: EnvelopeSuccess<T> = { ok: true, data, requestId };
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Request-Id": requestId,
			...extraHeaders,
		},
	});
}

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Reads and validates a JSON body. Rejects oversized payloads, wrong content
 * types, and any shape that does not match the supplied Zod schema — before a
 * handler sees a single field, so handlers never defend against junk.
 */
export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
	const method = request.method.toUpperCase();
	const contentType = request.headers.get("content-type") ?? "";
	if (method !== "GET" && method !== "HEAD" && !contentType.includes("application/json")) {
		throw badRequest("Send a JSON body with Content-Type: application/json.");
	}

	const length = Number(request.headers.get("content-length") ?? 0);
	if (length > MAX_BODY_BYTES) throw new ApiFailure("payload_too_large", "That is too much data for one request.");

	let raw: unknown;
	try {
		// clone-free size guard: enforce after read too, since content-length can lie
		const text = await request.text();
		if (text.length > MAX_BODY_BYTES) throw new ApiFailure("payload_too_large", "That is too much data for one request.");
		raw = text ? JSON.parse(text) : {};
	} catch (error) {
		if (error instanceof ApiFailure) throw error;
		throw badRequest("That request body is not valid JSON.");
	}

	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		const fields = parsed.error.issues.map((issue) => ({
			path: issue.path.map(String).join(".") || "body",
			message: humanizeIssue(issue),
		}));
		throw badRequest(
			fields.length === 1 ? fields[0].message : "Some of those answers are not valid.",
			{ fields },
		);
	}
	return parsed.data;
}

/**
 * Zod's built-in messages ("Too small: expected string to have >=2 characters",
 * "Invalid input: expected number, received NaN") are library text, not product
 * copy, and they are the exact shape of internal detail that must never reach a
 * screen. Any issue whose message looks mechanical is rewritten here — one place,
 * so every endpoint is covered even if a schema forgets to author a message.
 */
const TECHNICAL_ZOD_MESSAGE = /expected .* to have|received (?:nan|undefined|null|object|array)|invalid input|invalid original|too (?:small|big)|not assignable|unrecognized key|invalid enum|invalid date|invalid uuid/i;

function humanizeIssue(raw: ZodIssue): string {
	const issue = raw as { code?: string; message: string; path: readonly unknown[]; minimum?: unknown; maximum?: unknown; type?: unknown };
	if (!TECHNICAL_ZOD_MESSAGE.test(issue.message)) return issue.message;

	const label = fieldLabel(issue.path);
	const minimum = typeof issue.minimum === "number" ? issue.minimum : undefined;
	const maximum = typeof issue.maximum === "number" ? issue.maximum : undefined;

	switch (issue.code) {
		case "too_small":
			return minimum === 1 && issue.type === "string"
				? `${label} cannot be empty.`
				: `${label} must be at least ${minimum} ${label.endsWith("character") ? "" : issue.type === "string" ? "characters" : "items"}`.trim();
		case "too_big":
			return `${label} can be at most ${maximum}.`;
		case "invalid_type":
			return `${label} is the wrong type of answer.`;
		case "invalid_value":
			return `${label} is not one of the available choices.`;
		default:
			return `${label} is not quite right.`;
	}
}

function fieldLabel(path: readonly unknown[]): string {
	const last = [...path].reverse().find((segment) => typeof segment === "string" && segment !== "body");
	if (typeof last !== "string") return "That answer";
	const spaced = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function readQuery<T extends z.ZodType>(params: URLSearchParams, schema: T): z.infer<T> {
	const obj: Record<string, string> = {};
	params.forEach((value, key) => {
		obj[key] = value;
	});
	const parsed = schema.safeParse(obj);
	if (!parsed.success) {
		throw badRequest("Those filters are not valid.", {
			fields: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
		});
	}
	return parsed.data;
}

/** Shared shapes used across endpoints. Kept here so limits cannot drift. */
export const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "Not a valid id.");
export const messageBodyLimit = 4000;
export const MAX_MESSAGE_LENGTH = messageBodyLimit;

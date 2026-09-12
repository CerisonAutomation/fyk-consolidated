/**
 * The whole FYK HTTP surface, in one dispatch table.
 *
 * Why not one file per endpoint: every rule that must hold on *every* request
 * (request id, rate limit tier, content-type, body size, envelope shape, error
 * redaction) is implemented exactly once here. A per-file layout is where those
 * rules quietly diverge.
 */

import {
	type ApiClient,
	buildContext,
	newRequestId,
	type RequestCtx,
	success,
} from "./context";
import {
	ApiFailure,
	dependencyUnavailable,
	failureResponse,
	mapUnknownError,
	notFound,
	redact,
	type ServerFailure,
} from "./errors";
import * as board from "./handlers/board";
import * as chat from "./handlers/chat";
import * as discover from "./handlers/discover";
import * as events from "./handlers/events";
import { health } from "./handlers/health";
import * as media from "./handlers/media";
import * as moderation from "./handlers/moderation";
import * as notifications from "./handlers/notifications";
import * as safety from "./handlers/safety";
import { getSession } from "./handlers/session";
import * as settings from "./handlers/settings";
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from "./rate-limit";
import { createUserClient, serverConfigured } from "./supabase-server";

type RouteHandler = (
	ctx: RequestCtx,
	params: Record<string, string>,
) => Promise<unknown>;
type LimitKey = keyof typeof RATE_LIMITS;

interface Route {
	method: "GET" | "POST" | "PATCH" | "DELETE";
	/** Path after /api, with `:param` segments. */
	pattern: string;
	limit: LimitKey;
	/** `optional` endpoints also answer for anonymous visitors (boot + probes). */
	auth: "required" | "optional";
	handler: RouteHandler;
}

const routes: Route[] = [
	{
		method: "GET",
		pattern: "session",
		limit: "read",
		auth: "optional",
		handler: (ctx) => getSession(ctx),
	},
	{
		method: "GET",
		pattern: "health",
		limit: "read",
		auth: "optional",
		handler: (ctx) => health(ctx),
	},

	{
		method: "GET",
		pattern: "discover",
		limit: "read",
		auth: "required",
		handler: (ctx) => discover.listNearby(ctx),
	},
	{
		method: "GET",
		pattern: "profile/:id",
		limit: "read",
		auth: "required",
		handler: (ctx, p) => discover.getProfile(ctx, p.id),
	},
	{
		method: "POST",
		pattern: "taps",
		limit: "write",
		auth: "required",
		handler: (ctx) => discover.tap(ctx),
	},

	{
		method: "GET",
		pattern: "conversations",
		limit: "read",
		auth: "required",
		handler: (ctx) => chat.listConversations(ctx),
	},
	{
		method: "POST",
		pattern: "conversations",
		limit: "write",
		auth: "required",
		handler: (ctx) => chat.openConversationWith(ctx),
	},
	{
		method: "GET",
		pattern: "conversations/:id/messages",
		limit: "read",
		auth: "required",
		handler: (ctx, p) => chat.listMessages(ctx, p.id),
	},
	{
		method: "POST",
		pattern: "conversations/:id/messages",
		limit: "message",
		auth: "required",
		handler: (ctx, p) => chat.sendMessage(ctx, p.id),
	},
	{
		method: "PATCH",
		pattern: "conversations/:id",
		limit: "write",
		auth: "required",
		handler: (ctx, p) => chat.archiveConversation(ctx, p.id),
	},
	{
		method: "PATCH",
		pattern: "messages/:id",
		limit: "write",
		auth: "required",
		handler: (ctx, p) => chat.messageAction(ctx, p.id),
	},
	{
		method: "POST",
		pattern: "messages/:id/react",
		limit: "write",
		auth: "required",
		handler: (ctx, p) => chat.toggleReaction(ctx, p.id),
	},

	{
		method: "GET",
		pattern: "board",
		limit: "read",
		auth: "required",
		handler: (ctx) => board.listBoard(ctx),
	},
	{
		method: "POST",
		pattern: "board",
		limit: "write",
		auth: "required",
		handler: (ctx) => board.createBoardPost(ctx),
	},
	{
		method: "DELETE",
		pattern: "board/:id",
		limit: "write",
		auth: "required",
		handler: (ctx, p) => board.deleteBoardPost(ctx, p.id),
	},
	{
		method: "POST",
		pattern: "board/:id/join",
		limit: "write",
		auth: "required",
		handler: (ctx, p) => board.setBoardJoin(ctx, p.id),
	},

	{
		method: "GET",
		pattern: "events",
		limit: "read",
		auth: "required",
		handler: (ctx) => events.listEvents(ctx),
	},
	{
		method: "POST",
		pattern: "events",
		limit: "write",
		auth: "required",
		handler: (ctx) => events.createEvent(ctx),
	},
	{
		method: "GET",
		pattern: "events/:id",
		limit: "read",
		auth: "required",
		handler: (ctx, p) => events.getEvent(ctx, p.id),
	},
	{
		method: "POST",
		pattern: "events/:id/rsvp",
		limit: "write",
		auth: "required",
		handler: (ctx, p) => events.setRsvp(ctx, p.id),
	},
	{
		method: "DELETE",
		pattern: "events/:id",
		limit: "write",
		auth: "required",
		handler: (ctx, p) => events.cancelEvent(ctx, p.id),
	},

	{
		method: "POST",
		pattern: "reports",
		limit: "report",
		auth: "required",
		handler: (ctx) => safety.submitReport(ctx),
	},
	{
		method: "GET",
		pattern: "reports",
		limit: "read",
		auth: "required",
		handler: (ctx) => safety.myReports(ctx),
	},
	{
		method: "GET",
		pattern: "views",
		limit: "read",
		auth: "required",
		handler: (ctx) => safety.whoViewedMe(ctx),
	},
	{
		method: "POST",
		pattern: "blocks",
		limit: "write",
		auth: "required",
		handler: (ctx) => safety.blockUser(ctx),
	},
	{
		method: "GET",
		pattern: "blocks",
		limit: "read",
		auth: "required",
		handler: (ctx) => safety.blockList(ctx),
	},
	{
		method: "DELETE",
		pattern: "blocks/:id",
		limit: "write",
		auth: "required",
		handler: (ctx, p) => safety.unblockUser(ctx, p.id),
	},

	{
		method: "GET",
		pattern: "settings",
		limit: "read",
		auth: "required",
		handler: (ctx) => settings.getSettings(ctx),
	},
	{
		method: "PATCH",
		pattern: "settings/profile",
		limit: "write",
		auth: "required",
		handler: (ctx) => settings.updateProfile(ctx),
	},
	{
		method: "PATCH",
		pattern: "settings/privacy",
		limit: "write",
		auth: "required",
		handler: (ctx) => settings.updatePrivacy(ctx),
	},
	{
		method: "POST",
		pattern: "onboarding",
		limit: "write",
		auth: "required",
		handler: (ctx) => settings.completeOnboarding(ctx),
	},

	{
		method: "GET",
		pattern: "notifications",
		limit: "read",
		auth: "required",
		handler: (ctx) => notifications.list(ctx),
	},
	{
		method: "POST",
		pattern: "notifications",
		limit: "write",
		auth: "required",
		handler: (ctx) => notifications.mark(ctx),
	},

	{
		method: "POST",
		pattern: "media/photos",
		limit: "write",
		auth: "required",
		handler: (ctx) => media.uploadPhotos(ctx),
	},
	{
		method: "POST",
		pattern: "media/chat",
		limit: "write",
		auth: "required",
		handler: (ctx) => media.uploadChatMedia(ctx),
	},
	{
		method: "GET",
		pattern: "media/photos",
		limit: "read",
		auth: "required",
		handler: (ctx) => media.listMyPhotos(ctx),
	},
	{
		method: "POST",
		pattern: "media/photos/delete",
		limit: "write",
		auth: "required",
		handler: (ctx) => media.deletePhotos(ctx),
	},
	{
		method: "POST",
		pattern: "media/avatar",
		limit: "write",
		auth: "required",
		handler: (ctx) => media.uploadAvatar(ctx),
	},

	{
		method: "GET",
		pattern: "admin/queue",
		limit: "moderation",
		auth: "required",
		handler: (ctx) => moderation.queue(ctx),
	},
	{
		method: "GET",
		pattern: "admin/reports/:id",
		limit: "moderation",
		auth: "required",
		handler: (ctx, p) => moderation.reportDetail(ctx, p.id),
	},
	{
		method: "POST",
		pattern: "admin/resolve",
		limit: "moderation",
		auth: "required",
		handler: (ctx) => moderation.resolve(ctx),
	},
	{
		method: "GET",
		pattern: "admin/audit",
		limit: "moderation",
		auth: "required",
		handler: (ctx) => moderation.auditTrail(ctx),
	},
	{
		method: "POST",
		pattern: "admin/role",
		limit: "moderation",
		auth: "required",
		handler: (ctx) => moderation.setRole(ctx),
	},
];

function match(
	pathname: string,
): { route: Route; params: Record<string, string> } | null {
	const rest = pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
	const segments = rest ? rest.split("/") : [];
	for (const route of routes) {
		const pattern = route.pattern.split("/");
		if (pattern.length !== segments.length) continue;
		const params: Record<string, string> = {};
		let ok = true;
		for (let i = 0; i < pattern.length; i += 1) {
			if (pattern[i].startsWith(":"))
				params[pattern[i].slice(1)] = decodeURIComponent(segments[i]);
			else if (pattern[i] !== segments[i]) {
				ok = false;
				break;
			}
		}
		if (ok) return { route, params };
	}
	return null;
}

/**
 * The rate-limit key. Order matters: caller first, then verb and route, so one
 * member's flood cannot spend another's budget and a read flood cannot exhaust a
 * write budget. `ip` is the fallback for anonymous traffic, where there is no id.
 */
export function rateBucket(
	tier: string,
	userId: string | null,
	ip: string,
	method: string,
	pattern: string,
): string {
	return `${tier}:${userId ?? `ip:${ip}`}:${method}:${pattern}`;
}

function log(
	level: "info" | "warn" | "error",
	requestId: string,
	message: string,
	fields: Record<string, unknown> = {},
) {
	const line = {
		ts: new Date().toISOString(),
		level,
		requestId,
		message,
		...fields,
	};
	const write =
		level === "error"
			? console.error
			: level === "warn"
				? console.warn
				: console.log;
	// Structured and redacted: a stack trace stays in the log, never in a response.
	write(
		JSON.stringify(line, (_key, value) =>
			typeof value === "string" ? redact(value) : value,
		).slice(0, 4000),
	);
}

/**
 * Entry point. Wraps dispatch so that auth cookies written during the request
 * (a refreshed access token, a sign-out) are flushed onto the response.
 */
export async function handleApi(request: Request): Promise<Response> {
	const cookieWrites: string[] = [];
	const response = await dispatch(request, (value) => cookieWrites.push(value));
	// Per-request sink: a module-level array here would leak one user's session
	// cookie into another user's response.
	for (const value of cookieWrites)
		response.headers.append("set-cookie", value);
	return response;
}

async function dispatch(
	request: Request,
	onCookie: (header: string) => void,
): Promise<Response> {
	const url = new URL(request.url);
	const headers = new Headers(request.headers);
	const requestId = newRequestId(headers);

	const matched = match(url.pathname);
	if (!matched) {
		// Deliberately generic: echoing the path would let anyone confirm which
		// internal routes exist (or which uuid they were pointed at) by ear. This
		// is answered before the credential check, because "there is nothing here"
		// is true whether or not the server is configured — and a caller retrying a
		// typo'd path forever, on the strength of a 503, is a real outage pattern.
		return failureToResponse(
			notFound("That endpoint does not exist."),
			requestId,
		);
	}
	const { route, params } = matched;

	// The route exists; it just cannot be served without server credentials.
	if (!serverConfigured()) {
		return failureToResponse(dependencyUnavailable(), requestId);
	}

	if (request.method.toUpperCase() !== route.method) {
		return failureToResponse(
			{
				code: "bad_request",
				message: `${request.method} is not allowed on that endpoint.`,
			},
			requestId,
		);
	}

	const client = createUserClient(headers, onCookie) as ApiClient;
	const ctx = buildContext({
		request,
		headers,
		url,
		requestId,
		getClient: () => client,
	});

	// Rate limiting runs before any database call, so a flood costs us nothing.
	const identity = await ctx.callerPromise;
	const bucket = rateBucket(
		route.limit,
		identity?.userId ?? null,
		ctx.ip,
		route.method,
		route.pattern,
	);
	const decision = await checkRateLimit(
		headers,
		bucket,
		RATE_LIMITS[route.limit].limit,
		RATE_LIMITS[route.limit].windowMs,
	);
	const limitHeaders = {
		...rateLimitHeaders(decision),
		"X-Request-Id": requestId,
	};

	if (!decision.allowed) {
		log("warn", requestId, "rate_limited", { bucket, ip: ctx.ip });
		return failureToResponse(
			{
				code: "rate_limited",
				message: "Too many requests. Pause for a moment and try again.",
				retryAfterSeconds: decision.retryAfterSeconds,
			},
			requestId,
			limitHeaders,
		);
	}

	try {
		if (route.auth === "required" && !identity) {
			return failureToResponse(
				{ code: "unauthorized", message: "Please sign in to continue." },
				requestId,
				limitHeaders,
			);
		}

		// Capability gating happens once, in `GET /api/session`: the UI disables the
		// affected surface there. Per-request probes would add a round trip to every
		// call, and RLS already refuses anything the caller may not do.
		const data = await route.handler(ctx, params);
		return success(data, requestId, limitHeaders);
	} catch (error) {
		if (error instanceof ApiFailure) {
			if (error.status >= 500)
				log("error", requestId, error.message, { code: error.code });
			return failureToResponse(
				{ code: error.code, message: error.message, details: error.details },
				requestId,
				limitHeaders,
			);
		}
		const mapped = mapUnknownError(error, "request");
		log("error", requestId, mapped.message, {
			code: mapped.code,
			path: url.pathname,
		});
		return failureToResponse(mapped, requestId, limitHeaders);
	}
}

function failureToResponse(
	failure: ServerFailure,
	requestId: string,
	extra?: Record<string, string>,
): Response {
	return failureResponse(failure, requestId, extra);
}

/**
 * Shared helpers for the JSON API under `src/routes/api/**`.
 *
 * These exist so each route handler stays a few lines long and, more
 * importantly, so that *validation*, *identity* and *error shaping* cannot be
 * forgotten in one route while present in the others.
 */

import { z } from "zod";
import { logError } from "#/lib/logger";
import type { Caller } from "#/lib/supabase-auth.server";
import { ApiError, parseJsonBody, safeDeepLink } from "#/middleware";
import { type UserRow, users } from "#/schema";

export { z };

/* --------------------------------- identity --------------------------------- */

/** The caller must be signed in. `withSecurity` already proved the token. */
export function requireCaller(caller: Caller | null): Caller {
	if (!caller) throw new ApiError(401, "Sign in to continue");
	return caller;
}

/**
 * A Supabase user id is a UUID and every app table FKs to `public.users.id`.
 * A freshly created auth user without a profile row must fail as a 409 with an
 * actionable message, not as a raw driver error in a 500.
 *
 * Codes are Postgres' own (`23503` foreign key, `23505` unique) because the
 * data layer is Drizzle over `postgres.js` now; they used to be Prisma's
 * `P2003`/`P2002`, which no longer surface at all.
 */
export function isMissingProfileError(error: unknown): boolean {
	const code = (error as { code?: string } | null)?.code;
	return code === "23503" || code === "23505";
}

/** Same shape, different intent: a duplicate write we can report as a conflict. */
export function isDuplicateError(error: unknown): boolean {
	return (error as { code?: string } | null)?.code === "23505";
}

/**
 * A `405` that says which verbs exist, for the methods a route does not declare.
 *
 * TanStack Start answers an undeclared method on a declared path with the SPA
 * shell: `PUT /api/wallet` used to return `200 text/html`, and any caller that
 * only checks `res.ok` reads that as success. `OPTIONS` is deliberately not
 * declared here — the CORS middleware owns preflight, and shadowing it would
 * break every browser call to the route.
 */
export function methodNotAllowed(allowed: string) {
	return async ({ request }: { request: Request }): Promise<Response> => {
		const path = new URL(request.url).pathname;
		return new Response(
			JSON.stringify({
				error: `${request.method} is not supported on ${path}`,
				allowed: allowed.split(", "),
			}),
			{
				status: 405,
				headers: {
					allow: allowed,
					"content-type": "application/json; charset=utf-8",
				},
			},
		);
	};
}

export function unexpected(context: string, error: unknown): Response {
	logError(`api/${context}`, error);
	return new Response(
		JSON.stringify({ error: "Something went wrong. Please try again." }),
		{
			status: 500,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		},
	);
}

/* --------------------------------- validation -------------------------------- */

/**
 * Parse the JSON body and run it through a Zod schema.
 *
 * The routes previously hand-declared `bodyResult.data.action?: string` and
 * then checked lengths by hand, which let a wrong *type* (e.g. `capacity: "all"`)
 * reach Prisma as `Number("all") = NaN`. Schema-first parsing rejects it at the
 * edge and narrows the type for the handler.
 */
export async function readJson<T extends z.ZodType>(
	request: Request,
	schema: T,
	maxBytes?: number,
): Promise<z.output<T>> {
	const result = await parseJsonBody<unknown>(request, maxBytes);
	if (!result.ok)
		throw new ApiError(
			result.response.status,
			await bodyErrorMessage(result.response),
		);
	const parsed = schema.safeParse(result.data);
	if (!parsed.success) {
		const first = parsed.error.issues[0];
		const path = first?.path.length ? first.path.join(".") : "body";
		throw new ApiError(400, `${path}: ${first?.message ?? "invalid value"}`);
	}
	return parsed.data;
}

async function bodyErrorMessage(response: Response): Promise<string> {
	try {
		const payload = (await response.clone().json()) as { error?: string };
		return payload.error ?? "Invalid request";
	} catch {
		return "Invalid request";
	}
}

/* ---------------------------------- paging ---------------------------------- */

export const paginationSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(50),
	cursor: z.string().uuid().optional(),
});

/** Read `?limit=&cursor=` without letting a client ask for the whole table. */
export function readPagination(url: URL): { limit: number; cursor?: string } {
	const parsed = paginationSchema.safeParse({
		limit: url.searchParams.get("limit") ?? undefined,
		cursor: url.searchParams.get("cursor") ?? undefined,
	});
	if (!parsed.success) return { limit: 50 };
	return parsed.data;
}

/* ------------------------------- text shaping ------------------------------- */

/** Collapse runs of whitespace and drop control chars from user text. */
export function cleanText(
	value: string | null | undefined,
	max = 5000,
): string {
	// Control characters (U+0000–U+001F and DEL) are stripped so a pasted bio
	// cannot smuggle terminal escapes into a log line or a `contenteditable`.
	// `\p{Cc}` is the same set written as a Unicode property, which keeps the
	// literal escapes out of the pattern.
	return (value ?? "")
		.replace(/\p{Cc}/gu, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, max);
}

/** `deepLink` guard re-exported so routes never hand-write a URL to the DOM. */
export function notificationLink(value: unknown): string | null {
	return safeDeepLink(value);
}

/* ------------------------------ shared fragments ----------------------------- */

/**
 * The subset of `public.users` an API response may embed about *another*
 * person. Kept in one place so a route cannot accidentally `select *` and ship
 * `email`, `phone`, precise coordinates or `password_hash` inside a list of
 * nearby users. Drizzle takes column references, not `{ col: true }`.
 */
export const publicProfileSelection = {
	id: users.id,
	displayName: users.displayName,
	handle: users.handle,
	avatar: users.avatar,
	online: users.online,
	lastActiveAt: users.lastActiveAt,
	city: users.city,
	area: users.area,
	/**
	 * Not decoration, and not optional: `publicProfile()` is used for *other*
	 * people (an event's host, a MeetNow post's author), and it used to publish
	 * `lastSeen` for all of them with no regard for either presence switch. A
	 * shaper cannot honour a column its select list never asked for, so the two
	 * flags travel with the fields they gate.
	 */
	hideOnline: users.hideOnline,
	hideLastOnline: users.hideLastOnline,
};

/** Row shape produced by `publicProfileSelection`. */
export type PublicProfileRow = Pick<
	UserRow,
	keyof typeof publicProfileSelection
>;

/**
 * Shape a profile row for the browser.
 *
 * The old inline mappers hardcoded `status: "online"` and
 * `geo: { lat: 0, lng: 0 }`, which (a) told every client that every user was
 * online and (b) dropped offline-but-located people on Null Island in the Gulf
 * of Guinea. Presence and coordinates are now derived from the row, and only
 * the coarsened city/area pair is exposed.
 */
export function publicProfile(row: PublicProfileRow | null | undefined) {
	if (!row) return undefined;
	return {
		id: row.id,
		pseudo: row.displayName ?? "",
		nick: row.handle ?? "",
		avatar: row.avatar ?? null,
		photos: row.avatar ? [row.avatar] : [],
		// `hide_online` covers live presence, `hide_last_online` covers the moment
		// they were here. `lastActiveAt` is the same fact twice — an "offline"
		// status beside a "last seen 4 minutes ago" reads straight through the
		// switch, so both fields are gated by the row, not by the caller asking
		// nicely.
		online: (row.online ?? false) && !row.hideOnline,
		status:
			row.online && !row.hideOnline
				? ("online" as const)
				: ("offline" as const),
		lastSeen: row.hideLastOnline ? null : (row.lastActiveAt?.toISOString() ?? null),
		geo: row.city ? { city: row.city, area: row.area ?? null } : undefined,
	};
}

/**
 * `users.interests`, `tribes`, `languages`, `photos`, `tag_codes` and
 * `meetnow_posts.tags` are `jsonb` string arrays, but legacy rows (and every
 * export that went through the old Prisma `String` mapping) hold a JSON
 * *string* or a comma-joined list. Rendering any of those directly put
 * `[object Object]` into chips. Always returns `string[]`.
 *
 * Numeric entries are kept as their text form: `users.tribes` holds tribe
 * names for anyone who joined through `/tribes` and numeric ids for anyone
 * who used the profile editor, so a comparison that dropped numbers would
 * silently score half the app's users as having no tags at all.
 */
export function asStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.map((item) =>
				typeof item === "string"
					? item
					: typeof item === "number" && Number.isFinite(item)
						? String(item)
						: "",
			)
			.filter((item) => item.length > 0);
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return [];
		if (trimmed.startsWith("[")) {
			try {
				return asStringArray(JSON.parse(trimmed));
			} catch {
				/* not JSON — fall through to comma splitting */
			}
		}
		return trimmed
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
	}
	return [];
}

/* ----------------------------- profile cards ------------------------------- */

/**
 * The columns `GET /api/discover` and `GET /api/interest/*` may return about
 * another person. Same rule as `publicProfileSelection`: never `select *`, never
 * `email`/`phone`/`password_hash`, never a precise fix.
 */
export const cardSelection = {
	...publicProfileSelection,
	age: users.age,
	status: users.status,
	verification: users.verification,
	hideDistance: users.hideDistance,
	hideOnline: users.hideOnline,
	hideLastOnline: users.hideLastOnline,
	/**
	 * Not a display field: `incognito` is what makes a profile invisible to
	 * browse/deck queries, so every list endpoint needs the flag to honour it.
	 */
	incognito: users.incognito,
	latCoarse: users.latCoarse,
	lngCoarse: users.lngCoarse,
	lastSeen: users.lastSeen,
};

export type CardRow = Pick<UserRow, keyof typeof cardSelection>;

/**
 * Everything a public profile sheet may show. Still no email, phone, precise
 * fix, `password_hash` (dropped by `0018`), `role` or `tier`: a profile page is
 * the single most scraped surface in the app.
 */
export const profileDetailSelection = {
	...cardSelection,
	bio: users.bio,
	occupation: users.occupation,
	relationshipStatus: users.relationshipStatus,
	pronouns: users.pronouns,
	bodyType: users.bodyType,
	height: users.height,
	weight: users.weight,
	photos: users.photos,
	tribes: users.tribes,
	interests: users.interests,
	lookingFor: users.lookingFor,
	position: users.position,
	languages: users.languages,
	visible: users.visible,
	hidden: users.hidden,
	isSuspended: users.isSuspended,
	profileComplete: users.profileComplete,
};

export type ProfileDetailRow = Pick<
	UserRow,
	keyof typeof profileDetailSelection
>;

/** `last_active_at` older than this means "offline", whatever `online` says. */
export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Map a row to the shape `InterestProfile` / `Candidate` expect.
 *
 * `distance` is in km and only ever computed from the *coarsened* coordinates
 * (both sides) — a precise distance would leak a home address through a
 * discovery list, which is why the columns are `lat_coarse`/`lng_coarse`.
 * `hide_distance` and `hide_online` are honoured instead of being invented.
 */
export function toProfileCard(
	row: CardRow,
	viewer?: { lat: number; lng: number } | null,
) {
	const shown =
		row.online === true &&
		Date.now() - (row.lastActiveAt?.getTime() ?? 0) < PRESENCE_WINDOW_MS;
	// "Active recently" *is* last-online information: `status` is derived from the
	// same timestamp the switch hides, so hiding `lastSeen` alone would leave the
	// number on the screen in a different field. With either flag set, the strongest
	// statement left is "offline".
	const hideActivity = row.hideOnline || row.hideLastOnline;
	const status: "online" | "active" | "offline" = hideActivity
		? "offline"
		: shown
			? "online"
			: Date.now() - (row.lastActiveAt?.getTime() ?? 0) < 48 * 60 * 60 * 1000
				? "active"
				: "offline";
	return {
		id: row.id,
		name: cleanText(row.displayName, 64) || row.handle || "Someone",
		nick: row.handle ?? "",
		age: row.age ?? 0,
		photo: row.avatar ?? "",
		photos: row.avatar ? [row.avatar] : [],
		city: row.city ?? undefined,
		area: row.area ?? undefined,
		distance:
			row.hideDistance ||
			!viewer ||
			row.latCoarse == null ||
			row.lngCoarse == null
				? null
				: Math.round(
						haversineKm(viewer.lat, viewer.lng, row.latCoarse, row.lngCoarse) *
							10,
					) / 10,
		status,
		online: shown && !row.hideOnline,
		verified: (row.verification ?? 0) >= 2,
		lastSeen: row.hideLastOnline
			? null
			: row.lastSeen?.toISOString() ?? null,
	};
}

/** Standard great-circle distance; `lat_coarse`/`lng_coarse` are ~250 m apart. */
export function haversineKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

import { createHash } from "node:crypto";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { type DbLike, db } from "@/db";
import { logError } from "@/lib/logger";
import { sessions } from "@/schema";

/**
 * Device sessions: what `/api/auth/sessions` lists and `/api/auth/logout` ends.
 *
 * WHY THE ROW IS KEYED BY A HASH
 * ------------------------------
 * `public.sessions` (0010) stored `token text unique not null` — one live bearer
 * token per row, in plaintext, in a table any query could read. 0032 replaces it with
 * `token_hash`: enough to recognise the request that owns a row, useless to replay.
 * Nothing in this module ever returns the hash to a client either; a session list
 * describes devices, not credentials.
 *
 * WHY A SERVER MODULE AND NOT THE ROUTE
 * -------------------------------------
 * Two endpoints touch sessions (list/revoke and logout) and a third fact needs the
 * same code — "is this token's session revoked?", which is what makes a logout take
 * effect instead of merely being displayed. One module, so the answer cannot differ
 * between them.
 */

const SCOPE = "auth/sessions";

/** A session lives as long as a refresh token would; 30 days is the provider's own horizon. */
export const SESSION_TTL_DAYS = 30;

/**
 * How often one token may move `last_seen_at`.
 *
 * Every authenticated request could touch its row, which would make the sessions
 * table the busiest writer in the database for a column whose only reader shows
 * "active 3 minutes ago". A minute of granularity is indistinguishable in that UI.
 */
const TOUCH_THROTTLE_MS = 60_000;

export type SessionView = {
	id: string;
	device: string | null;
	userAgent: string | null;
	ip: string | null;
	kind: string;
	createdAt: string | null;
	lastSeenAt: string | null;
	expiresAt: string | null;
	revokedAt: string | null;
	/** True for the row belonging to the token making the request. */
	current: boolean;
};

/** sha256 hex of a bearer token — the row's identity, and the only form stored. */
export function tokenFingerprint(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

/** Read the `exp` claim without verifying: `withSecurity` already did that. */
function tokenExpiry(token: string): Date | null {
	try {
		const [, payload] = token.split(".");
		if (!payload) return null;
		const json = Buffer.from(payload, "base64url").toString("utf8");
		const claims = JSON.parse(json) as { exp?: unknown };
		if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp))
			return null;
		const at = new Date(claims.exp * 1000);
		return Number.isNaN(at.getTime()) ? null : at;
	} catch {
		return null;
	}
}

/** Device family and platform, from the user agent. No dependency, no guessing beyond it. */
export function describeClient(userAgent: string | null): {
	device: string;
	kind: "web" | "ios" | "android" | "unknown";
} {
	const ua = (userAgent ?? "").toLowerCase();
	if (!ua) return { device: "Unknown device", kind: "unknown" };
	if (ua.includes("iphone")) return { device: "iPhone", kind: "ios" };
	if (ua.includes("ipad")) return { device: "iPad", kind: "ios" };
	if (ua.includes("android"))
		return {
			device: ua.includes("mobile") ? "Android phone" : "Android tablet",
			kind: "android",
		};
	if (ua.includes("edg/")) return { device: "Windows · Edge", kind: "web" };
	if (ua.includes("chrome") && ua.includes("mac os"))
		return { device: "Mac · Chrome", kind: "web" };
	if (ua.includes("safari") && ua.includes("mac os"))
		return { device: "Mac · Safari", kind: "web" };
	if (ua.includes("firefox")) return { device: "Firefox", kind: "web" };
	if (ua.includes("windows")) return { device: "Windows", kind: "web" };
	if (ua.includes("mac os")) return { device: "Mac", kind: "web" };
	if (ua.includes("linux")) return { device: "Linux", kind: "web" };
	return { device: "Unknown device", kind: "unknown" };
}

function toView(
	row: typeof sessions.$inferSelect,
	currentHash: string | null,
): SessionView {
	return {
		id: row.id,
		device: row.device ?? null,
		userAgent: row.userAgent ?? null,
		ip: row.ip ?? null,
		kind: row.kind ?? "web",
		createdAt: row.createdAt?.toISOString() ?? null,
		lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
		expiresAt: row.expiresAt?.toISOString() ?? null,
		revokedAt: row.revokedAt?.toISOString() ?? null,
		current: currentHash !== null && row.tokenHash === currentHash,
	};
}

/**
 * Record that this token is in use, creating its row on first sight.
 *
 * Returns `null` for a revoked session: a row that was ended stays ended, and the
 * caller (the logout route, or a future middleware check) decides what that means.
 */
export async function touchSession(
	params: {
		userId: string;
		token: string;
		userAgent?: string | null;
		ip?: string | null;
	},
	tx: DbLike = db,
): Promise<SessionView | null> {
	const { userId, token } = params;
	const tokenHash = tokenFingerprint(token);
	const now = new Date();

	const [existing] = await tx
		.select()
		.from(sessions)
		.where(eq(sessions.tokenHash, tokenHash))
		.limit(1);

	if (existing) {
		if (existing.revokedAt) return null;
		// A token that presents a different account than the row it was minted for is
		// either a reused hash or a bug. Neither is answered by silently adopting it.
		if (existing.userId !== userId) {
			logError(SCOPE, new Error("session token presented by another account"), {
				sessionId: existing.id,
			});
			return null;
		}
		const stale =
			!existing.lastSeenAt ||
			now.getTime() - existing.lastSeenAt.getTime() > TOUCH_THROTTLE_MS;
		if (stale) {
			const [updated] = await tx
				.update(sessions)
				.set({
					lastSeenAt: now,
					ip: params.ip ?? existing.ip,
					updatedAt: now,
				})
				.where(eq(sessions.id, existing.id))
				.returning();
			return toView(updated ?? { ...existing, lastSeenAt: now }, tokenHash);
		}
		return toView(existing, tokenHash);
	}

	const described = describeClient(params.userAgent ?? null);
	const expiresAt =
		tokenExpiry(token) ??
		new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000);

	try {
		const [inserted] = await tx
			.insert(sessions)
			.values({
				userId,
				tokenHash,
				device: described.device,
				userAgent: (params.userAgent ?? null)?.slice(0, 400),
				ip: params.ip ?? null,
				kind: described.kind,
				expiresAt,
				lastSeenAt: now,
			})
			.returning();
		return toView(inserted, tokenHash);
	} catch (error) {
		// Two tabs, same token, same instant: the unique index settles it and the
		// loser reads the winner's row rather than failing the request.
		const [raced] = await tx
			.select()
			.from(sessions)
			.where(eq(sessions.tokenHash, tokenHash))
			.limit(1);
		if (raced) return toView(raced, tokenHash);
		logError(SCOPE, error, { stage: "insert" });
		return null;
	}
}

/** Live and revoked sessions for one account, most recently active first. */
export async function listSessions(
	userId: string,
	currentToken: string | null,
	tx: DbLike = db,
): Promise<SessionView[]> {
	const currentHash = currentToken ? tokenFingerprint(currentToken) : null;
	const rows = await tx
		.select()
		.from(sessions)
		.where(eq(sessions.userId, userId))
		.orderBy(
			sql`${sessions.lastSeenAt} desc nulls last`,
			desc(sessions.createdAt),
		)
		.limit(50);
	return rows.map((row) => toView(row, currentHash));
}

/** Revoke one session by id. Returns false when it is not this account's. */
export async function revokeSession(
	userId: string,
	sessionId: string,
	tx: DbLike = db,
): Promise<boolean> {
	const [row] = await tx
		.update(sessions)
		.set({ revokedAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(sessions.id, sessionId),
				eq(sessions.userId, userId),
				isNull(sessions.revokedAt),
			),
		)
		.returning({ id: sessions.id });
	return Boolean(row);
}

/** Revoke every session except the caller's own: "sign out other devices". */
export async function revokeOtherSessions(
	userId: string,
	currentToken: string,
	tx: DbLike = db,
): Promise<number> {
	const rows = await tx
		.update(sessions)
		.set({ revokedAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(sessions.userId, userId),
				isNull(sessions.revokedAt),
				ne(sessions.tokenHash, tokenFingerprint(currentToken)),
			),
		)
		.returning({ id: sessions.id });
	return rows.length;
}

/** Revoke the caller's own session: what logout does. */
export async function revokeCurrentSession(
	token: string,
	tx: DbLike = db,
): Promise<boolean> {
	const [row] = await tx
		.update(sessions)
		.set({ revokedAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(sessions.tokenHash, tokenFingerprint(token)),
				isNull(sessions.revokedAt),
			),
		)
		.returning({ id: sessions.id });
	return Boolean(row);
}

/**
 * Sessions that have outlived their expiry and were never revoked.
 *
 * Reported rather than deleted: the row is the record that a device was signed in,
 * and pruning it is a retention decision for an operator, not a side effect of a
 * GET. `/api/auth/sessions` uses this to mark them expired in the response.
 */
export async function expiredSessionCount(
	userId: string,
	tx: DbLike = db,
): Promise<number> {
	const [row] = await tx
		.select({ n: sql<number>`count(*)::int` })
		.from(sessions)
		.where(
			and(
				eq(sessions.userId, userId),
				isNull(sessions.revokedAt),
				sql`${sessions.expiresAt} < now()`,
			),
		);
	return Number(row?.n ?? 0);
}

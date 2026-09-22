import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { distinctUtcDays } from "@/lib/growth";
import { messages, sessions } from "@/schema";

/**
 * Which days a user was actually here.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `/api/growth/streak` answered from a hardcoded array of "today, yesterday, the day
 * before", so every account in the product had a three-day login streak and the
 * celebration, the at-risk warning and the retention notification built on it were all
 * about a number nobody had earned. The comment above that array said a production
 * build would query `audit_events` or presence logs; `audit_events` exists and nothing
 * has ever written to it, and there is no presence table.
 *
 * These two are written by the running app: `sessions` rows are created on sign-in and
 * touched on each authenticated request (`#/lib/auth-sessions.server`), and `messages`
 * rows are chat. A day with either counts as a day here. Nothing is inferred, nothing
 * is estimated, and a user who has not opened the app has an empty list and a streak of
 * zero.
 */

/** How far back activity is counted. Beyond this the streak is 0 regardless. */
export const ACTIVITY_WINDOW_DAYS = 90;

type DbLike = typeof db;

/**
 * Distinct UTC days on which the user signed in or sent a message, newest first.
 *
 * Deliberately narrow: browsing without a session row is not counted, because there is
 * no table that records it. Widening this later means adding a source here, not
 * guessing from `users.last_seen`.
 */
export async function activityDays(
	userId: string,
	windowDays: number = ACTIVITY_WINDOW_DAYS,
	tx: DbLike = db,
): Promise<string[]> {
	const since = new Date(Date.now() - windowDays * 86_400_000);

	const [sessionRows, messageRows] = await Promise.all([
		tx
			.select({ createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt })
			.from(sessions)
			// Both windows are filtered in SQL: a chat-heavy account can have tens of
			// thousands of message rows and only the last 90 days can affect a streak.
			.where(and(eq(sessions.userId, userId), gte(sessions.createdAt, since))),
		tx
			.select({ createdAt: messages.createdAt })
			.from(messages)
			.where(
				and(
					eq(messages.senderId, userId),
					isNull(messages.unsentAt),
					gte(messages.createdAt, since),
				),
			),
	]);

	const stamps = [
		...sessionRows.flatMap((row) => [row.createdAt, row.lastSeenAt]),
		...messageRows.map((row) => row.createdAt),
		// `last_seen_at` is not in a WHERE clause — it belongs to a session created
		// earlier — so it is windowed here.
	].filter((value): value is Date => value instanceof Date && value.getTime() >= since.getTime());

	return distinctUtcDays(stamps);
}

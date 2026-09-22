import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityDays } from "@/lib/activity.server";
import { calculateStreak } from "@/lib/growth";
import { challengeParticipants, challenges, eventRsvps, groupRoles, users } from "@/schema";

/**
 * How far along a user is in a challenge.
 *
 * WHY PROGRESS IS COMPUTED AND NOT STORED
 * ---------------------------------------
 * `challenge_participants` records that somebody joined, finished and was paid. It does
 * not record a counter, because a counter is a second copy of a fact that already lives
 * somewhere: days active live in `sessions` and `messages`, profile completeness in
 * `users.profile_complete`, event attendance in `event_rsvps`, group membership in
 * `group_roles`. Two copies disagree, and the disagreement is always reported by the
 * person who did the thing and was not credited. Reading the source also means the count
 * goes *down* when it should — cancelling an RSVP or leaving a group lowers progress,
 * which a stored counter would have to be told about.
 */

export type ChallengeKind = "streak" | "profile" | "events" | "community";

export const CHALLENGE_KINDS: readonly ChallengeKind[] = [
	"streak",
	"profile",
	"events",
	"community",
] as const;

/** Shown in the UI next to each bar, so the number has a stated source. */
export const PROGRESS_SOURCE: Record<ChallengeKind, string> = {
	streak: "consecutive days you signed in or sent a message",
	profile: "your profile completeness meter",
	events: "events you are going to",
	community: "groups you are a member of",
};

export function isChallengeKind(value: unknown): value is ChallengeKind {
	return typeof value === "string" && (CHALLENGE_KINDS as readonly string[]).includes(value);
}

type DbLike = typeof db;

/** The current number for one kind. Never exceeds what the source says. */
export async function challengeProgress(
	kind: ChallengeKind,
	userId: string,
	tx: DbLike = db,
): Promise<number> {
	switch (kind) {
		case "streak":
			return calculateStreak(await activityDays(userId, undefined, tx)).count;
		case "profile": {
			const [row] = await tx
				.select({ percent: users.profileComplete })
				.from(users)
				.where(eq(users.id, userId));
			return Number(row?.percent ?? 0);
		}
		case "events": {
			const [row] = await tx
				.select({ n: count() })
				.from(eventRsvps)
				.where(eq(eventRsvps.profileId, userId));
			return Number(row?.n ?? 0);
		}
		case "community": {
			const [row] = await tx
				.select({ n: count() })
				.from(groupRoles)
				.where(eq(groupRoles.userId, userId));
			return Number(row?.n ?? 0);
		}
	}
}

/**
 * Progress for every kind, once each.
 *
 * A challenge list of four rows would otherwise run four queries per row and three of
 * them would ask the same question; this asks each kind once and reuses the answer.
 */
export async function allChallengeProgress(
	userId: string,
	tx: DbLike = db,
): Promise<Record<ChallengeKind, number>> {
	const [streak, profile, events, community] = await Promise.all([
		challengeProgress("streak", userId, tx),
		challengeProgress("profile", userId, tx),
		challengeProgress("events", userId, tx),
		challengeProgress("community", userId, tx),
	]);
	return { streak, profile, events, community };
}

export type { challengeParticipants, challenges };

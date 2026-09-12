import { and, eq, or } from "drizzle-orm";
import { db } from "#/db";
import { blocks, matches, notifications, taps, users } from "#/schema";

/**
 * The single tap engine behind both `POST /api/discover` and `POST /api/taps`.
 *
 * Extracted because the deck and the profile modal are two entry points for the
 * same action; keeping two copies meant they drifted (the profile modal also
 * wanted `isMatch`, and neither checked whether a block existed). Everything
 * that decides "did we just match" happens inside one transaction, so two
 * people tapping at the same moment cannot both miss the match.
 */
export type TapKind = "like" | "woof";

export type TapOutcome =
	| { status: "blocked" }
	| { status: "not_found" }
	| { status: "ok"; matched: boolean; firstTap: boolean; kind: TapKind };

/** A block in either direction ends the interaction, silently and permanently. */
export async function isBlocked(a: string, b: string): Promise<boolean> {
	const [row] = await db
		.select({ id: blocks.id })
		.from(blocks)
		.where(
			or(
				and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
				and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
			),
		)
		.limit(1);
	return Boolean(row);
}

export async function recordTap(params: {
	/** The signed-in user, already verified by `requireCaller`. */
	userId: string;
	targetId: string;
	kind: TapKind;
}): Promise<TapOutcome> {
	const { userId, targetId, kind } = params;

	const [target] = await db
		.select({ id: users.id, displayName: users.displayName })
		.from(users)
		.where(and(eq(users.id, targetId), eq(users.isSuspended, false)))
		.limit(1);
	if (!target) return { status: "not_found" };
	if (await isBlocked(userId, target.id)) return { status: "blocked" };

	const result = await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(taps)
			.values({
				tapperId: userId,
				tappedId: target.id,
				type: kind,
				isSuper: kind === "woof",
			})
			.onConflictDoNothing({ target: [taps.tapperId, taps.tappedId] })
			.returning({ id: taps.id });

		const [reverse] = await tx
			.select({ id: taps.id })
			.from(taps)
			.where(and(eq(taps.tapperId, target.id), eq(taps.tappedId, userId)))
			.limit(1);
		if (!reverse) return { matched: false, firstTap: inserted.length > 0 };

		const [a, b] =
			userId < target.id ? [userId, target.id] : [target.id, userId];
		const created = await tx
			.insert(matches)
			.values({ userA: a, userB: b })
			.onConflictDoNothing()
			.returning({ id: matches.id });
		if (created.length > 0) {
			// Notification copy is personalised and points at the chat list, which is
			// where the "It's a match" toast tells the user to go.
			const [me] = await tx
				.select({ displayName: users.displayName })
				.from(users)
				.where(eq(users.id, userId))
				.limit(1);
			const myName = me?.displayName?.trim() || "Someone";
			await tx.insert(notifications).values([
				{
					userId,
					type: "match",
					title: "It's a match",
					body: `You and ${target.displayName || "someone"} both tapped. Say hi.`,
					href: "/chat",
					read: false,
					actorId: target.id,
				},
				{
					userId: target.id,
					type: "match",
					title: "It's a match",
					body: `You and ${myName} both tapped. Say hi.`,
					href: "/chat",
					read: false,
					actorId: userId,
				},
			]);
		}
		return { matched: true, firstTap: inserted.length > 0 };
	});

	void name;
	return { status: "ok", ...result, kind };
}

import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import {
	allChallengeProgress,
	isChallengeKind,
	PROGRESS_SOURCE,
} from "@/lib/challenges.server";
import { postLedger } from "@/lib/wallet.server";
import { json, jsonError, withSecurity } from "@/middleware";
import { challengeParticipants, challenges } from "@/schema";

/**
 * `GET|POST /api/growth/challenges` — the community challenges list, joining one, and
 * claiming its reward.
 *
 * THE GAP THIS CLOSES
 * -------------------
 * `/community-challenges` fetched `/api/community-challenges`, which did not exist, and
 * the only counter the app could show came from `/api/growth/streak` inventing three
 * timestamps. `0033` adds `challenges` and `challenge_participants`; this route is the
 * API over them.
 *
 * RULES
 * -----
 * - Progress is computed on read (`#/lib/challenges.server`), never stored, so a
 *   cancelled RSVP or a left group lowers the bar again instead of leaving a number
 *   nobody can account for.
 * - Only challenges whose window is open are listed.
 * - Claiming happens in one transaction that writes `reward_claimed_at` and posts the
 *   ledger entry with `challenge:<id>:<user>` as its idempotency key. Two devices
 *   claiming at once credit one reward: whichever transaction commits second finds the
 *   key already used and gets a 409, not a second payment.
 * - A reward of 0 bones is allowed (a badge-only challenge) and claims without touching
 *   the ledger, because `postLedger` rejects a zero amount.
 */

/** One of two shapes, so `if ("error" in result)` is a real discriminant. */
type ClaimResult = { error: string } | { balance: number | null };

const actionSchema = z
	.object({
		action: z.enum(["join", "claim"]),
		challengeId: z.uuid(),
	})
	.strict();

export const Route = createFileRoute("/api/growth/challenges/")({
	server: {
		handlers: {
			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),

			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					try {
						const now = new Date();
						const [rows, participation] = await Promise.all([
							db
								.select()
								.from(challenges)
								.where(and(lte(challenges.startsAt, now), gte(challenges.endsAt, now)))
								.orderBy(challenges.endsAt),
							db
								.select()
								.from(challengeParticipants)
								.where(eq(challengeParticipants.userId, user.id)),
						]);

						const joined = new Map(participation.map((row) => [row.challengeId, row]));
						const progress = await allChallengeProgress(user.id);

						const items = rows.map((challenge) => {
							const kind = isChallengeKind(challenge.kind) ? challenge.kind : null;
							const mine = joined.get(challenge.id);
							const raw = kind ? progress[kind] : 0;
							const value = Math.max(0, Math.min(raw, challenge.targetCount));
							return {
								id: challenge.id,
								slug: challenge.slug,
								title: challenge.title,
								description: challenge.description,
								kind: challenge.kind,
								targetCount: challenge.targetCount,
								rewardBones: challenge.rewardBones,
								endsAt: challenge.endsAt.toISOString(),
								joined: mine !== undefined,
								joinedAt: mine?.joinedAt.toISOString() ?? null,
								progress: value,
								complete: value >= challenge.targetCount,
								completedAt: mine?.completedAt?.toISOString() ?? null,
								rewardClaimedAt: mine?.rewardClaimedAt?.toISOString() ?? null,
								// Stated rather than implied: the bar counts this and nothing else.
								source: kind ? PROGRESS_SOURCE[kind] : "unknown goal kind",
							};
						});

						return json({ items, total: items.length });
					} catch (error) {
						return unexpected("growth/challenges/GET", error);
					}
				},
				{ rateLimit: { limit: 60, key: ({ caller }) => `challenges:${caller?.id ?? "anon"}` } },
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					let body: z.infer<typeof actionSchema>;
					try {
						body = await readJson(request, actionSchema, 4 * 1024);
					} catch (error) {
						if (error instanceof Error && error.name === "ApiError") throw error;
						return unexpected("growth/challenges/POST", error);
					}

					try {
						const now = new Date();
						const [challenge] = await db
							.select()
							.from(challenges)
							.where(
								and(
									eq(challenges.id, body.challengeId),
									lte(challenges.startsAt, now),
									gte(challenges.endsAt, now),
								),
							)
							.limit(1);
						if (!challenge) return jsonError("That challenge is not running", 404);
						// Narrowed once into a local: `challenge.kind` is a `text` column, so
						// without this the progress lookup below is indexing by an arbitrary
						// string and TypeScript cannot check the key exists.
						const kind = challenge.kind;
						if (!isChallengeKind(kind))
							return jsonError("That challenge has a goal this build cannot count", 422);

						if (body.action === "join") {
							await db
								.insert(challengeParticipants)
								.values({ challengeId: challenge.id, userId: user.id })
								.onConflictDoNothing({
									target: [
										challengeParticipants.challengeId,
										challengeParticipants.userId,
									],
								});
							const progress = await allChallengeProgress(user.id);
							const value = Math.max(0, Math.min(progress[kind], challenge.targetCount));
							return json({ ok: true, joined: true, progress: value });
						}

						// claim
						const result = await db.transaction(
							async (tx): Promise<ClaimResult> => {
							const [mine] = await tx
								.select()
								.from(challengeParticipants)
								.where(
									and(
										eq(challengeParticipants.challengeId, challenge.id),
										eq(challengeParticipants.userId, user.id),
									),
								)
								.limit(1);
							if (!mine) return { error: "Join the challenge first" as const };
							if (mine.rewardClaimedAt)
								return { error: "That reward is already claimed" as const };

							const progress = await allChallengeProgress(user.id, tx);
							const value = Math.max(0, Math.min(progress[kind], challenge.targetCount));
							if (value < challenge.targetCount)
								return {
									error: `Not finished yet — ${value} of ${challenge.targetCount}` as const,
								};

							let balance: number | null = null;
							if (challenge.rewardBones > 0) {
								const posted = await postLedger(
									{
										userId: user.id,
										type: "bonus",
										amount: challenge.rewardBones,
										description: `Challenge: ${challenge.title}`,
										source: "challenge",
										idempotencyKey: `challenge:${challenge.id}:${user.id}`,
									},
									tx,
								);
								// `null` means the idempotency key was already used: a second
								// claim from another device, or a retry. Not an error to the
								// user, but not a second payment either.
								if (!posted) return { error: "That reward is already claimed" as const };
								balance = posted.balance;
							}

							await tx
								.update(challengeParticipants)
								.set({ completedAt: mine.completedAt ?? now, rewardClaimedAt: now })
								.where(
									and(
										eq(challengeParticipants.challengeId, challenge.id),
										eq(challengeParticipants.userId, user.id),
									),
								);

							return { balance };
							},
						);

						if ("error" in result) return jsonError(result.error, 409);
						return json({
							ok: true,
							claimed: true,
							rewardBones: challenge.rewardBones,
							balance: result.balance,
						});
					} catch (error) {
						return unexpected("growth/challenges/POST", error);
					}
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: { limit: 20, key: ({ caller }) => `challenges:POST:${caller?.id ?? "anon"}` },
				},
			),
		},
	},
});

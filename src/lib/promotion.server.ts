import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { type DbLike, db } from "@/db";
import {
	type PromotionEntityType,
	promotionCost,
	promotionWindow,
} from "@/lib/economy";
import { InsufficientBalance, postLedger } from "@/lib/wallet.server";
import { entityPromotions } from "@/schema";

/**
 * Entity promotion: the money half of `/api/<feature>/<id>/boost`.
 *
 * WHY THIS IS A MODULE AND NOT SIX COPIES
 * --------------------------------------
 * Groups, shouts, activities, fansites, tribes and board posts all want the same
 * thing — pay bones, sit at the top of your own list for a while — and the
 * generated screens already posted to that shape at six different paths. What
 * differs per entity is *ownership* (may this account promote this row?), which
 * the calling handler answers before it calls in. Everything else is identical, so
 * it lives here once: the price comes from `#/lib/economy#promotionCost`, the debit
 * goes through `#/lib/wallet.server#postLedger` (the only writer of `wallet.balance`,
 * which 0019 made derived), and the row is `entity_promotions` (0030).
 *
 * Every function takes a `DbLike` so a caller can put the ownership check, the
 * debit and the promotion row in one transaction. That ordering is the point: a
 * debit that commits while the promotion insert fails takes bones and buys nothing.
 */

export type PromotionOutcome =
	| {
			kind: "promoted";
			id: string;
			entityType: PromotionEntityType;
			entityId: string;
			minutes: number;
			cost: number;
			balance: number;
			startsAt: Date;
			endsAt: Date;
			/** True when this purchase extended a promotion the same account already owned. */
			extended: boolean;
	  }
	| { kind: "insufficient"; cost: number; balance: number }
	| { kind: "held"; heldBy: string; endsAt: Date }
	| { kind: "duplicate" };

type LiveRow = {
	id: string;
	userId: string;
	startsAt: Date | null;
	endsAt: Date;
};

async function findLive(
	entityType: PromotionEntityType,
	entityId: string,
	tx: DbLike,
): Promise<LiveRow | undefined> {
	const [row] = await tx
		.select({
			id: entityPromotions.id,
			userId: entityPromotions.userId,
			startsAt: entityPromotions.startsAt,
			endsAt: entityPromotions.endsAt,
		})
		.from(entityPromotions)
		.where(
			and(
				eq(entityPromotions.entityType, entityType),
				eq(entityPromotions.entityId, entityId),
				gt(entityPromotions.endsAt, new Date()),
			),
		)
		.limit(1);
	return row;
}

/**
 * `entityId → ends_at` for whichever of `ids` are promoted right now.
 *
 * One query for the whole page: asking per row turns a 20-item feed into 20
 * round-trips, and the answer is a set membership test either way.
 */
export async function livePromotions(
	entityType: PromotionEntityType,
	ids: readonly string[],
	tx: DbLike = db,
): Promise<Map<string, Date>> {
	const out = new Map<string, Date>();
	if (ids.length === 0) return out;
	const rows = await tx
		.select({
			entityId: entityPromotions.entityId,
			endsAt: entityPromotions.endsAt,
		})
		.from(entityPromotions)
		.where(
			and(
				eq(entityPromotions.entityType, entityType),
				inArray(entityPromotions.entityId, [...ids]),
				gt(entityPromotions.endsAt, new Date()),
			),
		);
	for (const row of rows) out.set(row.entityId, row.endsAt);
	return out;
}

/**
 * Count one surfacing per promoted entity in a page.
 *
 * `impressions` is what makes the spend auditable: an operator can see that 200
 * bones bought 4 000 surfaces, and a member can be told why their promotion ended
 * early. It is incremented once per list request that returned the row, not once
 * per row render, because the server cannot see renders.
 */
export async function recordPromotionImpressions(
	entityType: PromotionEntityType,
	ids: readonly string[],
	tx: DbLike = db,
): Promise<void> {
	if (ids.length === 0) return;
	await tx
		.update(entityPromotions)
		.set({ impressions: sql`${entityPromotions.impressions} + 1` })
		.where(
			and(
				eq(entityPromotions.entityType, entityType),
				inArray(entityPromotions.entityId, [...ids]),
				gt(entityPromotions.endsAt, new Date()),
			),
		);
}

/**
 * Buy (or extend) a promotion. Call it inside the transaction that checked
 * ownership, so the debit and the row cannot disagree.
 *
 * The partial unique index `entity_promotions_one_live_per_entity` is the authority
 * on "only one live promotion per entity": two simultaneous purchases race, one
 * insert wins, and the loser gets 23505 here rather than a second "first place".
 */
export async function startPromotion(
	params: {
		userId: string;
		entityType: PromotionEntityType;
		entityId: string;
		/** Requested minutes; clamped onto whole 30-minute blocks. */
		minutes?: number | null;
		idempotencyKey?: string;
	},
	tx: DbLike = db,
): Promise<PromotionOutcome> {
	const { userId, entityType, entityId } = params;
	const minutes = promotionWindow(params.minutes);
	const cost = promotionCost(entityType, minutes);
	const now = new Date();
	const endsAt = new Date(now.getTime() + minutes * 60_000);

	const live = await findLive(entityType, entityId, tx);
	if (live && live.userId !== userId)
		return { kind: "held", heldBy: live.userId, endsAt: live.endsAt };

	const entry = await postLedger(
		{
			userId,
			type: "spend",
			amount: -cost,
			description: `Promotion: ${entityType.replace("_", " ")} for ${minutes} minutes`,
			source: `promotion:${entityType}`,
			idempotencyKey: params.idempotencyKey,
		},
		tx,
	);
	// Same idempotency key seen before: the earlier request already charged and
	// already wrote the row. Reporting success again would double-count a purchase.
	if (!entry) return { kind: "duplicate" };

	try {
		if (live) {
			const [row] = await tx
				.update(entityPromotions)
				.set({
					endsAt: new Date(
						Math.max(live.endsAt.getTime(), now.getTime()) + minutes * 60_000,
					),
					cost: sql`${entityPromotions.cost} + ${cost}`,
					extendedAt: now,
				})
				.where(eq(entityPromotions.id, live.id))
				.returning({
					id: entityPromotions.id,
					startsAt: entityPromotions.startsAt,
					endsAt: entityPromotions.endsAt,
				});
			return {
				kind: "promoted",
				id: row.id,
				entityType,
				entityId,
				minutes,
				cost,
				balance: entry.balance,
				startsAt: row.startsAt ?? now,
				endsAt: row.endsAt,
				extended: true,
			};
		}

		const [row] = await tx
			.insert(entityPromotions)
			.values({
				entityType,
				entityId,
				userId,
				startsAt: now,
				endsAt,
				cost,
				currency: "bones",
			})
			.returning({
				id: entityPromotions.id,
				startsAt: entityPromotions.startsAt,
				endsAt: entityPromotions.endsAt,
			});
		return {
			kind: "promoted",
			id: row.id,
			entityType,
			entityId,
			minutes,
			cost,
			balance: entry.balance,
			startsAt: row.startsAt ?? now,
			endsAt: row.endsAt,
			extended: false,
		};
	} catch (error) {
		const code = (error as { code?: string } | null)?.code;
		// Someone else won the race for this entity. The debit is rolled back by the
		// caller's transaction, which is why this must throw rather than return.
		if (code === "23505") throw new PromotionConflict(entityType, entityId);
		throw error;
	}
}

/** Raised when the unique live-promotion index refuses the insert. */
export class PromotionConflict extends Error {
	constructor(
		public readonly entityType: PromotionEntityType,
		public readonly entityId: string,
	) {
		super("That item was promoted by someone else a moment ago");
		this.name = "PromotionConflict";
	}
}

/**
 * Map a `InsufficientBalance` / `PromotionConflict` failure onto the HTTP status the
 * screens already render, so six handlers do not each invent their own wording.
 */
export function promotionFailureStatus(error: unknown): number | null {
	if (error instanceof InsufficientBalance) return 402;
	if (error instanceof PromotionConflict) return 409;
	return null;
}

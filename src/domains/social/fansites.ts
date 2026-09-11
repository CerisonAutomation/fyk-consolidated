// ═══════════════════════════════════════════════════════════════════════════════
// Social — Fansites
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from "../../generated/prisma/client.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FansiteData {
	id: string;
	userId: string;
	displayName: string;
	headline: string;
	bio: string;
	mainPhotoUrl: string;
	packageSize: string;
	city: string;
	availableNow: boolean;
	plusBadge: boolean;
	photos: string[];
	interests: string[];
	tags: string[];
	subscriberCount: number;
	isSubscribed: boolean;
	createdAt: Date;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Subscribes or unsubscribes a user to/from a fansite.
 * Uses notifications as a lightweight subscription tracking mechanism.
 */
export async function subscribeFansite(
	db: PrismaClient,
	fansiteId: string,
	userId: string,
): Promise<{ subscribed: boolean; subscriberCount: number; error?: string }> {
	const fansite = await db.fansite.findUnique({ where: { id: fansiteId } });
	if (!fansite) {
		return { subscribed: false, subscriberCount: 0, error: "Fansite not found" };
	}
	if (fansite.userId === userId) {
		return { subscribed: false, subscriberCount: 0, error: "Cannot subscribe to your own fansite" };
	}

	// Check if already subscribed via raw query on Notification table
	const existingSub = await db.$queryRaw<{ id: string }[]>`
		SELECT id FROM "Notification"
		WHERE "userId" = ${fansite.userId}
		AND "type" = 'fansite_subscribe'
		AND "data"->>'subscriberId' = ${userId}
		AND "data"->>'fansiteId' = ${fansiteId}
		LIMIT 1
	`;

	if (existingSub.length > 0) {
		// Unsubscribe
		await db.$executeRaw`
			DELETE FROM "Notification"
			WHERE "userId" = ${fansite.userId}
			AND "type" = 'fansite_subscribe'
			AND "data"->>'subscriberId' = ${userId}
			AND "data"->>'fansiteId' = ${fansiteId}
		`;

		const countResult = await db.$queryRaw<{ count: number }[]>`
			SELECT COUNT(*)::int as count FROM "Notification"
			WHERE "userId" = ${fansite.userId}
			AND "type" = 'fansite_subscribe'
			AND "data"->>'fansiteId' = ${fansiteId}
		`;

		return {
			subscribed: false,
			subscriberCount: countResult[0]?.count ?? 0,
		};
	}

	// Subscribe
	await db.notification.create({
		data: {
			userId: fansite.userId,
			type: "fansite_subscribe",
			title: "New Subscriber",
			body: "Someone subscribed to your fansite!",
			data: { subscriberId: userId, fansiteId },
			fromUserId: userId,
		},
	});

	const countResult = await db.$queryRaw<{ count: number }[]>`
		SELECT COUNT(*)::int as count FROM "Notification"
		WHERE "userId" = ${fansite.userId}
		AND "type" = 'fansite_subscribe'
		AND "data"->>'fansiteId' = ${fansiteId}
	`;

	return {
		subscribed: true,
		subscriberCount: countResult[0]?.count ?? 1,
	};
}

/**
 * Lists all fansites ordered by subscriber count (descending).
 */
export async function listFansites(
	db: PrismaClient,
): Promise<FansiteData[]> {
	const fansites = await db.fansite.findMany({
		include: {
			user: {
				select: { id: true, name: true, avatar: true },
			},
		},
		orderBy: { createdAt: "desc" },
	});

	// Get subscriber counts for all fansites
	const fansiteIds = fansites.map((f) => f.id);
	if (fansiteIds.length === 0) return [];

	const countResults = await db.$queryRaw<{ fansiteId: string; count: number }[]>`
		SELECT "data"->>'fansiteId' as "fansiteId", COUNT(*)::int as "count"
		FROM "Notification"
		WHERE "type" = 'fansite_subscribe'
		AND "data"->>'fansiteId' = ANY(${fansiteIds})
		GROUP BY "data"->>'fansiteId'
	`;

	const countMap = new Map(countResults.map((r) => [r.fansiteId, r.count]));

	return fansites.map((fansite) => ({
		id: fansite.id,
		userId: fansite.userId,
		displayName: fansite.displayName ?? "",
		headline: fansite.headline ?? "",
		bio: fansite.bio ?? "",
		mainPhotoUrl: fansite.mainPhotoUrl ?? "",
		packageSize: fansite.packageSize ?? "",
		city: fansite.city ?? "",
		availableNow: fansite.availableNow,
		plusBadge: fansite.plusBadge,
		photos: (fansite.photos as string[]) ?? [],
		interests: (fansite.interests as string[]) ?? [],
		tags: (fansite.tags as string[]) ?? [],
		subscriberCount: countMap.get(fansite.id) ?? 0,
		isSubscribed: false,
		createdAt: fansite.createdAt,
	}));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Social — Shouts
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from "../../generated/prisma/client.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const SHOUT_CHAR_LIMIT = 280;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShoutData {
	id: string;
	userId: string;
	content: string;
	likeCount: number;
	commentCount: number;
	isPinned: boolean;
	createdAt: Date;
	userName: string;
	userAvatar: string;
	hasLiked: boolean;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Creates a shout with a 280 character limit.
 */
export async function createShout(
	db: PrismaClient,
	userId: string,
	content: string,
): Promise<{ shout: ShoutData | null; error?: string }> {
	const trimmed = content.trim();
	if (trimmed.length === 0) {
		return { shout: null, error: "Content cannot be empty" };
	}
	if (trimmed.length > SHOUT_CHAR_LIMIT) {
		return {
			shout: null,
			error: `Content exceeds ${SHOUT_CHAR_LIMIT} character limit`,
		};
	}

	const shout = await db.shout.create({
		data: {
			userId,
			content: trimmed,
		},
		include: {
			user: {
				select: { id: true, name: true, avatar: true },
			},
		},
	});

	return {
		shout: {
			id: shout.id,
			userId: shout.userId,
			content: shout.content,
			likeCount: shout.likeCount,
			commentCount: shout.commentCount,
			isPinned: shout.isPinned,
			createdAt: shout.createdAt,
			userName: shout.user.name ?? "Anonymous",
			userAvatar: shout.user.avatar ?? "",
			hasLiked: false,
		},
	};
}

/**
 * Toggles a like on a shout. Returns the new like state.
 */
export async function likeShout(
	db: PrismaClient,
	shoutId: string,
	userId: string,
): Promise<{ liked: boolean; likeCount: number; error?: string }> {
	const shout = await db.shout.findUnique({ where: { id: shoutId } });
	if (!shout) return { liked: false, likeCount: 0, error: "Shout not found" };

	const existingLike = await db.shoutLike.findUnique({
		where: { shoutId_userId: { shoutId, userId } },
	});

	if (existingLike) {
		// Unlike
		await db.$transaction([
			db.shoutLike.delete({ where: { id: existingLike.id } }),
			db.shout.update({
				where: { id: shoutId },
				data: { likeCount: { decrement: 1 } },
			}),
		]);
		return { liked: false, likeCount: shout.likeCount - 1 };
	}

	// Like
	await db.$transaction([
		db.shoutLike.create({
			data: { shoutId, userId },
		}),
		db.shout.update({
			where: { id: shoutId },
			data: { likeCount: { increment: 1 } },
		}),
	]);

	return { liked: true, likeCount: shout.likeCount + 1 };
}

/**
 * Lists shouts with like status for the given user.
 */
export async function listShouts(
	db: PrismaClient,
	userId: string,
): Promise<ShoutData[]> {
	const shouts = await db.shout.findMany({
		where: { status: "published" },
		include: {
			user: {
				select: { id: true, name: true, avatar: true },
			},
		},
		orderBy: { createdAt: "desc" },
		take: 50,
	});

	const userLikes = await db.shoutLike.findMany({
		where: {
			userId,
			shoutId: { in: shouts.map((s) => s.id) },
		},
	});

	const likedSet = new Set(userLikes.map((l) => l.shoutId));

	return shouts.map((shout) => ({
		id: shout.id,
		userId: shout.userId,
		content: shout.content,
		likeCount: shout.likeCount,
		commentCount: shout.commentCount,
		isPinned: shout.isPinned,
		createdAt: shout.createdAt,
		userName: shout.user.name,
		userAvatar: shout.user.avatar,
		hasLiked: likedSet.has(shout.id),
	}));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Social — MeetNow
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from "../../generated/prisma/client.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const MEETNOW_EXPIRY_HOURS = 4;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MeetNowPostData {
	id: string;
	userId: string;
	place: string;
	type: string;
	tags: string[];
	lat: number | null;
	lng: number | null;
	status: string;
	expiresAt: Date | null;
	createdAt: Date;
	userName: string;
	userAvatar: string;
	hasJoined: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expiryDate(): Date {
	const expires = new Date();
	expires.setHours(expires.getHours() + MEETNOW_EXPIRY_HOURS);
	return expires;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Creates a MeetNow post with a 4-hour expiry.
 */
export async function createPost(
	db: PrismaClient,
	userId: string,
	category: string,
	note?: string,
	location?: { lat: number; lng: number },
): Promise<MeetNowPostData> {
	const post = await db.meetNowPost.create({
		data: {
			userId,
			place: note ?? "",
			type: category,
			tags: [],
			lat: location?.lat ?? null,
			lng: location?.lng ?? null,
			status: "active",
			expiresAt: expiryDate(),
		},
		include: {
			user: {
				select: { id: true, name: true, avatar: true },
			},
		},
	});

	return {
		id: post.id,
		userId: post.userId,
		place: post.place,
		type: post.type,
		tags: (post.tags as string[]) ?? [],
		lat: post.lat,
		lng: post.lng,
		status: post.status,
		expiresAt: post.expiresAt,
		createdAt: post.createdAt,
		userName: post.user.name,
		userAvatar: post.user.avatar,
		hasJoined: false,
	};
}

/**
 * Joins a MeetNow post. Sends a tap and notification to the author.
 */
export async function joinPost(
	db: PrismaClient,
	postId: string,
	userId: string,
): Promise<{ success: boolean; error?: string }> {
	const post = await db.meetNowPost.findUnique({ where: { id: postId } });
	if (!post) return { success: false, error: "Post not found" };
	if (post.status !== "active") return { success: false, error: "Post is no longer active" };
	if (post.expiresAt && post.expiresAt < new Date()) {
		return { success: false, error: "Post has expired" };
	}
	if (post.userId === userId) {
		return { success: false, error: "Cannot join your own post" };
	}

	// Send a tap to the post author
	const existingTap = await db.tap.findUnique({
		where: { fromId_toId: { fromId: userId, toId: post.userId } },
	});

	if (!existingTap) {
		await db.tap.create({
			data: {
				fromId: userId,
				toId: post.userId,
				kind: "meetnow_join",
				note: `Joined your MeetNow post at ${post.place || "unknown location"}`,
			},
		});
	}

	// Create notification for the post author
	await db.notification.create({
		data: {
			userId: post.userId,
			type: "meetnow",
			title: "MeetNow Join",
			body: "Someone joined your MeetNow post!",
			deepLink: `/meetnow/${postId}`,
			data: { postId, fromUserId: userId },
			fromUserId: userId,
		},
	});

	return { success: true };
}

/**
 * Lists active, non-expired MeetNow posts.
 */
export async function listPosts(
	db: PrismaClient,
	userId: string,
): Promise<MeetNowPostData[]> {
	const now = new Date();

	const posts = await db.meetNowPost.findMany({
		where: {
			status: "active",
			expiresAt: { gt: now },
		},
		include: {
			user: {
				select: { id: true, name: true, avatar: true },
			},
		},
		orderBy: { createdAt: "desc" },
		take: 50,
	});

	// Check which posts the current user has sent taps to (meetnow_join kind)
	const authorIds = posts.map((p) => p.userId);
	const userTaps = await db.tap.findMany({
		where: {
			fromId: userId,
			toId: { in: authorIds },
			kind: "meetnow_join",
		},
		select: { toId: true },
	});

	const tappedAuthors = new Set(userTaps.map((t) => t.toId));

	return posts.map((post) => ({
		id: post.id,
		userId: post.userId,
		place: post.place,
		type: post.type,
		tags: (post.tags as string[]) ?? [],
		lat: post.lat,
		lng: post.lng,
		status: post.status,
		expiresAt: post.expiresAt,
		createdAt: post.createdAt,
		userName: post.user.name,
		userAvatar: post.user.avatar,
		hasJoined: tappedAuthors.has(post.userId),
	}));
}

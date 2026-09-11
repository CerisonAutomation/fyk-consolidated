// ═══════════════════════════════════════════════════════════════════════════════
// Social — Stories
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from "../../generated/prisma/client.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const STORY_EXPIRY_HOURS = 24;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StoryData {
	id: string;
	userId: string;
	mediaUrl: string;
	mediaType: string;
	caption: string;
	createdAt: Date;
	expiresAt: Date;
	viewCount: number;
	hasViewed: boolean;
}

export interface StoryRing {
	userId: string;
	userName: string;
	userAvatar: string;
	stories: StoryData[];
	unviewedCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expiryDate(): Date {
	const expires = new Date();
	expires.setHours(expires.getHours() + STORY_EXPIRY_HOURS);
	return expires;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Creates a story with a 24-hour expiry.
 */
export async function createStory(
	db: PrismaClient,
	userId: string,
	mediaUrl: string,
	caption?: string,
	_background?: string,
): Promise<StoryData> {
	const story = await db.story.create({
		data: {
			userId,
			mediaUrl,
			mediaType: "image",
			caption: caption ?? "",
			expiresAt: expiryDate(),
			viewedBy: [],
		},
	});

	return {
		id: story.id,
		userId: story.userId,
		mediaUrl: story.mediaUrl,
		mediaType: story.mediaType,
		caption: story.caption ?? "",
		createdAt: story.createdAt,
		expiresAt: story.expiresAt,
		viewCount: 0,
		hasViewed: false,
	};
}

/**
 * Marks a story as viewed by the given user.
 */
export async function viewStory(
	db: PrismaClient,
	storyId: string,
	userId: string,
): Promise<{ success: boolean; error?: string }> {
	const story = await db.story.findUnique({ where: { id: storyId } });
	if (!story) return { success: false, error: "Story not found" };
	if (story.expiresAt < new Date()) return { success: false, error: "Story expired" };

	const viewedBy = (story.viewedBy as string[]) ?? [];
	if (viewedBy.includes(userId)) return { success: true };

	await db.$transaction([
		db.story.update({
			where: { id: storyId },
			data: { viewedBy: [...viewedBy, userId] },
		}),
		db.storyView.upsert({
			where: { storyId_viewerId: { storyId, viewerId: userId } },
			create: { storyId, viewerId: userId },
			update: {},
		}),
	]);

	return { success: true };
}

/**
 * Deletes a story. Only the owner can delete.
 */
export async function deleteStory(
	db: PrismaClient,
	storyId: string,
	userId: string,
): Promise<{ success: boolean; error?: string }> {
	const story = await db.story.findUnique({ where: { id: storyId } });
	if (!story) return { success: false, error: "Story not found" };
	if (story.userId !== userId) return { success: false, error: "Not authorized" };

	await db.story.delete({ where: { id: storyId } });
	return { success: true };
}

/**
 * Returns story rings grouped by author, with unviewed stories first.
 */
export async function getStoryRings(
	db: PrismaClient,
	userId: string,
): Promise<StoryRing[]> {
	const now = new Date();

	const activeStories = await db.story.findMany({
		where: {
			expiresAt: { gt: now },
			userId: { not: userId },
		},
		include: {
			user: {
				select: { id: true, name: true, photos: true },
			},
		},
		orderBy: { createdAt: "desc" },
	});

	const grouped = new Map<
		string,
		{
			userName: string;
			userAvatar: string;
			stories: StoryData[];
			unviewedCount: number;
		}
	>();

	for (const story of activeStories) {
		const viewedBy = (story.viewedBy as string[]) ?? [];
		const hasViewed = viewedBy.includes(userId);

		const storyData: StoryData = {
			id: story.id,
			userId: story.userId,
			mediaUrl: story.mediaUrl,
			mediaType: story.mediaType,
			caption: story.caption ?? "",
			createdAt: story.createdAt,
			expiresAt: story.expiresAt,
			viewCount: viewedBy.length,
			hasViewed,
		};

		const existing = grouped.get(story.userId);
		if (existing) {
			existing.stories.push(storyData);
			if (!hasViewed) existing.unviewedCount++;
		} else {
			const userPhotos = (story.user.photos as string[]) ?? [];
			const userAvatar = userPhotos[0] ?? "";
			grouped.set(story.userId, {
				userName: story.user.name ?? "",
				userAvatar,
				stories: [storyData],
				unviewedCount: hasViewed ? 0 : 1,
			});
		}
	}

	const rings: StoryRing[] = [];
	for (const [authorId, data] of grouped) {
		rings.push({
			userId: authorId,
			userName: data.userName,
			userAvatar: data.userAvatar,
			stories: data.stories,
			unviewedCount: data.unviewedCount,
		});
	}

	// Sort: unviewed first, then by most recent
	rings.sort((a, b) => {
		if (a.unviewedCount > 0 && b.unviewedCount === 0) return -1;
		if (a.unviewedCount === 0 && b.unviewedCount > 0) return 1;
		return 0;
	});

	return rings;
}

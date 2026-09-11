import { PrismaClient } from "../../generated/prisma";
import type { Story, Profile } from "../../core/domain/types";
import type { StoryRepository } from "../../core/ports/repositories";

// ── Domain <-> Prisma mapper ───────────────────────────────────────────────

function toDomainStory(row: any): Story {
  return {
    id: row.id,
    userId: row.userId,
    mediaUrl: row.mediaUrl,
    mediaType: row.mediaType,
    caption: row.caption || undefined,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    viewed: undefined, // caller should enrich if needed
  };
}

// ── Profile mapper (inline, minimal) ───────────────────────────────────────

function toDomainProfile(row: any): Profile {
  const photos = (row.photos as string[]) ?? [];
  return {
    id: row.id,
    email: row.email,
    pseudo: row.name,
    nick: row.handle ?? "",
    age: row.age,
    birthday: row.dateOfBirth?.toISOString().split("T")[0] ?? "",
    description: row.bio,
    occupation: row.occupation,
    ethnicity: row.ethnicity,
    height: row.height,
    weight: row.weight,
    bodyType: row.bodyType,
    position: typeof row.position === "string" && row.position
      ? row.position.split(",").map((s: string) => s.trim())
      : [],
    languages: (row.languages as string[]) ?? [],
    lookingFor: (row.lookingForTags as string[]) ?? [],
    intents: [],
    tagCodes: (row.tagCodes as string[]) ?? [],
    interests: (row.interests as string[]) ?? [],
    tribes: (row.tribes as string[]) ?? [],
    photos: photos.map(String),
    geo: { lat: row.lat ?? 0, lng: row.lng ?? 0 },
    city: row.city ?? "",
    area: row.area ?? "",
    status: row.status,
    role: row.role,
    tier: row.tier,
    verification: row.verifiedType ?? "none",
    trustScore: row.trustScore,
    profileComplete: row.profileComplete,
    online: row.isOnline,
    visible: !row.hidden,
    hidden: row.hidden,
    incognito: row.incognitoMode,
    isDemo: false,
    isSuspended: row.status === "suspended",
    exposureLevel: row.contentRating ?? "safe",
    hideDistance: !row.showDistance,
    hideOnline: !row.showOnline,
    theme: row.themePreference,
    accent: row.accent,
    fontSize: 14,
    gridColumns: row.gridColumns,
    language: row.language,
    lastSeen: (row.lastSeenAt ?? row.lastActive ?? row.createdAt).toISOString(),
    lastActiveAt: (row.lastActive ?? row.createdAt).toISOString(),
    onboardingDone: row.profileComplete >= 80,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createStoryRepository(db: PrismaClient): StoryRepository {
  return {
    async findActive(userId: string): Promise<Story[]> {
      const rows = await db.story.findMany({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDomainStory);
    },

    async create(
      userId: string,
      data: { mediaUrl: string; caption?: string; background?: string },
    ): Promise<Story> {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h

      const row = await db.story.create({
        data: {
          userId,
          mediaUrl: data.mediaUrl,
          mediaType: "image",
          caption: data.caption ?? "",
          expiresAt,
        },
      });
      return toDomainStory(row);
    },

    async view(storyId: string, userId: string): Promise<void> {
      // Create StoryView record (upsert to avoid duplicates)
      await db.storyView.upsert({
        where: {
          storyId_viewerId: { storyId, viewerId: userId },
        },
        create: {
          storyId,
          viewerId: userId,
        },
        update: {
          viewedAt: new Date(),
        },
      });

      // Also append to the viewedBy JSON array on the Story
      const story = await db.story.findUnique({ where: { id: storyId } });
      if (story) {
        const viewedBy = (story.viewedBy as string[]) ?? [];
        if (!viewedBy.includes(userId)) {
          viewedBy.push(userId);
          await db.story.update({
            where: { id: storyId },
            data: { viewedBy },
          });
        }
      }
    },

    async delete(storyId: string, userId: string): Promise<void> {
      await db.story.deleteMany({
        where: { id: storyId, userId },
      });
    },

    async getRings(
      userId: string,
    ): Promise<Array<{ userId: string; user: Profile; stories: Story[]; viewed: boolean }>> {
      // Fetch all active stories from users the current user can see
      const activeStories = await db.story.findMany({
        where: {
          expiresAt: { gt: new Date() },
          userId: { not: userId },
        },
        include: {
          user: true,
          views: {
            where: { viewerId: userId },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Group by author
      const grouped = new Map<string, { stories: Story[]; user: any; hasUnviewed: boolean }>();

      for (const story of activeStories) {
        const authorId = story.userId;
        if (!grouped.has(authorId)) {
          grouped.set(authorId, {
            stories: [],
            user: story.user,
            hasUnviewed: false,
          });
        }
        const group = grouped.get(authorId)!;
        group.stories.push(toDomainStory(story));
        if (story.views.length === 0) {
          group.hasUnviewed = true;
        }
      }

      // Sort: unviewed groups first, then by most recent story
      const result = Array.from(grouped.entries())
        .sort(([, a], [, b]) => {
          if (a.hasUnviewed && !b.hasUnviewed) return -1;
          if (!a.hasUnviewed && b.hasUnviewed) return 1;
          return 0;
        })
        .map(([uid, { stories, user }]) => ({
          userId: uid,
          user: toDomainProfile(user),
          stories,
          viewed: stories.every((s) => s.viewed !== false),
        }));

      return result;
    },
  };
}

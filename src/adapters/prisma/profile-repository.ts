import { PrismaClient } from "../../generated/prisma";
import type { Profile } from "../../core/domain/types";
import type { ProfileRepository } from "../../core/ports/repositories";

// ── Haversine helper ───────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Domain <-> Prisma mapper ───────────────────────────────────────────────

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
    position: typeof row.position === "string" && row.position ? row.position.split(",").map((s: string) => s.trim()) : [],
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
    fontSize: parseFontSize(row.fontSize),
    gridColumns: row.gridColumns,
    language: row.language,
    lastSeen: (row.lastSeenAt ?? row.lastActive ?? row.createdAt).toISOString(),
    lastActiveAt: (row.lastActive ?? row.createdAt).toISOString(),
    onboardingDone: row.profileComplete >= 80,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseFontSize(size: string): number {
  const map: Record<string, number> = { small: 12, medium: 14, large: 16, xlarge: 18 };
  return map[size] ?? 14;
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createProfileRepository(db: PrismaClient): ProfileRepository {
  return {
    async findById(id: string): Promise<Profile | null> {
      const row = await db.user.findUnique({ where: { id } });
      return row ? toDomainProfile(row) : null;
    },

    async findByEmail(email: string): Promise<Profile | null> {
      const row = await db.user.findUnique({ where: { email } });
      return row ? toDomainProfile(row) : null;
    },

    async create(
      data: Partial<Profile> & { email: string; passwordHash: string },
    ): Promise<Profile> {
      const row = await db.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.pseudo ?? data.nick ?? "New User",
          handle: data.nick ?? null,
          age: data.age ?? 25,
          bio: data.description ?? "",
          occupation: data.occupation ?? "",
          ethnicity: data.ethnicity ?? "",
          height: data.height ?? 0,
          weight: data.weight ?? 0,
          bodyType: data.bodyType ?? "",
          position: Array.isArray(data.position) ? data.position.join(", ") : (data.position ?? ""),
          lookingForTags: data.lookingFor ?? [],
          interests: JSON.stringify(data.interests ?? []),
          tribes: JSON.stringify(data.tribes ?? []),
          tagCodes: data.tagCodes ?? [],
          languages: JSON.stringify(data.languages ?? []),
          photos: JSON.stringify(data.photos ?? []),
          lat: data.geo?.lat ?? null,
          lng: data.geo?.lng ?? null,
          city: data.city ?? "",
          area: data.area ?? "",
        },
      });
      return toDomainProfile(row);
    },

    async update(id: string, data: Partial<Profile>): Promise<Profile> {
      const updateData: Record<string, any> = {};

      if (data.pseudo !== undefined) updateData.name = data.pseudo;
      if (data.nick !== undefined) updateData.handle = data.nick;
      if (data.age !== undefined) updateData.age = data.age;
      if (data.description !== undefined) updateData.bio = data.description;
      if (data.occupation !== undefined) updateData.occupation = data.occupation;
      if (data.ethnicity !== undefined) updateData.ethnicity = data.ethnicity;
      if (data.height !== undefined) updateData.height = data.height;
      if (data.weight !== undefined) updateData.weight = data.weight;
      if (data.bodyType !== undefined) updateData.bodyType = data.bodyType;
      if (data.position !== undefined) {
        updateData.position = Array.isArray(data.position)
          ? data.position.join(", ")
          : data.position;
      }
      if (data.lookingFor !== undefined) updateData.lookingForTags = data.lookingFor;
      if (data.interests !== undefined) updateData.interests = data.interests;
      if (data.tribes !== undefined) updateData.tribes = data.tribes;
      if (data.tagCodes !== undefined) updateData.tagCodes = data.tagCodes;
      if (data.languages !== undefined) updateData.languages = data.languages;
      if (data.geo !== undefined) {
        updateData.lat = data.geo.lat;
        updateData.lng = data.geo.lng;
      }
      if (data.city !== undefined) updateData.city = data.city;
      if (data.area !== undefined) updateData.area = data.area;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.tier !== undefined) updateData.tier = data.tier;
      if (data.theme !== undefined) updateData.themePreference = data.theme;
      if (data.accent !== undefined) updateData.accent = data.accent;
      if (data.gridColumns !== undefined) updateData.gridColumns = data.gridColumns;
      if (data.language !== undefined) updateData.language = data.language;
      if (data.hidden !== undefined) updateData.hidden = data.hidden;
      if (data.incognito !== undefined) updateData.incognitoMode = data.incognito;
      if (data.hideDistance !== undefined) updateData.showDistance = !data.hideDistance;
      if (data.hideOnline !== undefined) updateData.showOnline = !data.hideOnline;

      const row = await db.user.update({
        where: { id },
        data: updateData,
      });
      return toDomainProfile(row);
    },

    async findNearby(
      lat: number,
      lng: number,
      radiusKm: number,
      excludeIds: string[] = [],
    ): Promise<Profile[]> {
      // Fetch candidates with lat/lng set, filter in JS using Haversine
      const where: any = {
        lat: { not: null },
        lng: { not: null },
        status: "active",
        deletedAt: null,
      };
      if (excludeIds.length > 0) {
        where.id = { notIn: excludeIds };
      }

      const rows = await db.user.findMany({ where });
      return rows
        .filter((row) => {
          const d = haversineKm(lat, lng, row.lat!, row.lng!);
          return d <= radiusKm;
        })
        .map(toDomainProfile);
    },

    async updateOnlineStatus(userId: string, online: boolean): Promise<void> {
      await db.user.update({
        where: { id: userId },
        data: {
          isOnline: online,
          lastActive: new Date(),
        },
      });
    },

    async updateLastSeen(userId: string): Promise<void> {
      await db.user.update({
        where: { id: userId },
        data: {
          lastSeenAt: new Date(),
          lastActive: new Date(),
        },
      });
    },
  };
}

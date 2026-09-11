// ═══════════════════════════════════════════════════════════════════════════════
// Application — Discovery & Matching Use Cases
// ═══════════════════════════════════════════════════════════════════════════════
//
// Orchestrates domain logic with repository ports.
// Contains NO Prisma imports — only port interfaces.

import type { ProfileRepository, MatchRepository, FootprintRepository, NotificationRepository } from "../ports/repositories";
import type { Profile, Tap, Match, Footprint, MatchDimensions } from "../domain/types";
import { ok, fail, type Result } from "../domain/errors";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DiscoveryFilters {
  ageMin?: number;
  ageMax?: number;
  lookingFor?: string[];
  tribes?: string[];
  online?: boolean;
  verified?: boolean;
  radiusKm?: number;
}

export interface DiscoveryProfile {
  id: string;
  pseudo: string;
  age: number;
  photo: string;
  distance: number;
  city: string;
  lookingFor: string[];
  tribes: string[];
  bio: string;
  verified: boolean;
  online: boolean;
  matchScore: number;
  isFavorite: boolean;
  matched: boolean;
}

export interface TapResult {
  tap: Tap;
  mutualMatch: boolean;
  matchId?: string;
}

// ─── Match scoring ───────────────────────────────────────────────────────────

function computeMatchScore(a: Profile, b: Profile): { overall: number; dimensions: MatchDimensions } {
  // Interest overlap (0-100)
  const sharedInterests = a.interests.filter((i) => b.interests.includes(i));
  const allInterests = new Set([...a.interests, ...b.interests]);
  const interests = allInterests.size > 0
    ? Math.round((sharedInterests.length / allInterests.size) * 100)
    : 50;

  // Looking-for alignment (0-100)
  const sharedLooking = a.lookingFor.filter((l) => b.lookingFor.includes(l));
  const allLooking = new Set([...a.lookingFor, ...b.lookingFor]);
  const lifestyle = allLooking.size > 0
    ? Math.round((sharedLooking.length / allLooking.size) * 100)
    : 50;

  // Communication (languages overlap)
  const sharedLangs = a.languages.filter((l) => b.languages.includes(l));
  const allLangs = new Set([...a.languages, ...b.languages]);
  const communication = allLangs.size > 0
    ? Math.round((sharedLangs.length / allLangs.size) * 100)
    : 50;

  // Goals (intent overlap)
  const sharedIntents = a.intents.filter((i) => b.intents.includes(i));
  const allIntents = new Set([...a.intents, ...b.intents]);
  const goals = allIntents.size > 0
    ? Math.round((sharedIntents.length / allIntents.size) * 100)
    : 50;

  // Chemistry (tribe overlap + position compatibility)
  const sharedTribes = a.tribes.filter((t) => b.tribes.includes(t));
  const allTribes = new Set([...a.tribes, ...b.tribes]);
  const tribeScore = allTribes.size > 0
    ? Math.round((sharedTribes.length / allTribes.size) * 100)
    : 50;
  const chemistry = Math.round(tribeScore * 0.6 + 40); // baseline 40

  const overall = Math.round(
    interests * 0.3 + lifestyle * 0.2 + communication * 0.15 + goals * 0.2 + chemistry * 0.15,
  );

  return {
    overall: Math.min(100, Math.max(0, overall)),
    dimensions: { interests, lifestyle, communication, goals, chemistry },
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class DiscoveryService {
  constructor(
    private profileRepo: ProfileRepository,
    private matchRepo: MatchRepository,
    private footprintRepo: FootprintRepository,
    private notificationRepo: NotificationRepository,
  ) {}

  // ── Queries ──────────────────────────────────────────────────────────────

  /**
   * Loads nearby profiles, computes match scores, and returns them.
   * Filters by age, interests, tribes, online status, and radius.
   */
  async getNearbyProfiles(
    userId: string,
    filters?: DiscoveryFilters,
  ): Promise<Result<DiscoveryProfile[]>> {
    const me = await this.profileRepo.findById(userId);
    if (!me) {
      return fail("USER_NOT_FOUND", "Current user profile not found");
    }

    const radiusKm = filters?.radiusKm ?? 50;
    const nearbyProfiles = await this.profileRepo.findNearby(
      me.geo.lat,
      me.geo.lng,
      radiusKm,
      [userId], // exclude self
    );

    // Load user's existing taps, matches, and favorites for state
    const [, matches, favorites] = await Promise.all([
      this.matchRepo.findOutgoingTaps(userId),
      this.matchRepo.findMatches(userId),
      this.matchRepo.findFavorites(userId),
    ]);

    const matchedIds = new Set(matches.flatMap((m) => [m.user1Id, m.user2Id]).filter((id) => id !== userId));
    const favoriteIds = new Set(favorites.map((f) => f.targetId));

    // Apply optional filters
    let filtered = nearbyProfiles;

    if (filters?.ageMin !== undefined) {
      filtered = filtered.filter((p) => p.age >= filters.ageMin!);
    }
    if (filters?.ageMax !== undefined) {
      filtered = filtered.filter((p) => p.age <= filters.ageMax!);
    }
    if (filters?.online) {
      filtered = filtered.filter((p) => p.online);
    }
    if (filters?.verified) {
      filtered = filtered.filter((p) => p.verification === "verified");
    }
    if (filters?.lookingFor && filters.lookingFor.length > 0) {
      filtered = filtered.filter((p) =>
        filters.lookingFor!.some((lf) => p.lookingFor.includes(lf)),
      );
    }
    if (filters?.tribes && filters.tribes.length > 0) {
      filtered = filtered.filter((p) =>
        filters.tribes!.some((t) => p.tribes.includes(t)),
      );
    }

    // Compute match scores and build response
    const results: DiscoveryProfile[] = filtered.map((profile) => {
      const { overall } = computeMatchScore(me, profile);
      return {
        id: profile.id,
        pseudo: profile.pseudo,
        age: profile.age,
        photo: profile.photos[0] ?? "",
        distance: 0, // Would be computed from geo; simplified here
        city: profile.city,
        lookingFor: profile.lookingFor,
        tribes: profile.tribes,
        bio: profile.description,
        verified: profile.verification === "verified",
        online: profile.online,
        matchScore: overall,
        isFavorite: favoriteIds.has(profile.id),
        matched: matchedIds.has(profile.id),
      };
    });

    // Sort by match score descending
    results.sort((a, b) => b.matchScore - a.matchScore);

    return ok(results);
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  /**
   * Creates a tap (or super tap) on another profile.
   * Checks for a reciprocal tap to detect mutual matches.
   */
  async tapProfile(
    userId: string,
    targetId: string,
    isSuper: boolean = false,
  ): Promise<Result<TapResult>> {
    if (userId === targetId) {
      return fail("SELF_TAP", "Cannot tap your own profile");
    }

    // Verify both users exist
    const [me, target] = await Promise.all([
      this.profileRepo.findById(userId),
      this.profileRepo.findById(targetId),
    ]);

    if (!me) return fail("USER_NOT_FOUND", "Current user profile not found");
    if (!target) return fail("TARGET_NOT_FOUND", "Target profile not found");

    // Check if already tapped this user
    const outgoing = await this.matchRepo.findOutgoingTaps(userId);
    const alreadyTapped = outgoing.some((t) => t.tappedId === targetId);
    if (alreadyTapped) {
      return fail("ALREADY_TAPPED", "You have already tapped this profile");
    }

    // Check for block
    const myBlocks = await this.matchRepo.findBlocks(userId);
    const theirBlocks = await this.matchRepo.findBlocks(targetId);
    const blocked = myBlocks.some((b) => b.blockedId === targetId) ||
      theirBlocks.some((b) => b.blockedId === userId);
    if (blocked) {
      return fail("BLOCKED", "Cannot tap this profile");
    }

    // Create the tap
    const tap = await this.matchRepo.createTap(userId, targetId, isSuper ? "super" : "regular");

    // Check for mutual match (they already tapped us)
    const reciprocal = await this.matchRepo.findReciprocalTap(targetId, userId);
    let mutualMatch = false;
    let matchId: string | undefined;

    if (reciprocal) {
      const match = await this.matchRepo.createMatch(userId, targetId);
      mutualMatch = true;
      matchId = match.id;

      // Notify both users of the match
      await Promise.all([
        this.notificationRepo.create({
          userId,
          type: "match",
          title: "It's a match!",
          body: `You and ${target.pseudo} liked each other. Say hello!`,
          actorId: targetId,
        }),
        this.notificationRepo.create({
          userId: targetId,
          type: "match",
          title: "It's a match!",
          body: `You and ${me.pseudo} liked each other. Say hello!`,
          actorId: userId,
        }),
      ]);
    } else {
      // Notify the tapped user (non-super taps only for non-premium)
      if (isSuper) {
        await this.notificationRepo.create({
          userId: targetId,
          type: "super_tap",
          title: "Someone special tapped you!",
          body: "A king used a Super Tap on your profile.",
          actorId: userId,
        });
      }
    }

    return ok({ tap, mutualMatch, matchId });
  }

  /**
   * Records a profile view (footprint).
   */
  async recordFootprint(
    visitorId: string,
    visitedId: string,
    preset?: string,
  ): Promise<Result<Footprint>> {
    if (visitorId === visitedId) {
      return fail("SELF_VISIT", "Cannot record a footprint on your own profile");
    }

    const [visitor, visited] = await Promise.all([
      this.profileRepo.findById(visitorId),
      this.profileRepo.findById(visitedId),
    ]);

    if (!visitor) return fail("VISITOR_NOT_FOUND", "Visitor profile not found");
    if (!visited) return fail("VISITED_NOT_FOUND", "Visited profile not found");

    const footprint = await this.footprintRepo.record(visitorId, visitedId, preset);

    // Notify the visited user (unless visitor is incognito)
    if (!visitor.incognito) {
      await this.notificationRepo.create({
        userId: visitedId,
        type: "footprint",
        title: "Profile view",
        body: `${visitor.pseudo} viewed your profile`,
        actorId: visitorId,
      });
    }

    return ok(footprint);
  }

  /**
   * Returns incoming taps (who liked you).
   */
  async getIncomingTaps(userId: string): Promise<Result<Tap[]>> {
    const taps = await this.matchRepo.findIncomingTaps(userId);
    return ok(taps);
  }

  /**
   * Returns the user's matches.
   */
  async getMatches(userId: string): Promise<Result<Match[]>> {
    const matches = await this.matchRepo.findMatches(userId);
    return ok(matches);
  }

  /**
   * Adds a profile to favorites.
   */
  async addFavorite(userId: string, targetId: string): Promise<Result<void>> {
    await this.matchRepo.addFavorite(userId, targetId);
    return ok(undefined);
  }

  /**
   * Removes a profile from favorites.
   */
  async removeFavorite(userId: string, targetId: string): Promise<Result<void>> {
    await this.matchRepo.removeFavorite(userId, targetId);
    return ok(undefined);
  }

  /**
   * Blocks a user.
   */
  async blockUser(
    userId: string,
    targetId: string,
    reason?: string,
  ): Promise<Result<void>> {
    if (userId === targetId) {
      return fail("SELF_BLOCK", "Cannot block yourself");
    }

    await this.matchRepo.blockUser(userId, targetId, reason);

    // Remove from favorites if present
    try {
      await this.matchRepo.removeFavorite(userId, targetId);
    } catch {
      // Not a critical failure if favorite removal fails
    }

    return ok(undefined);
  }

  /**
   * Unblocks a user.
   */
  async unblockUser(userId: string, targetId: string): Promise<Result<void>> {
    await this.matchRepo.unblockUser(userId, targetId);
    return ok(undefined);
  }

  /**
   * Reports a user.
   */
  async reportUser(
    reporterId: string,
    reportedId: string,
    reason: string,
    details?: string,
  ): Promise<Result<void>> {
    if (reporterId === reportedId) {
      return fail("SELF_REPORT", "Cannot report yourself");
    }

    await this.matchRepo.createReport({
      reporterId,
      reportedId,
      reason,
      details,
    });

    return ok(undefined);
  }
}

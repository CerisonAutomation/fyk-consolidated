import { useQuery } from "@tanstack/react-query";
import { post } from "@/lib/client";

/**
 * Compatibility between the caller and one profile.
 *
 * This posted `{profileId, targetId}` to `/api/match`, a path nothing serves, so
 * the promise resolved with the SPA's HTML 404 document and `res.json()` rejected
 * inside `queryFn` — which React Query surfaces as an error nobody rendered, so
 * every screen using it showed a blank score forever.
 *
 * `#/routes/api/matches/compatibility` is the canonical route. It takes only
 * `targetId`: the other side of the pair is the bearer token, and a client that
 * could name both sides could ask for anybody's score against anybody else. The
 * caller's own id is therefore not a parameter, and `profileId` is kept in the
 * query key only so two mounted hooks for two viewers do not share a cache entry.
 */

export interface MatchScore {
	userA: string;
	userB: string;
	/** Whole percent, 0–100. */
	score: number;
	dimensions?: Record<string, number>;
}

export function useMatch(profileId: string, targetId: string) {
	return useQuery({
		queryKey: ["match", profileId, targetId],
		queryFn: () =>
			post<{ score: MatchScore; cached: boolean }>(
				"/api/matches/compatibility",
				{ targetId },
			),
		enabled: Boolean(profileId) && Boolean(targetId),
		// A score is a function of two profile rows; it changes when either is
		// edited, not every time a card re-mounts.
		staleTime: 5 * 60_000,
	});
}

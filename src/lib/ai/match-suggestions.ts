/**
 * AI Match Suggestions — PRD 14.5
 * Compatibility scoring, vector similarity, 5-dim model
 */

export interface MatchSuggestion {
  profileId: string;
  score: number;
  reasons: string[];
  compatibility: {
    interests: number;
    values: number;
    lifestyle: number;
    communication: number;
    physical: number;
  };
}

export async function getMatchSuggestions(userId: string, limit = 10): Promise<MatchSuggestion[]> {
  // Calls edge function match-profiles with pgvector
  const res = await fetch(`/api/match/suggestions?userId=${userId}&limit=${limit}`);
  const data = await res.json();
  return data.matches ?? [];
}

export async function calculateCompatibility(profileA: string, profileB: string): Promise<MatchSuggestion> {
  const res = await fetch("/api/match/compatibility", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileA, profileB }),
  });
  
  return res.json();
}

export async function getSimilarProfiles(profileId: string, limit = 5): Promise<MatchSuggestion[]> {
  const res = await fetch(`/api/match/similar?profileId=${profileId}&limit=${limit}`);
  const data = await res.json();
  return data.similar ?? [];
}

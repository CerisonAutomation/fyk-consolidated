"use client";
import { useQuery } from "@tanstack/react-query";
import { findSimilarProfiles, buildEmbeddingText } from "../integrations/supabase/vector";
import type { Profile } from "../core/domain/types";

export function useVectorSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ["vector-search", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const result = await findSimilarProfiles(query, 20, 0.3);
      return result.ok ? result.data : [];
    },
    enabled: enabled && query.length >= 2,
    staleTime: 60_000,
  });
}

export function useProfileEmbedding(profile: Profile) {
  const text = buildEmbeddingText(profile);
  return useQuery({
    queryKey: ["profile-embedding", profile.id],
    queryFn: async () => {
      const { upsertProfileEmbedding } = await import("../integrations/supabase/vector");
      return upsertProfileEmbedding(profile.id, text);
    },
    enabled: false, // manual trigger only
  });
}

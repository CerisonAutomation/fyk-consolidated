"use client";
import { useQuery } from "@tanstack/react-query";
import {
  findSimilarProfiles,
  findSimilarMessages,
  buildEmbeddingText,
  upsertProfileEmbedding,
} from "../integrations/supabase/vector";
import type { Profile } from "../core/domain/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VectorProfileResult = {
  profile_id: string;
  similarity: number;
  display_name: string;
  avatar_url: string;
  age: number;
  city: string;
};

export type VectorMessageResult = {
  message_id: string;
  similarity: number;
  content: string;
  sender_id: string;
  created_at: string;
};

export type VectorSearchState<T> = {
  data: T[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  isEmpty: boolean;
};

// ---------------------------------------------------------------------------
// Profile search
// ---------------------------------------------------------------------------

/**
 * Searches for profiles similar to the given text query.
 *
 * The hook is enabled only when the query is at least 2 characters long.
 * Returns structured state so callers can render loading, empty, and error
 * states without inspecting React Query internals.
 */
export function useVectorSearch(
  query: string,
  options?: { enabled?: boolean; matchCount?: number; threshold?: number },
): VectorSearchState<VectorProfileResult> {
  const { enabled = true, matchCount = 20, threshold = 0.3 } = options ?? {};
  const shouldRun = enabled && query.length >= 2;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vector-search", query, matchCount, threshold],
    queryFn: async () => {
      const result = await findSimilarProfiles(query, matchCount, threshold);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled: shouldRun,
    staleTime: 60_000,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message.includes("NOT_CONFIGURED")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  return {
    data: data ?? [],
    isLoading,
    isError,
    error: isError ? (error instanceof Error ? error.message : "Search failed") : null,
    isEmpty: !isLoading && !isError && (data?.length ?? 0) === 0,
  };
}

// ---------------------------------------------------------------------------
// Message search
// ---------------------------------------------------------------------------

/**
 * Searches for messages similar to the given text within a conversation.
 *
 * Generates the hash-based embedding locally and passes it to the RPC.
 */
export function useVectorMessageSearch(
  query: string,
  conversationId: string,
  options?: { enabled?: boolean; matchCount?: number },
): VectorSearchState<VectorMessageResult> {
  const { enabled = true, matchCount = 10 } = options ?? {};
  const shouldRun = enabled && query.length >= 2 && conversationId.length > 0;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vector-message-search", query, conversationId, matchCount],
    queryFn: async () => {
      const embedding = generateHashEmbeddingFromText(query);
      const result = await findSimilarMessages(embedding, conversationId, matchCount);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled: shouldRun,
    staleTime: 60_000,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message.includes("NOT_CONFIGURED")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  return {
    data: data ?? [],
    isLoading,
    isError,
    error: isError ? (error instanceof Error ? error.message : "Search failed") : null,
    isEmpty: !isLoading && !isError && (data?.length ?? 0) === 0,
  };
}

// ---------------------------------------------------------------------------
// Profile embedding generation
// ---------------------------------------------------------------------------

/**
 * Generates and upserts an embedding for a profile.
 *
 * Triggered automatically when the profile has embeddable text (pseudo or
 * description). Inspect isError / error to surface failures to the user.
 */
export function useProfileEmbedding(profile: Profile) {
  const text = buildEmbeddingText(profile);
  const hasContent = Boolean(profile.pseudo || profile.description);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["profile-embedding", profile.id],
    queryFn: async () => {
      const result = await upsertProfileEmbedding(profile.id, text);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled: hasContent,
    staleTime: 300_000,
    retry: 1,
  });

  return {
    data,
    isLoading,
    isError,
    error: isError ? (error?.message ?? "Embedding failed") : null,
  };
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Hash-based embedding generation. Duplicated from vector.ts because that
 * module does not export the generator (only the RPC wrappers use it).
 * Produces the same 384-dim normalized vector.
 */
function generateHashEmbeddingFromText(text: string, dimensions = 384): number[] {
  const embedding = new Array(dimensions).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    embedding[Math.abs(hash) % dimensions] += 1;
  }
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  return embedding.map((v) => v / (norm || 1));
}

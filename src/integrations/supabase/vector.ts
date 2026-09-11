import { getSupabase, type Result, ok, fail } from "./client";

const EMBEDDING_DIM = 384;

function generateHashEmbedding(text: string, dimensions: number = EMBEDDING_DIM): number[] {
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

export async function findSimilarProfiles(
  text: string,
  matchCount: number = 20,
  threshold: number = 0.5,
): Promise<Result<Array<{ profile_id: string; similarity: number; display_name: string; avatar_url: string; age: number; city: string }>>> {
  const client = getSupabase();
  if (!client) return fail("NOT_CONFIGURED", "Supabase not configured");

  const embedding = generateHashEmbedding(text);
  const { data, error } = await client.rpc("find_similar_profiles" as any, {
    query_embedding: JSON.stringify(embedding),
    match_count: matchCount,
    match_threshold: threshold,
  });

  if (error) return fail("VECTOR_ERROR", error.message);
  return ok((data ?? []) as any);
}

export async function upsertProfileEmbedding(profileId: string, text: string): Promise<Result<void>> {
  const client = getSupabase();
  if (!client) return fail("NOT_CONFIGURED", "Supabase not configured");

  const embedding = generateHashEmbedding(text);
  const { error } = await client.from("profile_embeddings").upsert(
    { profile_id: profileId, embedding: JSON.stringify(embedding), model: "hash-v1" } as any,
    { onConflict: "profile_id,model" },
  );

  if (error) return fail("UPSERT_ERROR", error.message);
  return ok(undefined);
}

export async function findSimilarMessages(
  queryEmbedding: number[],
  conversationId: string,
  matchCount: number = 10,
): Promise<Result<Array<{ message_id: string; similarity: number; content: string; sender_id: string; created_at: string }>>> {
  const client = getSupabase();
  if (!client) return fail("NOT_CONFIGURED", "Supabase not configured");

  const { data, error } = await client.rpc("find_similar_messages" as any, {
    query_embedding: JSON.stringify(queryEmbedding),
    conv_id: conversationId,
    match_count: matchCount,
  });

  if (error) return fail("VECTOR_ERROR", error.message);
  return ok((data ?? []) as any);
}

export async function upsertMessageEmbedding(messageId: string, text: string): Promise<Result<void>> {
  const client = getSupabase();
  if (!client) return fail("NOT_CONFIGURED", "Supabase not configured");

  const embedding = generateHashEmbedding(text);
  const { error } = await client.from("message_embeddings").upsert(
    { message_id: messageId, embedding: JSON.stringify(embedding) } as any,
    { onConflict: "message_id" },
  );

  if (error) return fail("UPSERT_ERROR", error.message);
  return ok(undefined);
}

export function buildEmbeddingText(profile: {
  pseudo?: string; description?: string; city?: string; occupation?: string;
  interests?: string[]; tribes?: string[]; lookingFor?: string[];
}): string {
  return [
    profile.pseudo, profile.description, profile.city, profile.occupation,
    ...(profile.interests || []), ...(profile.tribes || []), ...(profile.lookingFor || []),
  ].filter(Boolean).join(" ");
}

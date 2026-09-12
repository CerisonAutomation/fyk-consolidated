import { getSupabase, ok, toFailure, type Result } from "./client";
import type { Like, LikeKind, Match, Profile } from "./types";

export type SocialProfile = Pick<
  Profile,
  | "id"
  | "display_name"
  | "handle"
  | "avatar_url"
  | "age"
  | "headline"
  | "city"
  | "area"
  | "last_active_at"
  | "hide_online"
>;

export type SocialLike = Like & { profile: SocialProfile | null };
export type SocialMatch = Match & { profile: SocialProfile | null };

export type SocialHub = {
  received: SocialLike[];
  sent: SocialLike[];
  matches: SocialMatch[];
  suggestions: SocialProfile[];
};

const PROFILE_COLUMNS =
  "id,display_name,handle,avatar_url,age,headline,city,area,last_active_at,hide_online";
const LIKE_COLUMNS = "id,from_id,to_id,kind,created_at";
const MATCH_COLUMNS = "id,user_a,user_b,created_at,unmatched_at";

export async function loadSocialHub(userId: string): Promise<Result<SocialHub>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const [likesResult, matchesResult, suggestionsResult] = await Promise.all([
    client
      .from("likes")
      .select(LIKE_COLUMNS)
      .or(`from_id.eq.${userId},to_id.eq.${userId}`)
      .order("created_at", { ascending: false }),
    client
      .from("matches")
      .select(MATCH_COLUMNS)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .is("unmatched_at", null)
      .order("created_at", { ascending: false }),
    client
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .neq("id", userId)
      .eq("is_demo", false)
      .eq("is_suspended", false)
      .not("onboarding_completed_at", "is", null)
      .order("last_active_at", { ascending: false })
      .limit(40),
  ]);

  if (likesResult.error) return toFailure(likesResult.error);
  if (matchesResult.error) return toFailure(matchesResult.error);
  if (suggestionsResult.error) return toFailure(suggestionsResult.error);

  const likes = likesResult.data ?? [];
  const matches = matchesResult.data ?? [];
  const suggestions = suggestionsResult.data ?? [];
  const relatedIds = new Set<string>();

  for (const like of likes) relatedIds.add(like.from_id === userId ? like.to_id : like.from_id);
  for (const match of matches) relatedIds.add(match.user_a === userId ? match.user_b : match.user_a);

  const missingIds = [...relatedIds].filter((id) => !suggestions.some((profile) => profile.id === id));
  let relatedProfiles: SocialProfile[] = [];
  if (missingIds.length > 0) {
    const result = await client.from("profiles").select(PROFILE_COLUMNS).in("id", missingIds);
    if (result.error) return toFailure(result.error);
    relatedProfiles = result.data ?? [];
  }

  const profiles = new Map<string, SocialProfile>(
    [...suggestions, ...relatedProfiles].map((profile) => [profile.id, profile]),
  );
  const sentTargetIds = new Set(likes.filter((like) => like.from_id === userId).map((like) => like.to_id));
  const matchedIds = new Set(matches.map((match) => (match.user_a === userId ? match.user_b : match.user_a)));

  return ok({
    received: likes
      .filter((like) => like.to_id === userId)
      .map((like) => ({ ...like, profile: profiles.get(like.from_id) ?? null })),
    sent: likes
      .filter((like) => like.from_id === userId)
      .map((like) => ({ ...like, profile: profiles.get(like.to_id) ?? null })),
    matches: matches.map((match) => {
      const otherId = match.user_a === userId ? match.user_b : match.user_a;
      return { ...match, profile: profiles.get(otherId) ?? null };
    }),
    suggestions: suggestions.filter(
      (profile) => !sentTargetIds.has(profile.id) && !matchedIds.has(profile.id),
    ),
  });
}

export async function sendLike(
  userId: string,
  targetId: string,
  kind: LikeKind,
): Promise<Result<Like>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  if (userId === targetId) {
    return { ok: false, code: "validation", message: "You cannot like your own profile." };
  }

  const existing = await client
    .from("likes")
    .select(LIKE_COLUMNS)
    .eq("from_id", userId)
    .eq("to_id", targetId)
    .maybeSingle();
  if (existing.error) return toFailure(existing.error);
  if (existing.data) return ok(existing.data);

  const result = await client
    .from("likes")
    .insert({ from_id: userId, to_id: targetId, kind })
    .select(LIKE_COLUMNS)
    .single();

  return result.error ? toFailure(result.error) : ok(result.data);
}

export async function removeLike(userId: string, targetId: string): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const result = await client
    .from("likes")
    .delete()
    .eq("from_id", userId)
    .eq("to_id", targetId);
  return result.error ? toFailure(result.error) : ok(null);
}
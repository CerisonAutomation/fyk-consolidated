// ═══════════════════════════════════════════════════════════════════════════════
// Social — Groups
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, ok, toFailure, type Result } from "./client";
import type { Group, GroupMessage } from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GroupView = Group & {
  joined: boolean;
};

export type GroupMessageView = GroupMessage & {
  sender_name: string | null;
  sender_avatar: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GROUP_COLUMNS = "id,name,description,cover_url,icon,privacy,created_by,member_count,created_at";
const MESSAGE_COLUMNS = "id,group_id,sender_id,content,type,created_at";

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Lists all groups, annotated with whether the current user has joined.
 */
export async function listGroups(userId: string | undefined): Promise<Result<GroupView[]>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const [groupsResult, membershipsResult] = await Promise.all([
    client
      .from("groups")
      .select(GROUP_COLUMNS)
      .order("member_count", { ascending: false }),
    client
      .from("group_members")
      .select("id,group_id,user_id")
      .eq("user_id", userId),
  ]);

  if (groupsResult.error) return toFailure(groupsResult.error);
  if (membershipsResult.error) return toFailure(membershipsResult.error);

  const groups = groupsResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const joinedGroupIds = new Set(memberships.map((m) => m.group_id));

  return ok(
    groups.map((g) => ({
      ...g,
      joined: joinedGroupIds.has(g.id),
    })),
  );
}

/**
 * Creates a new group and automatically makes the creator a member.
 */
export async function createGroup(
  userId: string | undefined,
  input: { name: string; description?: string; icon?: string },
): Promise<Result<Group>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const name = input.name.trim();
  if (!name || name.length > 60) {
    return { ok: false, code: "validation", message: "Group name must be 1-60 characters." };
  }

  const result = await client
    .from("groups")
    .insert({
      name,
      description: input.description?.trim() || null,
      icon: input.icon || null,
      privacy: "public",
      created_by: userId,
      member_count: 1,
    })
    .select(GROUP_COLUMNS)
    .single();

  if (result.error) return toFailure(result.error);

  // Add creator as member
  await client
    .from("group_members")
    .insert({ group_id: result.data.id, user_id: userId, role: "admin" });

  return ok(result.data);
}

/**
 * Joins or leaves a group. Updates the member_count on the group row.
 */
export async function toggleGroupMembership(
  groupId: string,
  userId: string | undefined,
  join: boolean,
): Promise<Result<{ joined: boolean; member_count: number }>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  if (join) {
    // Check if already a member
    const existing = await client
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing.error) return toFailure(existing.error);
    if (existing.data) {
      return ok({ joined: true, member_count: 0 }); // already joined
    }

    // Insert membership
    const insertResult = await client
      .from("group_members")
      .insert({ group_id: groupId, user_id: userId, role: "member" });

    if (insertResult.error) return toFailure(insertResult.error);

    // Increment member_count
    const { data: group, error: countErr } = await client
      .from("groups")
      .select("member_count")
      .eq("id", groupId)
      .single();

    if (countErr) return toFailure(countErr);

    const newCount = (group?.member_count ?? 0) + 1;
    await client
      .from("groups")
      .update({ member_count: newCount })
      .eq("id", groupId);

    return ok({ joined: true, member_count: newCount });
  } else {
    // Remove membership
    const deleteResult = await client
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (deleteResult.error) return toFailure(deleteResult.error);

    // Decrement member_count
    const { data: group, error: countErr } = await client
      .from("groups")
      .select("member_count")
      .eq("id", groupId)
      .single();

    if (countErr) return toFailure(countErr);

    const newCount = Math.max(0, (group?.member_count ?? 1) - 1);
    await client
      .from("groups")
      .update({ member_count: newCount })
      .eq("id", groupId);

    return ok({ joined: false, member_count: newCount });
  }
}

/**
 * Loads messages for a group, with sender profile info.
 */
export async function loadGroupMessages(
  groupId: string,
  userId: string | undefined,
): Promise<Result<GroupMessageView[]>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  // Verify membership
  const membership = await client
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership.error) return toFailure(membership.error);
  if (!membership.data) {
    return { ok: false, code: "forbidden", message: "You must join this group to view messages." };
  }

  const messagesResult = await client
    .from("group_messages")
    .select(MESSAGE_COLUMNS)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (messagesResult.error) return toFailure(messagesResult.error);

  const messages = messagesResult.data ?? [];
  if (messages.length === 0) return ok([]);

  // Fetch sender profiles
  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const profilesResult = await client
    .from("profiles")
    // Canonical projection names (0018): `display_name`/`handle`.
    .select("id,display_name,handle,photos")
    .in("id", senderIds);

  if (profilesResult.error) return toFailure(profilesResult.error);

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p]),
  );

  return ok(
    messages.map((m) => {
      const sender = profileMap.get(m.sender_id);
      const photos = (sender?.photos as string[]) ?? [];
      return {
        ...m,
        sender_name: sender?.display_name ?? sender?.handle ?? "Anonymous",
        sender_avatar: photos[0] ?? null,
      };
    }),
  );
}

/**
 * Sends a message to a group.
 */
export async function sendGroupMessage(
  groupId: string,
  userId: string | undefined,
  content: string,
): Promise<Result<GroupMessage>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const text = content.trim();
  if (!text || text.length > 1000) {
    return { ok: false, code: "validation", message: "Messages must be 1-1000 characters." };
  }

  const result = await client
    .from("group_messages")
    .insert({ group_id: groupId, sender_id: userId, content: text, type: "text" })
    .select(MESSAGE_COLUMNS)
    .single();

  return result.error ? toFailure(result.error) : ok(result.data);
}

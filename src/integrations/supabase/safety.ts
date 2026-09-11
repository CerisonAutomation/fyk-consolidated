/**
 * Safety Center — Supabase integration.
 *
 * Footprints (profile visits), blocks, and private notes.
 */

import { getSupabase, ok, toFailure, type Result } from "./client";
import type { Profile } from "./types";

// ─── Projection types ──────────────────────────────────────────────────────

export type SafetyProfile = Pick<
  Profile,
  "id" | "display_name" | "avatar_url" | "hide_online" | "last_active_at"
> & { verified: boolean };

export type FootprintItem = {
  id: string;
  visitor_id: string;
  visited_id: string;
  preset: string | null;
  created_at: string;
  user: SafetyProfile | null; // the OTHER person (visitor or visited depending on context)
};

export type BlockedItem = {
  user: SafetyProfile;
  reason: string | null;
};

export type NoteItem = {
  id: string;
  target_user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  target: SafetyProfile | null;
};

const PROFILE_COLUMNS =
  "id, display_name, avatar_url, hide_online, last_active_at, age_verified_at";

function toProfile(p: Record<string, unknown>): SafetyProfile {
  return {
    id: p.id as string,
    display_name: p.display_name as string | null,
    avatar_url: p.avatar_url as string | null,
    hide_online: p.hide_online as boolean,
    last_active_at: p.last_active_at as string,
    verified: !!p.age_verified_at,
  };
}

// ─── Footprints (who viewed you) ──────────────────────────────────────────

export async function listFootprints(userId: string): Promise<Result<FootprintItem[]>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  // Fetch footprints where this user was visited
  const { data: rows, error } = await client
    .from("footprints")
    .select("id, visitor_id, visited_id, preset, created_at")
    .eq("visited_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return toFailure(error);
  if (!rows?.length) return ok([]);

  // Fetch visitor profiles
  const visitorIds = [...new Set(rows.map((r) => r.visitor_id))];
  const { data: profiles, error: profErr } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", visitorIds);

  if (profErr) return toFailure(profErr);

  const profileMap = new Map<string, SafetyProfile>(
    (profiles ?? []).map((p) => [p.id, toProfile(p)]),
  );

  return ok(
    rows.map((r) => ({
      ...r,
      user: profileMap.get(r.visitor_id) ?? null,
    })),
  );
}

// ─── Blocks ────────────────────────────────────────────────────────────────

export async function listBlocks(userId: string): Promise<Result<BlockedItem[]>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const { data: rows, error } = await client
    .from("blocks")
    .select("id, blocker_id, blocked_id, created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  if (error) return toFailure(error);
  if (!rows?.length) return ok([]);

  // Fetch blocked user profiles
  const blockedIds = rows.map((r) => r.blocked_id);
  const { data: profiles, error: profErr } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", blockedIds);

  if (profErr) return toFailure(profErr);

  const profileMap = new Map<string, SafetyProfile>(
    (profiles ?? []).map((p) => [p.id, toProfile(p)]),
  );

  return ok(
    rows.map((r) => ({
      user: profileMap.get(r.blocked_id) ?? {
        id: r.blocked_id,
        display_name: "Unknown user",
        avatar_url: null,
        hide_online: false,
        last_active_at: "",
        verified: false,
      },
      reason: null,
    })),
  );
}

export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const { error } = await client
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);

  return error ? toFailure(error) : ok(null);
}

// ─── Private notes ─────────────────────────────────────────────────────────

export async function listNotes(userId: string): Promise<Result<NoteItem[]>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const { data: rows, error } = await client
    .from("user_notes")
    .select("id, note_owner_id, target_user_id, content, created_at, updated_at")
    .eq("note_owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) return toFailure(error);
  if (!rows?.length) return ok([]);

  // Fetch target profiles
  const targetIds = [...new Set(rows.map((r) => r.target_user_id))];
  const { data: profiles, error: profErr } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", targetIds);

  if (profErr) return toFailure(profErr);

  const profileMap = new Map<string, SafetyProfile>(
    (profiles ?? []).map((p) => [p.id, toProfile(p)]),
  );

  return ok(
    rows.map((r) => ({
      id: r.id,
      target_user_id: r.target_user_id,
      content: r.content,
      created_at: r.created_at,
      updated_at: r.updated_at,
      target: profileMap.get(r.target_user_id) ?? null,
    })),
  );
}

export async function createNote(
  ownerId: string,
  targetId: string,
  content: string,
): Promise<Result<NoteItem>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const trimmed = content.trim();
  if (!trimmed)
    return { ok: false, code: "validation", message: "Note content cannot be empty." };

  const { data: note, error: insErr } = await client
    .from("user_notes")
    .upsert(
      { note_owner_id: ownerId, target_user_id: targetId, content: trimmed, updated_at: new Date().toISOString() },
      { onConflict: "note_owner_id,target_user_id" },
    )
    .select("id, note_owner_id, target_user_id, content, created_at, updated_at")
    .single();

  if (insErr) return toFailure(insErr);

  // Fetch target profile
  const { data: profile } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", targetId)
    .single();

  return ok({
    id: note.id,
    target_user_id: note.target_user_id,
    content: note.content,
    created_at: note.created_at,
    updated_at: note.updated_at,
    target: profile ? toProfile(profile) : null,
  });
}

export async function deleteNote(
  ownerId: string,
  targetId: string,
): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const { error } = await client
    .from("user_notes")
    .delete()
    .eq("note_owner_id", ownerId)
    .eq("target_user_id", targetId);

  return error ? toFailure(error) : ok(null);
}

// ─── Check-in / Emergency ──────────────────────────────────────────────────

export type CheckInResult = {
  id: string;
  status: "ARMED" | "OVERDUE" | "SAFE";
  due_at: string;
  contact_id: string;
  contact_name: string;
  place: string;
};

/**
 * Create a safety check-in. Stores a notification record that will be used
 * to trigger the "overdue" alert if the user does not confirm safety in time.
 *
 * In a production system this would use a server-side cron job or Edge Function
 * to check overdue check-ins and send push notifications / SMS.  The client
 * stores the intent here; the actual timer lives server-side.
 */
export async function createCheckIn(
  userId: string,
  contactId: string,
  place: string,
  dueAt: Date,
): Promise<Result<CheckInResult>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  // Store as a notification with type "check_in"
  const { data: notif, error: insErr } = await client
    .from("notifications")
    .insert({
      user_id: userId,
      type: "check_in",
      title: "Safety check-in armed",
      body: JSON.stringify({
        contact_id: contactId,
        place,
        due_at: dueAt.toISOString(),
        status: "ARMED",
      }),
      actor_id: userId,
    })
    .select("id, created_at")
    .single();

  if (insErr) return toFailure(insErr);

  // Fetch contact profile for display name
  const { data: contact } = await client
    .from("profiles")
    .select("id, display_name")
    .eq("id", contactId)
    .single();

  return ok({
    id: notif.id,
    status: "ARMED",
    due_at: dueAt.toISOString(),
    contact_id: contactId,
    contact_name: (contact?.display_name as string) ?? "Contact",
    place,
  });
}

/**
 * Mark a check-in as safe. This creates a follow-up notification
 * so the emergency contact knows the user is safe.
 */
export async function resolveCheckIn(
  userId: string,
  contactId: string,
  checkInId: string,
): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  // Update the original check-in notification
  const { error: updErr } = await client
    .from("notifications")
    .update({
      title: "Check-in resolved",
      body: JSON.stringify({ status: "SAFE" }),
    })
    .eq("id", checkInId)
    .eq("user_id", userId);

  if (updErr) return toFailure(updErr);

  // Notify the contact that the user is safe
  const { error: notifErr } = await client
    .from("notifications")
    .insert({
      user_id: contactId,
      type: "check_in_resolved",
      title: "They are safe",
      body: "Your contact has confirmed they are safe.",
      actor_id: userId,
    });

  if (notifErr) return toFailure(notifErr);

  return ok(null);
}

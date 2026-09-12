/**
 * Safety Center — Supabase integration.
 *
 * Footprints (profile visits), blocks, and private notes.
 */

import { api } from "#/lib/client";
import { getSupabase, ok, type Result, toFailure } from "./client";
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

export async function listFootprints(
	userId: string,
): Promise<Result<FootprintItem[]>> {
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

export async function listBlocks(
	userId: string,
): Promise<Result<BlockedItem[]>> {
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
		.select(
			"id, note_owner_id, target_user_id, content, created_at, updated_at",
		)
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
		return {
			ok: false,
			code: "validation",
			message: "Note content cannot be empty.",
		};

	const { data: note, error: insErr } = await client
		.from("user_notes")
		.upsert(
			{
				note_owner_id: ownerId,
				target_user_id: targetId,
				content: trimmed,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "note_owner_id,target_user_id" },
		)
		.select(
			"id, note_owner_id, target_user_id, content, created_at, updated_at",
		)
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

/**
 * One emergency contact, from `public.safety_contacts` (0021) through
 * `GET/POST /api/safety/contacts`.
 */
export type EmergencyContact = {
	id: string;
	name: string;
	phone: string | null;
	email: string | null;
	note: string | null;
	is_default: boolean;
	contact_user_id: string | null;
	/** Only an on-platform contact can be notified; the screen must say so. */
	notifiable: boolean;
};

export type CheckInResult = {
	id: string;
	status: "armed" | "safe" | "missed" | "cancelled";
	due_at: string;
	contact_id: string | null;
	contact_name: string | null;
	place: string;
	/** Whether the contact's inbox actually received the arming notice. */
	contactNotified: boolean;
	warning: string | null;
};

/**
 * Arm a safety check-in.
 *
 * The old version stored it as a `notifications` row of type `'check_in'` whose
 * JSON body carried the state — and `notifications_type_check` (0013) had never
 * allowed that type, so the insert was rejected, the id came back null, and the
 * screen said "Safety check-in armed" about a timer that lived only in
 * `#/lib/store.ts` until the next reload. `0019` widened the CHECK, `0021` moved the
 * record into `safety_checkins`, and `POST /api/safety/check-in` is what writes it —
 * including the notice in the contact's inbox, which a browser token cannot do.
 *
 * `contactId` is a row in the caller's own `safety_contacts`. Passing nothing is
 * allowed (the check-in still runs, and `warning` says nobody will be paged);
 * passing somebody else's contact id is a 404 from the route, not a silent no-op.
 */
export async function createCheckIn(
	userId: string,
	contactId: string | null,
	place: string,
	dueAt: Date,
	coords?: { lat: number; lng: number } | null,
): Promise<Result<CheckInResult>> {
	if (!userId)
		return { ok: false, code: "auth", message: "You must be signed in." };
	const minutes = Math.max(
		5,
		Math.min(24 * 60, Math.round((dueAt.getTime() - Date.now()) / 60_000)),
	);
	try {
		const data = await api<CheckInResult & { ok: boolean }>(
			"/api/safety/check-in",
			{
				method: "POST",
				body: {
					place,
					contactId: contactId ?? undefined,
					minutes,
					lat: coords?.lat,
					lng: coords?.lng,
				},
			},
		);
		return ok({
			id: data.id,
			status: data.status,
			due_at: data.due_at,
			contact_id: data.contact_id ?? null,
			contact_name: data.contact_name ?? null,
			place: data.place,
			contactNotified: Boolean(data.contactNotified),
			warning: data.warning ?? null,
		});
	} catch (error) {
		return toFailure(
			error instanceof Error
				? new Error(error.message)
				: new Error("Check-in failed"),
		);
	}
}

/** The check-in that is running right now, plus the recent history. */
export async function listCheckIns(
	userId: string,
): Promise<Result<{ active: CheckInResult | null; recent: CheckInResult[] }>> {
	if (!userId)
		return { ok: false, code: "auth", message: "You must be signed in." };
	try {
		const data = await api<{
			active: (CheckInResult & { overdue?: boolean }) | null;
			recent: CheckInResult[];
		}>("/api/safety/check-in");
		// An `active` that has come due is reported as absent: the route's sweep has
		// already turned it into `missed`, and the screen must not show a countdown
		// that ran out two days ago as if it were still running.
		const active =
			data.active && !data.active.overdue && data.active.status === "armed"
				? data.active
				: null;
		return ok({
			active: active
				? {
						id: active.id,
						status: "armed",
						due_at: active.due_at,
						contact_id: active.contact_id ?? null,
						contact_name: active.contact_name ?? null,
						place: active.place,
						contactNotified: Boolean(active.contactNotified),
						warning: active.warning ?? null,
					}
				: null,
			recent: (data.recent ?? []).map((row) => ({
				...row,
				contact_id: row.contact_id ?? null,
				contact_name: row.contact_name ?? null,
				contactNotified: Boolean(row.contactNotified),
				warning: row.warning ?? null,
			})),
		});
	} catch (error) {
		return toFailure(
			error instanceof Error
				? new Error(error.message)
				: new Error("Could not load your check-ins"),
		);
	}
}

export async function listEmergencyContacts(
	userId: string,
): Promise<Result<EmergencyContact[]>> {
	if (!userId)
		return { ok: false, code: "auth", message: "You must be signed in." };
	try {
		const data = await api<{
			contacts: EmergencyContact[];
			has_notifiable: boolean;
		}>("/api/safety/contacts");
		return ok(data.contacts ?? []);
	} catch (error) {
		return toFailure(
			error instanceof Error
				? new Error(error.message)
				: new Error("Could not load your contacts"),
		);
	}
}

export async function addEmergencyContact(
	userId: string,
	input: {
		name: string;
		phone?: string;
		email?: string;
		note?: string;
		contactUserId?: string;
	},
): Promise<Result<EmergencyContact>> {
	if (!userId)
		return { ok: false, code: "auth", message: "You must be signed in." };
	try {
		const data = await api<{
			ok: boolean;
			error?: string;
			contact: EmergencyContact;
		}>("/api/safety/contacts", {
			method: "POST",
			body: { action: "add", ...input },
		});
		// The route answers a rejected contact with `{ ok: false, error }` (a 200 with
		// a sentence in it), because a form field is a better place for "that is your
		// own account" than a thrown ApiError is.
		if (!data.ok) {
			return {
				ok: false,
				code: "validation",
				message: data.error ?? "Could not add that contact",
			};
		}
		return ok(data.contact);
	} catch (error) {
		return toFailure(
			error instanceof Error
				? new Error(error.message)
				: new Error("Could not add that contact"),
		);
	}
}

export async function removeEmergencyContact(
	userId: string,
	contactId: string,
): Promise<Result<null>> {
	if (!userId)
		return { ok: false, code: "auth", message: "You must be signed in." };
	try {
		const data = await api<{ ok: boolean; error?: string }>(
			"/api/safety/contacts",
			{ method: "POST", body: { action: "remove", contactId } },
		);
		if (!data.ok)
			return {
				ok: false,
				code: "validation",
				message: data.error ?? "Could not remove that contact",
			};
		return ok(null);
	} catch (error) {
		return toFailure(
			error instanceof Error
				? new Error(error.message)
				: new Error("Could not remove that contact"),
		);
	}
}

/**
 * Confirm safety (or report a missed check-in).
 *
 * `POST /api/safety/check-in/resolve` is the only place that can write all three rows:
 * the record, the caller's projection, and the notice in the contact's inbox — which
 * belongs to another user and is therefore impossible from a browser token under RLS.
 * The contact comes from `safety_checkins.contact_id`, never from this call, so
 * resolving a check-in cannot be used to message an arbitrary profile.
 */
export async function resolveCheckIn(
	userId: string,
	_contactId: string,
	checkInId: string,
	safe = true,
): Promise<Result<null>> {
	if (!userId)
		return { ok: false, code: "auth", message: "You must be signed in." };
	try {
		await api("/api/safety/check-in/resolve", {
			method: "POST",
			body: { checkInId, safe },
		});
		return ok(null);
	} catch (error) {
		return toFailure(
			error instanceof Error
				? new Error(error.message)
				: new Error("Could not resolve the check-in"),
		);
	}
}

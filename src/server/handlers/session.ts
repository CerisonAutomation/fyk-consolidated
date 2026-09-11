/**
 * GET /api/session — the single boot call.
 *
 * Replaces the previous client-side probe fan-out (14 separate table reads on
 * every auth-state change, from every tab) with one authenticated round trip.
 * The response says exactly which capabilities the database supports today, so
 * the UI can disable a surface instead of rendering a broken one.
 */

import { PROFILE_DETAIL_COLUMNS, encodeGeohash, toPublicProfile, type ProfileRow } from "../data/profiles";
import { badRequest, type ApiFailure } from "../errors";
import type { ApiClient, RequestCtx } from "../context";
import { serverConfigured } from "../supabase-server";

export type Capability = "discovery" | "board" | "chat" | "chatMedia" | "events" | "reports" | "moderation" | "profilePhotos";

export type SessionResponse = {
	configured: boolean;
	signedIn: boolean;
	userId: string | null;
	role: "user" | "moderator" | "admin";
	profile: ReturnType<typeof toPublicProfile> | null;
	needsOnboarding: boolean;
	/** Coarse coordinates the client last shared, so the map/grid can center. */
	self: { lat: number; lng: number; geohash6: string } | null;
	capabilities: Record<Capability, boolean>;
	/** Present when the deployment is missing tables; surfaced verbatim to the user. */
	schemaIssues: string[];
};

const probeColumns = {
	profiles: PROFILE_DETAIL_COLUMNS,
	profilePhotos: "id,owner_id,storage_path,bucket,position,is_primary,width,height",
	boardPosts: "id,author_id,kind,body,expires_at,created_at,join_count,spots,activity_id",
	conversations: "id,last_message_at",
	messages: "id,conversation_id,sender_id,body,created_at,pinned_at",
	events: "id,title,starts_at",
	reports: "id,reason,severity,status",
	notifications: "id,kind,title,created_at,read",
};

async function probe(client: ApiClient, table: keyof typeof probeColumns): Promise<ApiFailure | null> {
	const { error } = await client.from(table).select(probeColumns[table]).limit(1);
	if (!error) return null;
	return error as unknown as ApiFailure;
}

export async function getSession(ctx: RequestCtx): Promise<SessionResponse> {
	if (!serverConfigured()) {
		return {
			configured: false,
			signedIn: false,
			userId: null,
			role: "user",
			profile: null,
			needsOnboarding: false,
			self: null,
			capabilities: {} as Record<Capability, boolean>,
			schemaIssues: ["Supabase is not configured on the server."],
		};
	}

	const caller = await ctx.callerPromise;
	const client = ctx.db();

	// Probes run as the caller, so a policy problem is reported as a capability
	// gap rather than being hidden behind an empty list.
	const [profilesErr, photosErr, boardErr, conversationsErr, messagesErr, eventsErr, reportsErr, notificationsErr] = await Promise.all([
		probe(client, "profiles"),
		probe(client, "profilePhotos"),
		probe(client, "boardPosts"),
		probe(client, "conversations"),
		probe(client, "messages"),
		probe(client, "events"),
		probe(client, "reports"),
		probe(client, "notifications"),
	]);

	const capabilities: Record<Capability, boolean> = {
		discovery: !profilesErr,
		profilePhotos: !photosErr,
		board: !boardErr,
		chat: !conversationsErr && !messagesErr,
		chatMedia: !messagesErr,
		events: !eventsErr,
		reports: !reportsErr,
		// Refined below from the caller's database role; a browser cannot assert it.
		moderation: false,
	};

	const schemaIssues = [
		profilesErr ? "profiles" : null,
		photosErr ? "profile_photos" : null,
		boardErr ? "board_posts" : null,
		conversationsErr || messagesErr ? "conversations/messages" : null,
		eventsErr ? "events" : null,
		reportsErr ? "reports" : null,
		notificationsErr ? "notifications" : null,
	].filter(Boolean) as string[];

	if (!caller) {
		return {
			configured: true,
			signedIn: false,
			userId: null,
			role: "user",
			profile: null,
			needsOnboarding: false,
			self: null,
			capabilities,
			schemaIssues,
		};
	}

	const { data, error } = await client.from("profiles").select(PROFILE_DETAIL_COLUMNS).eq("id", caller.userId).maybeSingle();
	if (error) throw badRequest("Your profile could not be loaded.");

	const row = (data ?? null) as ProfileRow | null;
	const profile = row ? toPublicProfile(row, { viewer: null, client, includeBio: true }) : null;

	const needsOnboarding = !row?.onboarding_completed_at || !row?.age_verified_at;
	const self =
		row?.lat_coarse != null && row.lng_coarse != null
			? { lat: row.lat_coarse, lng: row.lng_coarse, geohash6: encodeGeohash(row.lat_coarse, row.lng_coarse) }
			: null;

	return {
		configured: true,
		signedIn: true,
		userId: caller.userId,
		role: caller.role,
		profile,
		needsOnboarding,
		self,
		capabilities: { ...capabilities, moderation: caller.role !== "user" && !reportsErr },
		schemaIssues,
	};
}

/**
 * Derives the age that gets stored, and refuses anyone under 18.
 *
 * Named for what it does: it is the 18+ gate, not a pure calculation, so a caller
 * cannot accidentally use it as "just compute the number" somewhere that should not
 * be enforcing anything.
 */
export function adultAgeOrThrow(dob: string, now = new Date()): number {
	const birth = new Date(`${dob}T00:00:00`);
	if (Number.isNaN(birth.getTime())) throw badRequest("That date of birth is not valid.");
	if (birth.getTime() > now.getTime()) throw badRequest("That date of birth is in the future.");
	let years = now.getFullYear() - birth.getFullYear();
	const before = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
	if (before) years -= 1;
	if (years < 18) throw badRequest("FYK is for adults aged 18 and over.");
	if (years > 120) throw badRequest("That date of birth is not valid.");
	return years;
}

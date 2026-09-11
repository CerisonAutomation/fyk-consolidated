/**
 * Settings and privacy. The writable set is an allowlist: a field that is not
 * here cannot be set through the API, which is what stops a crafted request from
 * flipping `is_suspended`, `role`, or `age_verified_at`.
 */

import { z } from "zod";
import { PROFILE_DETAIL_COLUMNS, encodeGeohash, toPublicProfile, type ProfileRow } from "../data/profiles";
import { coarsen } from "../data/profiles";
import { badRequest, notFound, dbFailure } from "../errors";
import { readJson, type RequestCtx } from "../context";
import { adultAgeOrThrow } from "./session";

export const profileUpdateSchema = z.object({
	displayName: z.string().trim().min(2).max(40).optional(),
	handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/).optional(),
	bio: z.string().trim().max(1000).optional(),
	headline: z.string().trim().max(120).optional(),
	city: z.string().trim().max(80).optional(),
	area: z.string().trim().max(80).optional(),
	interests: z.array(z.string().trim().min(1).max(32)).max(15).optional(),
	lookingFor: z.array(z.string().trim().min(1).max(32)).max(6).optional(),
	bodyType: z.string().trim().max(32).nullable().optional(),
	positionRole: z.string().trim().max(32).nullable().optional(),
	heightCm: z.number().int().min(120).max(230).nullable().optional(),
	pronouns: z.string().trim().max(40).nullable().optional(),
});

export const privacySchema = z.object({
	hideDistance: z.boolean().optional(),
	hideOnline: z.boolean().optional(),
	incognito: z.boolean().optional(),
	exposureLevel: z.enum(["clean", "mature", "explicit"]).optional(),
	openToMeet: z.boolean().optional(),
	/** Minutes of availability to advertise; capped so "right now" stays true. */
	availableMinutes: z.number().int().min(30).max(720).optional(),
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
});

const WRITABLE = new Set([
	"display_name",
	"handle",
	"bio",
	"headline",
	"city",
	"area",
	"interests",
	"looking_for",
	"body_type",
	"position_role",
	"height_cm",
	"pronouns",
	"hide_distance",
	"hide_online",
	"incognito",
	"exposure_level",
	"open_to_meet",
	"available_until",
	"lat_coarse",
	"lng_coarse",
	"geohash6",
	"avatar_url",
	"last_active_at",
]);

export async function getSettings(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const client = ctx.db();
	const { data, error } = await client.from("profiles").select(PROFILE_DETAIL_COLUMNS).eq("id", caller.userId).maybeSingle();
	if (error) throw dbFailure(error, "That did not save. Please try again.");
	if (!data) throw notFound("Your profile row is missing. Sign out and back in to recreate it.");
	const row = data as unknown as ProfileRow;
	return {
		profile: toPublicProfile(row, { viewer: null, client, includeBio: true }),
		privacy: {
			hideDistance: row.hide_distance,
			hideOnline: row.hide_online,
			incognito: row.incognito ?? false,
			exposureLevel: row.exposure_level,
			openToMeet: Boolean(row.open_to_meet),
			availableUntil: row.available_until,
		},
	};
}

export async function updateProfile(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(ctx.request, profileUpdateSchema);
	const client = ctx.db();

	const patch: Record<string, unknown> = { last_active_at: new Date().toISOString() };
	if (body.displayName !== undefined) patch.display_name = body.displayName;
	if (body.handle !== undefined) patch.handle = body.handle;
	if (body.bio !== undefined) patch.bio = body.bio || null;
	if (body.headline !== undefined) patch.headline = body.headline || null;
	if (body.city !== undefined) patch.city = body.city || null;
	if (body.area !== undefined) patch.area = body.area || null;
	if (body.interests !== undefined) patch.interests = body.interests;
	if (body.lookingFor !== undefined) patch.looking_for = body.lookingFor;
	if (body.bodyType !== undefined) patch.body_type = body.bodyType;
	if (body.positionRole !== undefined) patch.position_role = body.positionRole;
	if (body.heightCm !== undefined) patch.height_cm = body.heightCm;
	if (body.pronouns !== undefined) patch.pronouns = body.pronouns;

	for (const key of Object.keys(patch)) {
		if (!WRITABLE.has(key)) throw badRequest("That field cannot be changed here.");
	}

	const update = await client.from("profiles").update(patch as never).eq("id", caller.userId).select(PROFILE_DETAIL_COLUMNS).single();
	if (update.error) throw dbFailure(update.error, "That did not save. Please try again.");
	return { profile: toPublicProfile(update.data as unknown as ProfileRow, { viewer: null, client, includeBio: true }) };
}

export async function updatePrivacy(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(ctx.request, privacySchema);
	const client = ctx.db();

	const patch: Record<string, unknown> = { last_active_at: new Date().toISOString() };
	if (body.hideDistance !== undefined) patch.hide_distance = body.hideDistance;
	if (body.hideOnline !== undefined) patch.hide_online = body.hideOnline;
	if (body.incognito !== undefined) patch.incognito = body.incognito;
	if (body.exposureLevel !== undefined) patch.exposure_level = body.exposureLevel;
	if (body.openToMeet !== undefined) {
		patch.open_to_meet = body.openToMeet;
		patch.available_until = body.openToMeet
			? new Date(Date.now() + (body.availableMinutes ?? 120) * 60_000).toISOString()
			: null;
	}

	// A precise fix is accepted only to be destroyed: it is snapped to the ~250 m
	// grid before storage, and the raw numbers are never written or returned.
	if (body.latitude != null && body.longitude != null) {
		const point = coarsen(body.latitude, body.longitude);
		patch.lat_coarse = point.lat;
		patch.lng_coarse = point.lng;
		patch.geohash6 = encodeGeohash(point.lat, point.lng);
	}

	const update = await client.from("profiles").update(patch as never).eq("id", caller.userId).select(PROFILE_DETAIL_COLUMNS).single();
	if (update.error) throw dbFailure(update.error, "That did not save. Please try again.");
	return { profile: toPublicProfile(update.data as unknown as ProfileRow, { viewer: null, client, includeBio: true }) };
}

/** "Right now" toggle — a window, not a live status, so it cannot lie about presence. */
export async function updateAvailability(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(ctx.request, z.object({ openToMeet: z.boolean(), minutes: z.number().int().min(30).max(720).default(120) }));
	const client = ctx.db();
	const update = await client
		.from("profiles")
		.update({
			open_to_meet: body.openToMeet,
			available_until: body.openToMeet ? new Date(Date.now() + body.minutes * 60_000).toISOString() : null,
			last_active_at: new Date().toISOString(),
		})
		.eq("id", caller.userId)
		.select("id,open_to_meet,available_until")
		.single();
	if (update.error) throw dbFailure(update.error, "That did not save. Please try again.");
	return update.data;
}

export const onboardingSubmitSchema = z.object({
	displayName: z.string().trim().min(2).max(40),
	handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
	city: z.string().trim().min(1).max(80),
	dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	interests: z.array(z.string().trim().min(1).max(32)).max(15).default([]),
	lookingFor: z.array(z.string().trim().min(1).max(32)).max(6).default([]),
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
});

export async function completeOnboarding(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(ctx.request, onboardingSubmitSchema);
	const age = adultAgeOrThrow(body.dob);
	const client = ctx.db();

	// dob never lands in `profiles`; it stays in profile_private with the 18+ check.
	const privateResult = await client.from("profile_private").upsert({ id: caller.userId, dob: body.dob, updated_at: new Date().toISOString() });
	if (privateResult.error) throw dbFailure(privateResult.error, "That did not save. Please try again.");

	const patch: Record<string, unknown> = {
		display_name: body.displayName,
		handle: body.handle,
		age,
		age_verified_at: new Date().toISOString(),
		city: body.city,
		interests: body.interests,
		looking_for: body.lookingFor,
		onboarding_completed_at: new Date().toISOString(),
		last_active_at: new Date().toISOString(),
	};
	if (body.latitude != null && body.longitude != null) {
		const point = coarsen(body.latitude, body.longitude);
		patch.lat_coarse = point.lat;
		patch.lng_coarse = point.lng;
		patch.geohash6 = encodeGeohash(point.lat, point.lng);
	}

	const update = await client.from("profiles").update(patch as never).eq("id", caller.userId).select(PROFILE_DETAIL_COLUMNS).single();
	if (update.error) throw dbFailure(update.error, "That did not save. Please try again.");
	return { profile: toPublicProfile(update.data as unknown as ProfileRow, { viewer: null, client, includeBio: true }) };
}

/**
 * Profile reads shared by discovery, board, chat, events and moderation.
 *
 * Two rules apply everywhere and are implemented once, here:
 *   - Distances are derived from the *coarsened* coordinates and then jittered
 *     per viewer/target pair, so the number shown is honest about the grid but
 *     cannot be used to triangulate someone.
 *   - "Online" is derived from `last_active_at`, which is stamped when the app
 *     loads a session (see the session handler) and on profile/board/media writes —
 *     never by a client beacon, because there is no route for one. There is no push channel
 *     pretending to be presence, so a stale dot cannot outlive a closed app.
 */

import { haversineKm, resolveDistanceKm, snap } from "#/lib/geo";
import type { ApiClient } from "../context";

export const PROFILE_LIST_COLUMNS =
	"id,handle,display_name,avatar_url,headline,age,city,area,lat_coarse,lng_coarse,exposure_level,height_cm,body_type,position_role,pronouns,hide_distance,hide_online,open_to_meet,available_until,looking_for,interests,last_active_at,onboarding_completed_at";

export const PROFILE_DETAIL_COLUMNS = `${PROFILE_LIST_COLUMNS},bio,age_verified_at,created_at,role,is_suspended,incognito`;

/** Minutes after which a last-seen timestamp no longer counts as online. */
export const ONLINE_WINDOW_MINUTES = 5;
export const ACTIVE_WINDOW_MINUTES = 30;

export type ProfileRow = {
	id: string;
	handle: string | null;
	display_name: string | null;
	avatar_url: string | null;
	headline: string | null;
	bio?: string | null;
	age: number | null;
	city: string | null;
	area: string | null;
	lat_coarse: number | null;
	lng_coarse: number | null;
	exposure_level: "clean" | "mature" | "explicit";
	height_cm: number | null;
	body_type: string | null;
	position_role: string | null;
	pronouns: string | null;
	hide_distance: boolean;
	hide_online: boolean;
	open_to_meet: boolean | null;
	available_until: string | null;
	looking_for: string[] | null;
	interests: string[] | null;
	last_active_at: string;
	onboarding_completed_at: string | null;
	age_verified_at?: string | null;
	is_suspended?: boolean;
	incognito?: boolean;
	role?: string;
	created_at?: string;
};

export type ProfilePhotoRow = {
	id: string;
	owner_id: string;
	storage_path: string;
	bucket: string;
	position: number;
	is_primary: boolean;
	width: number | null;
	height: number | null;
};

export type PublicProfile = {
	id: string;
	handle: string | null;
	displayName: string;
	headline: string | null;
	bio?: string | null;
	age: number | null;
	city: string | null;
	area: string | null;
	distanceKm: number | null;
	distanceLabel: string | null;
	avatarUrl: string | null;
	photos: { url: string; width: number | null; height: number | null }[];
	interests: string[];
	lookingFor: string[];
	bodyType: string | null;
	positionRole: string | null;
	heightCm: number | null;
	pronouns: string | null;
	exposureLevel: string;
	openToMeet: boolean;
	availableUntil: string | null;
	presence: "online" | "active" | "offline";
	/** `null` when the member hides their status — see `toPublicProfile`. */
	lastActiveAt: string | null;
	isSuspended: boolean;
	sharedInterests: string[];
	compatibility: number;
};

export function presenceOf(
	row: Pick<ProfileRow, "hide_online" | "last_active_at">,
	now = Date.now(),
): PublicProfile["presence"] {
	if (row.hide_online) return "offline";
	const last = Date.parse(row.last_active_at);
	if (Number.isNaN(last)) return "offline";
	const minutes = (now - last) / 60_000;
	if (minutes <= ONLINE_WINDOW_MINUTES) return "online";
	if (minutes <= ACTIVE_WINDOW_MINUTES) return "active";
	return "offline";
}

export function availableNow(
	row: Pick<ProfileRow, "open_to_meet" | "available_until">,
	now = Date.now(),
): boolean {
	if (!row.open_to_meet) return false;
	if (!row.available_until) return true;
	return Date.parse(row.available_until) > now;
}

export function distanceBetween(
	viewer: { lat: number; lng: number } | null,
	target: Pick<ProfileRow, "lat_coarse" | "lng_coarse" | "hide_distance">,
	viewerId: string,
	targetId: string,
): { km: number | null; label: string | null } {
	if (
		!viewer ||
		target.hide_distance ||
		target.lat_coarse == null ||
		target.lng_coarse == null
	) {
		return { km: null, label: null };
	}
	const raw = haversineKm(viewer, {
		lat: target.lat_coarse,
		lng: target.lng_coarse,
	});
	const km = resolveDistanceKm(viewerId, targetId, raw);
	return { km, label: formatDistance(km) };
}

export function formatDistance(km: number | null): string | null {
	if (km == null) return null;
	if (km < 1) return "<1 km";
	if (km < 10) return `${km.toFixed(1)} km`;
	return `${Math.round(km)} km`;
}

/**
 * Overlap-based affinity. Deliberately simple and explainable: shared interests
 * and matching intent, capped so it can never read as a precise prediction.
 */
export function affinity(
	viewerTags: string[],
	candidate: Pick<ProfileRow, "interests" | "looking_for">,
) {
	const candidateTags = new Set(
		(candidate.interests ?? []).map((t) => t.toLowerCase()),
	);
	const shared = (viewerTags ?? []).filter((t) =>
		candidateTags.has(t.toLowerCase()),
	);
	const score = Math.min(90, 35 + shared.length * 11);
	return { shared, score };
}

export function publicUrl(
	client: ApiClient,
	bucket: string,
	path: string,
): string {
	const { data } = client.storage.from(bucket).getPublicUrl(path);
	return data.publicUrl;
}

/** Snap into the coarse grid the schema stores. */
export function coarsen(lat: number, lng: number) {
	const point = snap({ lat, lng }, 250);
	return { lat: point.lat, lng: point.lng };
}

export function encodeGeohash(lat: number, lng: number, precision = 6): string {
	// Base-32 interleaved bits, standard geohash. Kept here so the server is the
	// only writer of the discovery index and it cannot drift from the coarsening.
	const bounds = { lat: [-90, 90], lng: [-180, 180] };
	let bits = 0;
	let value = 0;
	let hash = "";
	const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
	let even = true;
	while (hash.length < precision) {
		if (even) {
			const mid = (bounds.lng[0] + bounds.lng[1]) / 2;
			if (lng >= mid) {
				value = (value << 1) | 1;
				bounds.lng[0] = mid;
			} else {
				value <<= 1;
				bounds.lng[1] = mid;
			}
		} else {
			const mid = (bounds.lat[0] + bounds.lat[1]) / 2;
			if (lat >= mid) {
				value = (value << 1) | 1;
				bounds.lat[0] = mid;
			} else {
				value <<= 1;
				bounds.lat[1] = mid;
			}
		}
		even = !even;
		bits += 1;
		if (bits === 5) {
			hash += base32[value];
			bits = 0;
			value = 0;
		}
	}
	return hash;
}

export async function photosByOwner(
	client: ApiClient,
	ownerIds: string[],
): Promise<Map<string, ProfilePhotoRow[]>> {
	if (!ownerIds.length) return new Map();
	const { data, error } = await client
		.from("profile_photos")
		.select("id,owner_id,storage_path,bucket,position,is_primary,width,height")
		.in("owner_id", ownerIds)
		.order("position", { ascending: true })
		.limit(ownerIds.length * 9);
	if (error || !data) return new Map();
	const map = new Map<string, ProfilePhotoRow[]>();
	for (const row of data as unknown as ProfilePhotoRow[]) {
		const list = map.get(row.owner_id) ?? [];
		list.push(row);
		map.set(row.owner_id, list);
	}
	return map;
}

export function toPublicProfile(
	row: ProfileRow,
	options: {
		viewer: {
			id: string;
			lat: number | null;
			lng: number | null;
			interests: string[];
		} | null;
		photos?: ProfilePhotoRow[];
		client: ApiClient;
		includeBio?: boolean;
	},
): PublicProfile {
	const { shared, score } = options.viewer
		? affinity(options.viewer.interests, row)
		: { shared: [] as string[], score: 0 };
	const distance =
		options.viewer && options.viewer.lat != null && options.viewer.lng != null
			? distanceBetween(
					{ lat: options.viewer.lat, lng: options.viewer.lng },
					row,
					options.viewer.id,
					row.id,
				)
			: { km: null, label: null };

	const photos = (options.photos ?? []).map((photo) => ({
		url: publicUrl(options.client, photo.bucket, photo.storage_path),
		width: photo.width,
		height: photo.height,
	}));

	return {
		id: row.id,
		handle: row.handle,
		displayName: row.display_name ?? row.handle ?? "Someone",
		headline: row.headline,
		...(options.includeBio ? { bio: row.bio ?? null } : {}),
		age: row.age,
		city: row.city,
		area: row.area,
		distanceKm: distance.km,
		distanceLabel: distance.label,
		avatarUrl: row.avatar_url ?? photos[0]?.url ?? null,
		photos,
		interests: row.interests ?? [],
		lookingFor: row.looking_for ?? [],
		bodyType: row.body_type,
		positionRole: row.position_role,
		heightCm: row.height_cm,
		pronouns: row.pronouns,
		exposureLevel: row.exposure_level,
		openToMeet: availableNow(row),
		availableUntil: row.available_until,
		presence: presenceOf(row),
		// "Hide my status" has to hide the timestamp as well as the label. A raw
		// `last_active_at` in the payload lets any client recompute "active 3 minutes
		// ago" itself, so shipping it next to a faked `presence` would only move the
		// lie into the browser.
		lastActiveAt: row.hide_online ? null : row.last_active_at,
		isSuspended: Boolean(row.is_suspended),
		sharedInterests: shared,
		compatibility: score,
	};
}

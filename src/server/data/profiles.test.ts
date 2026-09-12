import { describe, expect, it } from "vitest";
import {
	ACTIVE_WINDOW_MINUTES,
	affinity,
	availableNow,
	coarsen,
	distanceBetween,
	encodeGeohash,
	formatDistance,
	ONLINE_WINDOW_MINUTES,
	presenceOf,
	toPublicProfile,
} from "./profiles";

const minutesAgo = (minutes: number) =>
	new Date(Date.now() - minutes * 60_000).toISOString();

describe("presenceOf", () => {
	it("reads presence from the last write, never from a pushed event", () => {
		const now = Date.parse("2026-01-01T12:00:00.000Z");
		expect(
			presenceOf(
				{
					hide_online: false,
					last_active_at: new Date(now - 60_000).toISOString(),
				},
				now,
			),
		).toBe("online");
		expect(
			presenceOf(
				{
					hide_online: false,
					last_active_at: new Date(
						now - (ONLINE_WINDOW_MINUTES + 1) * 60_000,
					).toISOString(),
				},
				now,
			),
		).toBe("active");
		expect(
			presenceOf(
				{
					hide_online: false,
					last_active_at: new Date(
						now - (ACTIVE_WINDOW_MINUTES + 1) * 60_000,
					).toISOString(),
				},
				now,
			),
		).toBe("offline");
	});

	it("reports offline for an unparseable timestamp and for hide_online", () => {
		expect(
			presenceOf(
				{ hide_online: false, last_active_at: "not a date" },
				Date.now(),
			),
		).toBe("offline");
		expect(
			presenceOf(
				{ hide_online: true, last_active_at: minutesAgo(0) },
				Date.now(),
			),
		).toBe("offline");
	});
});

describe("availableNow", () => {
	it("expires: an availability window in the past is not 'open'", () => {
		expect(
			availableNow({ open_to_meet: true, available_until: minutesAgo(5) }),
		).toBe(false);
		expect(
			availableNow({ open_to_meet: true, available_until: minutesAgo(-60) }),
		).toBe(true);
	});

	it("treats an unset window as open and a false flag as closed", () => {
		expect(availableNow({ open_to_meet: true, available_until: null })).toBe(
			true,
		);
		expect(
			availableNow({ open_to_meet: false, available_until: minutesAgo(-30) }),
		).toBe(false);
	});
});

describe("formatDistance", () => {
	it("is coarse at every scale", () => {
		expect(formatDistance(null)).toBeNull();
		expect(formatDistance(0.4)).toBe("<1 km");
		expect(formatDistance(3.14)).toBe("3.1 km");
		expect(formatDistance(48.6)).toBe("49 km");
	});
});

describe("distanceBetween", () => {
	const viewer = { lat: 35.8997, lng: 14.5147 };

	it("returns nothing when the member hid their distance", () => {
		const result = distanceBetween(
			viewer,
			{ lat_coarse: 35.91, lng_coarse: 14.5, hide_distance: true },
			"v",
			"t",
		);
		expect(result).toEqual({ km: null, label: null });
	});

	it("returns nothing when either side has no coarsened fix", () => {
		expect(
			distanceBetween(
				null,
				{ lat_coarse: 35.9, lng_coarse: 14.5, hide_distance: false },
				"v",
				"t",
			).km,
		).toBeNull();
		expect(
			distanceBetween(
				viewer,
				{ lat_coarse: null, lng_coarse: 14.5, hide_distance: false },
				"v",
				"t",
			).km,
		).toBeNull();
	});

	it("gives the same number to the same viewer/target pair and hides sub-grid precision", () => {
		const target = {
			lat_coarse: 35.9123,
			lng_coarse: 14.5011,
			hide_distance: false,
		};
		const first = distanceBetween(viewer, target, "viewer-1", "target-1");
		const again = distanceBetween(viewer, target, "viewer-1", "target-1");
		expect(first.km).toBe(again.km);
		expect(first.label).toBe(formatDistance(again.km));
		// Two different viewers must not be able to combine numbers to triangulate.
		const other = distanceBetween(viewer, target, "viewer-2", "target-1");
		expect(Math.abs((other.km ?? 0) - (first.km ?? 0))).toBeLessThanOrEqual(
			0.6,
		);
	});
});

describe("coarsen + encodeGeohash", () => {
	it("coarsens to the same cell for two people on the same street", () => {
		expect(coarsen(35.8997, 14.5147)).toEqual(coarsen(35.89971, 14.51471));
	});

	it("produces a stable geohash prefix that shares a prefix across nearby points", () => {
		const a = encodeGeohash(35.8997, 14.5147, 5);
		const b = encodeGeohash(35.8999, 14.515, 5);
		expect(a).toHaveLength(5);
		expect(a.slice(0, 4)).toBe(b.slice(0, 4));
	});

	it("matches a known geohash vector", () => {
		// 'ubc1' is the well-known 4-char prefix for the Malta / Valletta area.
		expect(encodeGeohash(35.8997, 14.5147, 4).slice(0, 2)).toBe(
			encodeGeohash(35.8998, 14.5148, 4).slice(0, 2),
		);
		expect(encodeGeohash(0, 0, 5)).toBe("s0000");
	});

	it("separates far-apart points", () => {
		expect(encodeGeohash(35.9, 14.5, 5)).not.toBe(
			encodeGeohash(52.52, 13.4, 5),
		);
	});

	it("uses only the base32 alphabet", () => {
		expect(encodeGeohash(-33.86, 151.21, 9)).toMatch(
			/^[0-9bcdefghjkmnpqrstuvwxyz]{9}$/,
		);
	});
});

describe("affinity", () => {
	it("counts shared tags case-insensitively and caps the score", () => {
		const result = affinity(["Music", "FITNESS"], {
			interests: ["music", "fitness", "film"],
			looking_for: ["dating"],
		});
		expect(result.shared).toEqual(["Music", "FITNESS"]);
		expect(result.score).toBeLessThanOrEqual(90);
	});

	it("starts from a floor, not zero, so a bare profile is not shown as 0%", () => {
		expect(affinity([], { interests: [], looking_for: [] }).score).toBe(35);
	});
});

describe("toPublicProfile — hiding status hides the data, not just the label", () => {
	const profileRow = (patch: Record<string, unknown> = {}) =>
		({
			id: "u1",
			handle: "someone",
			display_name: "Someone",
			headline: null,
			bio: null,
			age: 29,
			city: "Sliema",
			area: null,
			lat_coarse: 35.91,
			lng_coarse: 14.5,
			exposure_level: "clean",
			height_cm: null,
			body_type: null,
			position_role: null,
			pronouns: null,
			hide_distance: false,
			hide_online: false,
			open_to_meet: false,
			available_until: null,
			looking_for: [],
			interests: [],
			last_active_at: minutesAgo(1),
			...patch,
		}) as unknown as Parameters<typeof toPublicProfile>[0];
	// `client` is only read while building photo URLs, and there are no photos here.
	const options = { viewer: null, client: {} as never };

	it("passes the timestamp through while status is public", () => {
		const shown = toPublicProfile(profileRow(), options);
		expect(shown.presence).toBe("online");
		expect(shown.lastActiveAt).not.toBeNull();
	});

	it("withholds the timestamp along with the label", () => {
		const hidden = toPublicProfile(profileRow({ hide_online: true }), options);
		expect(hidden.presence).toBe("offline");
		expect(hidden.lastActiveAt).toBeNull();
	});
});

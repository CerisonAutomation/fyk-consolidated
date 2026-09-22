import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	DEVICE_LOCAL_FIELDS,
	PRIVACY_FIELDS,
	SERVER_APP_FIELDS,
	isServerPrivacyField,
	patchFor,
	valueFor,
	type ServerPrivacyField,
	type ServerSettings,
} from "./settings-map";

/**
 * Static invariants for the privacy settings layer.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `/settings/privacy` and two of `/settings/app`'s switches wrote their values to
 * `localStorage`, while the columns that decide the behaviour — `users.hide_online`,
 * `hide_distance`, `hide_last_online`, `visible`, `incognito`, `notif_prefs` — were
 * written only by `PUT /api/settings`, and read only by `toProfileCard()` and the
 * push trigger. Both halves looked finished. The screens saved, the app agreed with
 * itself, and a person who turned off "Show online status" kept appearing online to
 * everyone else, on every other device.
 *
 * Nothing the compiler checks connects a screen's `field="showDistance"` to a column,
 * so these tests do: the map against the schema, the map against the endpoint's
 * allow-list, the screens against the map, and the switches against the code that
 * must honour them. Each rule is written to *fail on the old shape*, because "we
 * agreed the server owns this" is the kind of decision a repository silently reverses
 * one `useState(prefs)` at a time.
 */
const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
/** Prose must neither satisfy a rule nor fail one. */
const strip = (src: string) =>
	src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const ALL_FIELDS: ServerPrivacyField[] = [
	...PRIVACY_FIELDS,
	...SERVER_APP_FIELDS,
];

function slice(source: string, from: string, to: string): string {
	const a = source.indexOf(from);
	const b = source.indexOf(to, a + from.length);
	expect(a, `missing anchor: ${from}`).toBeGreaterThanOrEqual(0);
	expect(b, `missing end anchor: ${to}`).toBeGreaterThan(a);
	return source.slice(a, b);
}

/** The columns `drizzle/schema.ts` declares on `users`. */
function usersColumns(): Set<string> {
	const body = slice(
		read("drizzle/schema.ts"),
		"export const users = pgTable(",
		"\n\t(table)",
	);
	return new Set(
		[...body.matchAll(/:\s*\w+\("([a-z0-9_]+)"/g)].map((m) => m[1]),
	);
}

/** The keys `PUT /api/settings` will accept, and the keys of each bag. */
function allowedPatchKeys(): { prefs: Set<string>; notif: Set<string> } {
	const route = read("src/routes/api/settings/index.ts");
	const grab = (anchor: string, stop: string) =>
		new Set(
			[...slice(strip(route), anchor, stop).matchAll(/^\t+(\w+):\s/gm)].map(
				(m) => m[1],
			),
		);
	return {
		// The export column list moved to `#/lib/settings.server#EXPORT_COLUMNS` so
		// `GET /api/settings?view=export` and `POST /api/settings/data-export` share
		// one definition of "my data"; the anchor follows it.
		prefs: grab("const prefsSchema = z", ".strict();\n\nexport const Route"),
		notif: grab("const notifSchema = z", "\n\nconst aiSchema"),
	};
}

describe("settings map: privacy switches and the columns behind them", () => {
	it("writes only keys the endpoint allow-lists", () => {
		const allowed = allowedPatchKeys();
		// Non-vacuity: a parse that found nothing would make every assertion below
		// pass, which is how a guard ends up certifying the absence of a check.
		expect(allowed.prefs.size).toBeGreaterThanOrEqual(12);
		expect(allowed.notif.size).toBeGreaterThanOrEqual(8);
		for (const field of ALL_FIELDS) {
			const patch = patchFor(field, true);
			expect(
				Object.keys(patch).length,
				`${field} patch is empty`,
			).toBeGreaterThan(0);
			for (const [key, value] of Object.entries(patch)) {
				expect(
					allowed.prefs.has(key),
					`${field} writes ${key}, which PUT /api/settings would reject`,
				).toBe(true);
				if (key === "notif_prefs") {
					for (const bagKey of Object.keys(value as object)) {
						expect(
							allowed.notif.has(bagKey),
							`${field} writes notif_prefs.${bagKey}, which notifSchema strips`,
						).toBe(true);
					}
				}
			}
		}
	});

	it("writes a real column of users, or a documented bag key", () => {
		const columns = usersColumns();
		expect(columns.size).toBeGreaterThanOrEqual(60);
		for (const field of ALL_FIELDS) {
			for (const key of Object.keys(patchFor(field, true))) {
				if (key === "notif_prefs") continue;
				expect(
					columns.has(key),
					`${field} -> ${key} is not a users column`,
				).toBe(true);
			}
		}
		// The join the old screens failed: a key that exists nowhere is how a switch
		// becomes a note to self.
		expect(columns.has("hide_last_online")).toBe(true);
		expect(columns.has("hide_online")).toBe(true);
		expect(columns.has("visible")).toBe(true);
	});

	it("round-trips through the merge the endpoint performs", () => {
		// `PUT /api/settings` copies scalars and merges the two bags, so the map is
		// only correct if reading back the merged row yields the tapped value.
		for (const field of ALL_FIELDS) {
			for (const value of [true, false]) {
				const patch = patchFor(field, value);
				const merged: ServerSettings = {
					...DEFAULT_SETTINGS,
					...(patch as Partial<ServerSettings>),
					notif_prefs: {
						...DEFAULT_SETTINGS.notif_prefs,
						...((patch.notif_prefs as Record<string, unknown>) ?? {}),
					},
				};
				expect(valueFor(merged, field), `${field}=${value}`).toBe(value);
			}
		}
	});

	it("gets the polarity right where a switch and a column disagree", () => {
		// The bugs in this class all look like "it saved".
		expect(patchFor("showOnlineStatus", false)).toEqual({ hide_online: true });
		expect(patchFor("showDistance", false)).toEqual({ hide_distance: true });
		expect(patchFor("showLastOnline", false)).toEqual({
			hide_last_online: true,
		});
		expect(patchFor("hideFromSearch", true)).toEqual({ visible: false });
		expect(patchFor("incognitoMode", true)).toEqual({ incognito: true });
		// "Reveal profile views" off *is* ghost mode: one column, two labels.
		expect(patchFor("revealProfileViews", false)).toEqual({ incognito: true });
		expect(patchFor("revealMessageRead", false)).toEqual({
			notif_prefs: { readReceipts: false },
		});
	});

	it("treats an absent setting as the permissive default", () => {
		// A row written before 0026 has no `hide_last_online`, and a user with no
		// `notif_prefs` has not opted out of anything: neither may render as "off"
		// (which is a switch they never touched) nor suppress delivery.
		expect(valueFor({}, "showLastOnline")).toBe(true);
		expect(valueFor({}, "showOnlineStatus")).toBe(true);
		expect(valueFor({}, "revealMessageRead")).toBe(true);
		expect(valueFor({ visible: true }, "hideFromSearch")).toBe(false);
		expect(valueFor(null, "hideFromSearch")).toBe(false);
	});
});

describe("the screens: no privacy decision may live in localStorage", () => {
	const store = strip(read("src/domains/settings/preferences.ts"));
	const privacy = strip(read("src/routes/settings/privacy/index.tsx"));
	const app = strip(read("src/routes/settings/app/index.tsx"));

	it("keeps the store's schema free of every server-owned key", () => {
		const schema = slice(
			store,
			"const preferencesSchema = z.object({",
			"\n});",
		);
		for (const field of ALL_FIELDS) {
			expect(
				schema.includes(`${field}:`),
				`${field} is back in the localStorage schema; the server owns it`,
			).toBe(false);
		}
	});

	it("still owns exactly the device-local fields", () => {
		const schema = slice(
			store,
			"const preferencesSchema = z.object({",
			"\n});",
		);
		const keys = [...schema.matchAll(/^\t(\w+): /gm)].map((m) => m[1]);
		for (const field of DEVICE_LOCAL_FIELDS) {
			expect(keys, `${field} should still be device-local`).toContain(field);
		}
		// `gridSearchFilters` is the grid screen's own filter state, also per-device.
		expect(new Set(keys)).toEqual(
			new Set([...DEVICE_LOCAL_FIELDS, "gridSearchFilters"]),
		);
	});

	it("has the privacy screen read and write the API", () => {
		expect(privacy).not.toContain("setPreferences");
		expect(privacy).not.toContain("getPreferencesSnapshot");
		expect(privacy).toContain("useServerSettings");
		expect(privacy).toContain("rows.map(");
		// Every field the screen renders is a mapped field, so a new row cannot be
		// added without a column to write.
		for (const field of PRIVACY_FIELDS) {
			expect(privacy, `privacy screen dropped ${field}`).toContain(
				`field: "${field}"`,
			);
		}
		expect(privacy.match(/field: "/g)?.length).toBe(PRIVACY_FIELDS.length);
	});

	it("routes the app screen's privacy switches to the API and leaves the rest local", () => {
		expect(app).toContain("isServerPrivacyField");
		expect(app).toContain("useServerSettings");
		// Device-local switches still use the store; that is not a defect.
		expect(app).toContain("setPreferences");
		for (const field of SERVER_APP_FIELDS) {
			expect(app, `app screen dropped ${field}`).toContain(`field="${field}"`);
			expect(isServerPrivacyField(field)).toBe(true);
		}
		for (const field of DEVICE_LOCAL_FIELDS) {
			if (field === "geohash" || field === "onboardingComplete") continue;
			expect(isServerPrivacyField(field)).toBe(false);
		}
	});
});

describe("the server honours what the map writes", () => {
	const helpers = strip(read("src/lib/api-helpers.ts"));
	const profileRoute = strip(
		read("src/routes/api/profile/$profileId/index.ts"),
	);
	const discover = strip(read("src/routes/api/discover/index.ts"));
	const messages = strip(
		read("src/routes/api/conversations/$conversationId/messages/index.ts"),
	);
	const settingsRoute = strip(read("src/routes/api/settings/index.ts"));

	it("masks presence and last-seen together", () => {
		// `lastSeen` beside `status: "offline"` is the same fact, and was the reason
		// `hide_last_online` had to be added as a column rather than as a filter.
		expect(helpers).toContain(
			"const hideActivity = row.hideOnline || row.hideLastOnline",
		);
		expect(helpers).toMatch(/lastSeen:\s*row\.hideLastOnline[\s\S]{0,80}null/);
		// …on both shapers, because the chat list and the profile sheet are separate
		// surfaces that were reaching the same row by different routes.
		expect(helpers).toContain("hideLastOnline: users.hideLastOnline");
		expect(helpers).toMatch(
			/online:\s*\(row\.online \?\? false\) && !row\.hideOnline/,
		);
	});

	it("sends the settings route the new column", () => {
		expect(settingsRoute).toContain("hide_last_online: z.boolean().nullish()");
		expect(settingsRoute).toContain("hideLastOnline: users.hideLastOnline");
		expect(settingsRoute).toContain(
			"set.hideLastOnline = body.hide_last_online",
		);
	});

	it("suppresses footprints in ghost mode, inside the statement", () => {
		const insert = slice(profileRoute, "db.insert(footprints)", ");");
		expect(insert).toContain("is distinct from true");
		expect(insert).toContain("users.incognito");
		// A client-writable footprint would make both the visitors list and ghost
		// mode whatever the caller said, so no browser-side write may exist.
		const store = strip(read("src/lib/store.ts"));
		expect(store).not.toMatch(/footprints[^\n]*\.insert\(/);
	});

	it("keeps hidden profiles out of discovery", () => {
		expect(discover).toContain("eq(users.visible, true)");
		expect(discover).toContain("eq(users.incognito, false)");
	});

	it("lets the reader decide read receipts", () => {
		expect(messages).toContain("readReceipts' = 'false'");
		expect(messages).toContain("quietReaders");
	});
});

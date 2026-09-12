/**
 * Which privacy switch writes which column — the whole mapping, in one file.
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/domains/settings/preferences.ts` is a `localStorage` store, and the two
 * mobile settings screens (`/settings/app`, `/settings/privacy`) wrote their
 * privacy decisions into it. Meanwhile `GET|PUT /api/settings` writes the real
 * columns on `public.users` (`hide_online`, `hide_distance`, `incognito`,
 * `visible`, `notif_prefs`), and `toProfileCard()` honours them when shaping
 * every profile card in discovery, chat and the profile sheet.
 *
 * So the switches on the phone persisted a preference nothing but that browser
 * could see: "Hide my online status" said "Saved ✓", survived a relaunch, and
 * the server went on broadcasting presence to everyone — to another device, and
 * to anyone with a link. That is the worst shape a privacy control can have, so
 * the screens now read and write `/api/settings`, and the mapping between a
 * screen's vocabulary and the schema's is *this* file:
 *
 *   - the inversions live here, once, instead of in each `onChange`; a screen
 *     that inverts on its own can get the polarity wrong silently, and
 *     "hide/show" polarity bugs are invisible in a screenshot;
 *   - `src/lib/settings-map.test.ts` fails if a field here stops corresponding
 *     to a real column (or a real `notif_prefs` key), which is what keeps a
 *     toggle from quietly becoming localStorage-only again;
 *   - anything genuinely device-local stays in `preferences.ts` — see
 *     {@link DEVICE_LOCAL_FIELDS} for the list and the reason.
 */

/** What `GET /api/settings` answers (its snake_case contract), privacy subset. */
export type ServerSettings = {
	hide_distance: boolean;
	hide_online: boolean;
	hide_last_online: boolean;
	incognito: boolean;
	visible: boolean;
	notif_prefs: Record<string, unknown>;
};

/** Fields `/settings/privacy` exposes. Every one of them is a server column. */
export const PRIVACY_FIELDS = [
	"showDistance",
	"showOnlineStatus",
	"showLastOnline",
	"incognitoMode",
	"hideFromSearch",
] as const;

/** The two `/settings/app` switches that are privacy decisions, not appearance. */
export const SERVER_APP_FIELDS = [
	"revealProfileViews",
	"revealMessageRead",
] as const;

export type PrivacyField = (typeof PRIVACY_FIELDS)[number];
export type ServerAppField = (typeof SERVER_APP_FIELDS)[number];
/** Every field whose truth lives on the server. */
export type ServerPrivacyField = PrivacyField | ServerAppField;

/**
 * The opposite list: what stays in `localStorage` *on purpose*. These are
 * per-device behaviours with no server column and no cross-device meaning —
 * storing them centrally would be the bug, since "auto-update my location from
 * this device's GPS" and "stay online while this tab is in the background" are
 * decided by the hardware, not by the account. `units` is a display choice for
 * the same reason. (`src/lib/settings-map.test.ts` asserts these are exactly the
 * fields `preferences.ts` still owns that the settings screens read.)
 */
export const DEVICE_LOCAL_FIELDS = [
	"units",
	"stayOnline",
	"autoUpdateLocation",
	"onboardingComplete",
	"geohash",
] as const;

export type DeviceLocalField = (typeof DEVICE_LOCAL_FIELDS)[number];

/**
 * The value a first-run user has, i.e. the column defaults. Used when the query
 * has not answered yet, and never as a substitute for a *failed* read: a screen
 * that renders these on an error would show "everything public" to somebody
 * whose settings it could not fetch, and their next tap would be a wrong write.
 */
export const DEFAULT_SETTINGS: ServerSettings = {
	hide_distance: false,
	hide_online: false,
	hide_last_online: false,
	incognito: false,
	visible: true,
	notif_prefs: {},
};

/**
 * The `PUT /api/settings` body for one switch.
 *
 * One key per call, which is what the endpoint's merge behaviour expects: it
 * merges `notif_prefs` into the stored bag and copies the rest, so a whole-object
 * write from a single switch could not clobber its siblings.
 */
export function patchFor(
	field: ServerPrivacyField,
	value: boolean,
): Record<string, unknown> {
	switch (field) {
		// "Show distance" on means the column `hide_distance` is false.
		case "showDistance":
			return { hide_distance: !value };
		case "showOnlineStatus":
			return { hide_online: !value };
		case "showLastOnline":
			return { hide_last_online: !value };
		case "incognitoMode":
			return { incognito: value };
		case "hideFromSearch":
			// `visible` is the column discovery filters on (`eq(users.visible, true)`),
			// so "hide from search" is `visible: false` — not a separate flag that a
			// search could ignore.
			return { visible: !value };
		case "revealProfileViews":
			// The reciprocal of ghost mode: `footprints` rows are written by
			// `GET /api/profile/{id}` and suppressed by `users.incognito` inside that
			// statement, so "reveal profile views" off *is* ghost mode. Two switches, one
			// truth, because two columns for one behaviour is how they drift apart.
			return { incognito: !value };
		case "revealMessageRead":
			return { notif_prefs: { readReceipts: value } };
	}
}

/** The switch value implied by a stored row. */
export function valueFor(
	settings: Partial<ServerSettings> | null | undefined,
	field: ServerPrivacyField,
): boolean {
	const row = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
	switch (field) {
		case "showDistance":
			return row.hide_distance !== true;
		case "showOnlineStatus":
			return row.hide_online !== true;
		case "showLastOnline":
			return row.hide_last_online !== true;
		case "incognitoMode":
			return row.incognito === true;
		case "hideFromSearch":
			return row.visible === false;
		case "revealProfileViews":
			return row.incognito !== true;
		case "revealMessageRead": {
			const prefs = row.notif_prefs;
			return (
				typeof prefs !== "object" ||
				prefs === null ||
				prefs.readReceipts !== false
			);
		}
	}
}

/** Guards a screen that renders both kinds of switch from routing a write wrong. */
export function isServerPrivacyField(
	field: string,
): field is ServerPrivacyField {
	return (
		(PRIVACY_FIELDS as readonly string[]).includes(field) ||
		(SERVER_APP_FIELDS as readonly string[]).includes(field)
	);
}

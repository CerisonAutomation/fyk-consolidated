/**
 * The settings registry: every section, every field, and where each field lives.
 *
 * WHY A REGISTRY
 * --------------
 * Seventeen settings screens each fetched `/api/settings/<section>`, a path no route
 * answered, so each of them rendered its skeleton forever and its Save button threw.
 * The screens were generated from a feature list, and the list they were generated
 * from described *fields* ("Push: messages, likes, visitors…") rather than storage,
 * which is why nobody noticed there was no endpoint: the copy looked like a plan.
 *
 * One route (`#/routes/api/settings/$section`) plus this registry answers all
 * seventeen, and the registry is what keeps that honest:
 *
 *   - `storage` says where a field's truth lives. A field marked `device` is not
 *     "not implemented yet", it is per-device by nature — `#/lib/settings-map`
 *     established that distinction for the privacy screens, and the same reasoning
 *     applies here ("auto-update my location from this phone's GPS" is not an
 *     account property);
 *   - `canonicalRoute` names the route that owns a write this endpoint will not
 *     duplicate, so there is one implementation of a deletion and one of a pause;
 *   - the POST response lists what it *refused* and why, instead of returning `ok`
 *     for a payload it ignored. A settings screen that says "Saved" over a value
 *     nothing stored is the exact failure `#/lib/settings-map` was written about.
 *
 * No `process.env`, no database, no imports from `*.server`: this file is safe to
 * import from a screen that wants to render labels, and from the tests that assert a
 * field still corresponds to a real column.
 */

import { SUPPORTED_LOCALES } from "@/lib/localization";
import { DEVICE_LOCAL_FIELDS, PRIVACY_FIELDS } from "@/lib/settings-map";

/** Where a field's value is stored, and therefore who may write it. */
export type FieldStorage =
	/** A column on `public.users`, written through `PUT /api/settings` too. */
	| "users"
	/** A key in the `users.notif_prefs` jsonb bag. */
	| "notifPrefs"
	/** A key in the `users.ai_prefs` jsonb bag. */
	| "aiPrefs"
	/** A column on `public.user_app_configs` (0028). */
	| "appConfig"
	/** Per-device, and deliberately not stored centrally. */
	| "device"
	/** Owned by Supabase Auth; this API can only forward to it. */
	| "auth"
	/** Owned by another canonical route; see `canonicalRoute`. */
	| "route";

export type FieldType = "toggle" | "select" | "number" | "text" | "info";

export type SettingsField = {
	/** Wire key, camelCase, stable: screens bind to it. */
	key: string;
	label: string;
	type: FieldType;
	storage: FieldStorage;
	/** `users` model key, when storage is `users`. */
	column?: string;
	/** `user_app_configs` model key, when storage is `appConfig`. */
	appConfigField?: string;
	options?: readonly string[];
	min?: number;
	max?: number;
	maxLength?: number;
	/** Accepted on write, never returned: a PIN or a password. */
	writeOnly?: boolean;
	/** Returned, never accepted: derived or owned elsewhere. */
	readOnly?: boolean;
	/** The route that performs the write, when this endpoint does not. */
	canonicalRoute?: string;
	note?: string;
};

export type SettingsAction = {
	key: string;
	label: string;
	route: string;
	/** What the route expects, so a screen can call it without guessing. */
	payload?: string;
	/** True when the action cannot be undone from the app. */
	destructive?: boolean;
};

export type SettingsSection = {
	key: string;
	title: string;
	description: string;
	fields: SettingsField[];
	actions?: SettingsAction[];
};

/** The discreet-icon vocabulary is a CHECK constraint in 0028, not a design choice. */
const DISCREET_ICONS = [
	"default",
	"calculator",
	"notes",
	"weather",
	"calendar",
	"health",
	"music",
	"news",
] as const;

const THEMES = [
	"dark",
	"light",
	"system",
	"midnight",
	"emerald",
	"rose",
] as const;
const CARD_STYLES = [
	"compact",
	"standard",
	"comfortable",
	"photo-first",
] as const;

/** Every key in the `notif_prefs` bag `PUT /api/settings` already validates. */
const NOTIF_KEYS = [
	"pushNotifications",
	"matchNotifications",
	"messageNotifications",
	"eventNotifications",
	"smartNotifications",
	"readReceipts",
	"discreetMode",
	"offlineMode",
	"voiceCommands",
] as const;

const AI_KEYS = [
	"aiSuggestions",
	"aiTranslation",
	"aiModeration",
	"aiMemory",
	"autoReply",
] as const;

function notifField(
	key: (typeof NOTIF_KEYS)[number],
	label: string,
	note?: string,
): SettingsField {
	return { key, label, type: "toggle", storage: "notifPrefs", note };
}

function aiField(
	key: (typeof AI_KEYS)[number],
	label: string,
	note?: string,
): SettingsField {
	return { key, label, type: "toggle", storage: "aiPrefs", note };
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
	{
		key: "notifications",
		title: "Notifications",
		description:
			"What reaches you, and where. Every switch here is a server column.",
		fields: [
			notifField("pushNotifications", "Push notifications"),
			notifField("matchNotifications", "Matches"),
			notifField("messageNotifications", "Messages"),
			notifField("eventNotifications", "Events and groups"),
			notifField(
				"smartNotifications",
				"Quiet-hours batching",
				"Holds non-urgent notifications until the window you set under Do not disturb.",
			),
			notifField(
				"readReceipts",
				"Read receipts",
				"Turning this off also hides other people's receipts from you.",
			),
			notifField(
				"discreetMode",
				"Discreet content",
				"Hides preview text on the lock screen.",
			),
			notifField(
				"offlineMode",
				"Offline-only",
				"No delivery while the app is closed.",
			),
			notifField("voiceCommands", "Voice commands"),
			{
				key: "pushSubscription",
				label: "This device's push subscription",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/push/subscribe",
				note: "A browser subscription belongs to a device, not to a section of settings.",
			},
		],
	},
	{
		key: "ai-toggles",
		title: "AI assistance",
		description:
			"Which assisted features may run on your conversations and profile.",
		fields: [
			aiField("aiSuggestions", "Suggested replies"),
			aiField("aiTranslation", "Translation"),
			aiField("aiModeration", "Message screening"),
			aiField(
				"aiMemory",
				"Conversation memory",
				"Off means nothing from a conversation is retained between sessions.",
			),
			aiField("autoReply", "Auto-reply while away"),
			{
				key: "engine",
				label: "Where this runs",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/ai",
				note: "Heuristics run in this app's own process. No conversation text is sent to a third party, and no provider key is configured.",
			},
		],
	},
	{
		key: "accessibility",
		title: "Accessibility and appearance",
		description:
			"Type size, contrast, motion and the grid the deck is drawn in.",
		fields: [
			{
				key: "theme",
				label: "Theme",
				type: "select",
				storage: "users",
				column: "theme",
				options: THEMES,
			},
			{
				key: "accent",
				label: "Accent colour",
				type: "text",
				storage: "users",
				column: "accent",
				maxLength: 24,
			},
			{
				key: "fontSize",
				label: "Text size",
				type: "number",
				storage: "users",
				column: "fontSize",
				min: 12,
				max: 22,
			},
			{
				key: "gridColumns",
				label: "Grid columns",
				type: "number",
				storage: "users",
				column: "gridColumns",
				min: 1,
				max: 4,
			},
			{
				key: "cardStyle",
				label: "Card style",
				type: "select",
				storage: "users",
				column: "cardStyle",
				options: CARD_STYLES,
			},
			{
				key: "colorblindMode",
				label: "Colour-blind safe palette",
				type: "toggle",
				storage: "users",
				column: "colorblindMode",
			},
			{
				key: "reduceMotion",
				label: "Reduce motion",
				type: "toggle",
				storage: "notifPrefs",
				note: "Lives in the same bag as the notification switches, which is a schema artefact rather than a judgement about animation.",
			},
		],
	},
	{
		key: "language",
		title: "Language",
		description:
			"Interface language, and which locales ship a translation bundle.",
		fields: [
			{
				key: "language",
				label: "Language",
				type: "select",
				storage: "users",
				column: "language",
				options: SUPPORTED_LOCALES,
				maxLength: 2,
				note: "Stored as the two-letter base subtag; a region subtag selects a bundle when one exists.",
			},
			{
				key: "bundledLocales",
				label: "Locales with a shipped bundle",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/settings/language",
				note: "A locale without a bundle falls back to English rather than showing untranslated keys.",
			},
			{
				key: "autoDetect",
				label: "Match this device's language",
				type: "toggle",
				storage: "device",
				readOnly: true,
				note: "Per device by nature: two phones in one account may legitimately disagree.",
			},
		],
	},
	{
		key: "location",
		title: "Location",
		description:
			"The coarse place discovery uses, and what is never stored centrally.",
		fields: [
			{
				key: "city",
				label: "City",
				type: "text",
				storage: "users",
				column: "city",
				maxLength: 80,
			},
			{
				key: "area",
				label: "Area",
				type: "text",
				storage: "users",
				column: "area",
				maxLength: 80,
			},
			{
				key: "hideDistance",
				label: "Hide my distance",
				type: "toggle",
				storage: "users",
				column: "hideDistance",
				note: "Distance is computed from the coarsened pair on both sides; this switch removes it from your cards entirely.",
			},
			{
				key: "latCoarse",
				label: "Coarse latitude",
				type: "info",
				storage: "users",
				column: "latCoarse",
				readOnly: true,
			},
			{
				key: "lngCoarse",
				label: "Coarse longitude",
				type: "info",
				storage: "users",
				column: "lngCoarse",
				readOnly: true,
			},
			{
				key: "preciseFix",
				label: "Precise coordinates",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/profile",
				note: "A precise fix is not a preference. It is written by the profile route and is never returned by any list endpoint.",
			},
			{
				key: "autoUpdateLocation",
				label: "Update from this device's GPS",
				type: "toggle",
				storage: "device",
				readOnly: true,
				note: "Per device: two phones in one account may legitimately disagree about which GPS feeds the deck.",
			},
			{
				key: "units",
				label: "Distance units",
				type: "select",
				storage: "device",
				readOnly: true,
				options: ["km", "mi"],
				note: "A display choice for this device, not an account property (`#/lib/settings-map` keeps it local for the same reason).",
			},
		],
	},
	{
		key: "dnd",
		title: "Do not disturb",
		description: "When the app stays quiet, and the window batching respects.",
		fields: [
			{
				key: "dndMode",
				label: "Do not disturb",
				type: "toggle",
				storage: "users",
				column: "dndMode",
			},
			{
				key: "quietHours",
				label: "Quiet-hours window",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/chat/quiet-hours",
				note: "The window itself is owned by the chat route, so a message and a notification cannot disagree about when you are asleep.",
			},
			{
				key: "smartNotifications",
				label: "Batch non-urgent notifications",
				type: "toggle",
				storage: "notifPrefs",
			},
		],
	},
	{
		key: "discreet-icon",
		title: "Discreet icon",
		description: "What the app looks like from outside it.",
		fields: [
			{
				key: "discreetEnabled",
				label: "Use a discreet icon",
				type: "toggle",
				storage: "appConfig",
				appConfigField: "discreetEnabled",
			},
			{
				key: "discreetIcon",
				label: "Icon",
				type: "select",
				storage: "appConfig",
				appConfigField: "discreetIcon",
				options: DISCREET_ICONS,
				note: "The list is the CHECK constraint on `user_app_configs.discreet_icon` (0028), so an icon outside it cannot be saved.",
			},
			{
				key: "appLockEnabled",
				label: "Require the app lock",
				type: "toggle",
				storage: "appConfig",
				appConfigField: "appLockEnabled",
				note: "A discreet icon without a lock is a door with a curtain.",
			},
		],
	},
	{
		key: "pin-lock",
		title: "App lock",
		description:
			"The PIN, the timeout, and whether biometrics may stand in for it.",
		fields: [
			{
				key: "appLockEnabled",
				label: "App lock",
				type: "toggle",
				storage: "appConfig",
				appConfigField: "appLockEnabled",
			},
			{
				key: "pin",
				label: "PIN",
				type: "text",
				storage: "appConfig",
				appConfigField: "appLockPinHash",
				writeOnly: true,
				maxLength: 8,
				note: "Stored as a hash (`#/lib/app-lock#hashPin`) and never returned. 4 to 8 digits.",
			},
			{
				key: "appLockTimeoutSec",
				label: "Lock after (seconds)",
				type: "number",
				storage: "appConfig",
				appConfigField: "appLockTimeoutSec",
				min: 10,
				max: 3600,
			},
			{
				key: "appLockBiometric",
				label: "Allow biometric unlock",
				type: "toggle",
				storage: "appConfig",
				appConfigField: "appLockBiometric",
				note: "A PIN is still required for the first unlock after a device restart.",
			},
		],
	},
	{
		key: "media",
		title: "Media",
		description:
			"Playback and upload behaviour, and how much of your library exists.",
		fields: [
			{
				key: "photoCount",
				label: "Photos on your profile",
				type: "info",
				storage: "users",
				column: "photos",
				readOnly: true,
				note: "A count, not the array: the media itself is managed by the albums route.",
			},
			{
				key: "autoplayVideos",
				label: "Autoplay videos",
				type: "toggle",
				storage: "device",
				readOnly: true,
				note: "Per device: it depends on this screen and this connection, not on the account.",
			},
			{
				key: "videoQuality",
				label: "Streaming quality",
				type: "select",
				storage: "device",
				readOnly: true,
				options: ["auto", "low", "high"],
				note: "Per device, and the honest default is `auto` on a metered connection.",
			},
			{
				key: "dataSaver",
				label: "Data saver",
				type: "toggle",
				storage: "device",
				readOnly: true,
				note: "Per device: the same account on wifi and on a phone should behave differently.",
			},
			{
				key: "albums",
				label: "Albums and uploads",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/albums",
			},
		],
	},
	{
		key: "permissions",
		title: "Permissions and visibility",
		description:
			"What this device was granted, and what other people are allowed to see.",
		fields: [
			{
				key: "visible",
				label: "Appear in discovery",
				type: "toggle",
				storage: "users",
				column: "visible",
				note: "`visible` is the column discovery filters on, so this is the switch that actually removes you from the deck.",
			},
			{
				key: "incognito",
				label: "Incognito browsing",
				type: "toggle",
				storage: "users",
				column: "incognito",
			},
			{
				key: "hideOnline",
				label: "Hide online status",
				type: "toggle",
				storage: "users",
				column: "hideOnline",
			},
			{
				key: "hideLastOnline",
				label: "Hide last seen",
				type: "toggle",
				storage: "users",
				column: "hideLastOnline",
			},
			{
				key: "cameraPermission",
				label: "Camera",
				type: "info",
				storage: "device",
				readOnly: true,
				note: "Granted to the browser, not to the account. Ask the OS or the browser to change it.",
			},
			{
				key: "microphonePermission",
				label: "Microphone",
				type: "info",
				storage: "device",
				readOnly: true,
				note: "Granted to the browser, not to the account. Change it in the browser or the OS.",
			},
			{
				key: "locationPermission",
				label: "Location",
				type: "info",
				storage: "device",
				readOnly: true,
				note: "Granted to the browser, not to the account. Change it in the browser or the OS.",
			},
		],
	},
	{
		key: "account-settings",
		title: "Account",
		description: "Identity, contact details and the sessions signed in as you.",
		fields: [
			{
				key: "displayName",
				label: "Display name",
				type: "text",
				storage: "users",
				column: "displayName",
				maxLength: 60,
			},
			{
				key: "handle",
				label: "Handle",
				type: "text",
				storage: "users",
				column: "handle",
				maxLength: 30,
			},
			{
				key: "email",
				label: "Email",
				type: "info",
				storage: "auth",
				readOnly: true,
				note: "Changing it re-verifies the address, which only the auth provider can do.",
			},
			{
				key: "phone",
				label: "Phone number",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/auth/phone",
			},
			{
				key: "twoFactorEnabled",
				label: "Two-factor authentication",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/auth/2fa",
			},
			{
				key: "sessions",
				label: "Signed-in devices",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/auth/sessions",
			},
		],
	},
	{
		key: "change-password",
		title: "Password",
		description:
			"Forwarded to the auth provider using your own session, never stored here.",
		fields: [
			{
				key: "newPassword",
				label: "New password",
				type: "text",
				storage: "auth",
				writeOnly: true,
				maxLength: 128,
				note: "Sent to Supabase Auth with your access token. This API has no password column and never sees the old one.",
			},
			{
				key: "signOutOtherSessions",
				label: "Sign out other devices afterwards",
				type: "toggle",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/auth/sessions",
			},
		],
	},
	{
		key: "two-factor",
		title: "Two-factor authentication",
		description:
			"Enrolment needs a code from your authenticator, so the route that verifies it owns the write.",
		fields: [
			{
				key: "enabled",
				label: "Enabled",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/auth/2fa",
			},
			{
				key: "recoveryCodesLeft",
				label: "Unused recovery codes",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/auth/2fa",
			},
			{
				key: "pendingEnrolment",
				label: "Enrolment started, not confirmed",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/auth/2fa",
			},
		],
		actions: [
			{
				key: "setup",
				label: "Start enrolment",
				route: "/api/auth/2fa",
				payload: "{ action: 'setup' }",
			},
			{
				key: "enable",
				label: "Confirm with a code",
				route: "/api/auth/2fa",
				payload: "{ action: 'enable', code }",
			},
			{
				key: "disable",
				label: "Turn off",
				route: "/api/auth/2fa",
				payload: "{ action: 'disable', code }",
				destructive: true,
			},
		],
	},
	{
		key: "data",
		title: "Your data",
		description: "What exists, and the routes that export, pause or delete it.",
		fields: [
			{
				key: "profileComplete",
				label: "Profile completeness",
				type: "info",
				storage: "users",
				column: "profileComplete",
				readOnly: true,
			},
			{
				key: "memberSince",
				label: "Member since",
				type: "info",
				storage: "users",
				column: "createdAt",
				readOnly: true,
			},
		],
		actions: [
			{
				key: "export",
				label: "Download my data",
				route: "/api/profile/export",
				payload: "POST {} — returns the archive",
			},
			{
				key: "pause",
				label: "Pause the account",
				route: "/api/profile/pause",
				payload: "POST { action: 'pause' | 'resume' }",
			},
			{
				key: "delete",
				label: "Delete the account",
				route: "/api/profile/deletion",
				payload: "POST { confirm: true }",
				destructive: true,
			},
		],
	},
	{
		key: "data-export",
		title: "Export",
		description:
			"Your own row and the data derived from it, as one JSON document.",
		fields: [
			{
				key: "format",
				label: "Format",
				type: "info",
				storage: "route",
				readOnly: true,
				note: "JSON. The same column set `GET /api/settings?view=export` returns.",
			},
			{
				key: "excludeModeration",
				label: "Excludes moderation state",
				type: "info",
				storage: "route",
				readOnly: true,
				note: "`role`, `tier`, `trust_score`, `verification` and `is_suspended` belong to a staff process, not to a self-serve download.",
			},
			{
				key: "includePhotos",
				label: "Include photo URLs from this device",
				type: "toggle",
				storage: "device",
				readOnly: true,
				note: "Photo URLs are already in the export; this switch only affects what this device caches alongside it.",
			},
		],
		actions: [
			{
				key: "export",
				label: "Generate the export now",
				route: "/api/settings/data-export",
				payload: "POST { action: 'export' }",
			},
		],
	},
	{
		key: "backup-restore",
		title: "Backup and restore",
		description:
			"Offline drafts and queued writes, kept on the device until they can be sent.",
		fields: [
			{
				key: "queue",
				label: "Queued writes",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/offline/queue",
			},
			{
				key: "backup",
				label: "Backup archive",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/offline/backup",
			},
			{
				key: "autoBackup",
				label: "Back up on this device automatically",
				type: "toggle",
				storage: "device",
				readOnly: true,
				note: "Per device: a backup of one phone's offline drafts is not a backup of another's.",
			},
		],
		actions: [
			{
				key: "backup",
				label: "Create a backup",
				route: "/api/offline/backup",
				payload: "POST { action: 'create' }",
			},
			{
				key: "restore",
				label: "Restore from a backup",
				route: "/api/offline/backup",
				payload: "POST { action: 'restore', backupId }",
			},
		],
	},
	{
		key: "deactivate",
		title: "Pause or deactivate",
		description:
			"Reversible first. Deletion is a route with a confirmation and a grace period, not a settings toggle.",
		fields: [
			{
				key: "paused",
				label: "Account paused",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/profile/pause",
				note: "Pause hides you from discovery and keeps the data. It is the reversible half of this screen.",
			},
			{
				key: "deletionRequest",
				label: "Deletion requested",
				type: "info",
				storage: "route",
				readOnly: true,
				canonicalRoute: "/api/profile/deletion",
			},
		],
		actions: [
			{
				key: "pause",
				label: "Pause the account",
				route: "/api/profile/pause",
				payload: "POST { action: 'pause' }",
			},
			{
				key: "resume",
				label: "Resume",
				route: "/api/profile/pause",
				payload: "POST { action: 'resume' }",
			},
			{
				key: "delete",
				label: "Delete the account",
				route: "/api/profile/deletion",
				payload: "POST { confirm: true }",
				destructive: true,
			},
		],
	},
];

export const SETTINGS_SECTION_KEYS: readonly string[] = SETTINGS_SECTIONS.map(
	(section) => section.key,
);

export function findSettingsSection(key: string): SettingsSection | undefined {
	return SETTINGS_SECTIONS.find((section) => section.key === key);
}

export function isSettingsSection(key: unknown): key is string {
	return typeof key === "string" && SETTINGS_SECTION_KEYS.includes(key);
}

/** True when this endpoint may write the field, rather than naming a route that can. */
export function isWritableField(field: SettingsField): boolean {
	if (field.readOnly) return false;
	return (
		field.storage === "users" ||
		field.storage === "notifPrefs" ||
		field.storage === "aiPrefs" ||
		field.storage === "appConfig" ||
		// A password is writable *through* this endpoint, by forwarding it to the
		// provider with the caller's own token; nothing is stored here.
		(field.storage === "auth" && field.writeOnly === true)
	);
}

export function writableFields(section: SettingsSection): SettingsField[] {
	return section.fields.filter(isWritableField);
}

/** Why a field cannot be written here, in the words the screen should show. */
export function refusalReason(field: SettingsField): string {
	if (field.storage === "device")
		return `Per-device setting — stored in this browser (${DEVICE_LOCAL_FIELDS.join(", ")} live there too)`;
	if (field.readOnly)
		return field.canonicalRoute
			? `Read-only here; ${field.canonicalRoute} owns the write`
			: "Read-only: this value is derived, not chosen";
	if (field.canonicalRoute) return `${field.canonicalRoute} owns this write`;
	return "Not writable";
}

/**
 * The privacy switches, cross-referenced.
 *
 * `/settings/permissions` writes `visible`, `incognito`, `hide_online` and
 * `hide_last_online` — four of the five fields `#/lib/settings-map` maps for the
 * privacy screen. This asserts the two surfaces are describing the same columns,
 * which is what stops one screen from saving a preference the other contradicts.
 */
const PRIVACY_COLUMN_NAMES = [
	"hideDistance",
	"hideOnline",
	"hideLastOnline",
	"incognito",
	"visible",
] as const;

export const PRIVACY_COLUMNS_IN_SECTIONS: readonly string[] =
	SETTINGS_SECTIONS.flatMap((section) =>
		section.fields
			.filter((field) => field.storage === "users" && field.column)
			.map((field) => field.column as string),
	).filter((column) =>
		(PRIVACY_COLUMN_NAMES as readonly string[]).includes(column),
	);

/** Field keys the registry borrows from the privacy mapping, for the tests. */
export const PRIVACY_FIELD_KEYS: readonly string[] = PRIVACY_FIELDS;

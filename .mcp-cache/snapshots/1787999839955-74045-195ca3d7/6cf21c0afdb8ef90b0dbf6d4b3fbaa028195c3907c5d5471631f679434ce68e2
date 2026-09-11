import { z } from "zod";

const PREFIX = "fyk:app-data:";

function key(path: string): string {
	return `${PREFIX}${path}`;
}

function isBrowser(): boolean {
	return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readLocal(path: string): Uint8Array | null {
	if (!isBrowser()) return null;
	const stored = localStorage.getItem(key(path));
	if (stored === null) return null;
	return Uint8Array.from(atob(stored), (char) => char.charCodeAt(0));
}

function writeLocal({
	path,
	content,
}: {
	path: string;
	content: Uint8Array;
}): void {
	if (!isBrowser()) return;
	const binary = Array.from(content, (byte) => String.fromCharCode(byte)).join(
		"",
	);
	localStorage.setItem(key(path), btoa(binary));
}

function removeLocal(path: string): void {
	if (!isBrowser()) return;
	localStorage.removeItem(key(path));
}

// --- Preferences schema ---

const geohashSchema = z.string().regex(/^[0-9b-hjkmnp-z]+$/);
const unitSystemSchema = z.enum(["metric", "imperial"]);

const gridSearchFiltersSchema = z.object({
	isFavorite: z.boolean().default(false),
	isOnline: z.boolean().default(false),
	isRightNow: z.boolean().default(false),
	ageEnabled: z.boolean().default(false),
	age: z.array(z.number()).length(2).default([18, 102]),
	genderEnabled: z.boolean().default(false),
	genders: z.array(z.number()).default([]),
	tagsEnabled: z.boolean().default(false),
	tags: z.array(z.string()).default([]),
	positionEnabled: z.boolean().default(false),
	positions: z.array(z.string()).default([]),
	photosEnabled: z.boolean().default(false),
	photos: z
		.array(z.enum(["has-photos", "has-face-pics", "has-albums"]))
		.default([]),
	tribesEnabled: z.boolean().default(false),
	tribes: z.array(z.string()).default([]),
	bodyTypesEnabled: z.boolean().default(false),
	bodyTypes: z.array(z.string()).default([]),
	heightEnabled: z.boolean().default(false),
	height: z.array(z.number()).length(2).default([120, 242]),
	weightEnabled: z.boolean().default(false),
	weight: z.array(z.number()).length(2).default([40, 273]),
	relationshipStatusesEnabled: z.boolean().default(false),
	relationshipStatuses: z.array(z.string()).default([]),
	acceptNSFWPicsEnabled: z.boolean().default(false),
	acceptNSFWPics: z.array(z.string()).default([]),
	lookingForEnabled: z.boolean().default(false),
	lookingFor: z.array(z.string()).default([]),
	meetAtEnabled: z.boolean().default(false),
	meetAt: z.array(z.string()).default([]),
	haventChattedTodayEnabled: z.boolean().default(false),
	healthPracticesEnabled: z.boolean().default(false),
	healthPractices: z.array(z.string()).default([]),
	isFresh: z.boolean().default(false),
});

export type GridSearchFilters = z.infer<typeof gridSearchFiltersSchema>;

export const defaultFilters: GridSearchFilters = gridSearchFiltersSchema.parse(
	{},
);

const preferencesSchema = z.object({
	autoUpdateLocation: z.boolean().default(false),
	geohash: geohashSchema.nullable().default(null),
	onboardingComplete: z.boolean().default(false),
	gridSearchFilters: gridSearchFiltersSchema.optional(),
	revealMessageRead: z.boolean().default(false),
	revealProfileViews: z.boolean().default(false),
	stayOnline: z.boolean().default(true),
	units: unitSystemSchema.default("metric"),
	showDistance: z.boolean().default(true),
	showOnlineStatus: z.boolean().default(true),
	showLastOnline: z.boolean().default(true),
	incognitoMode: z.boolean().default(false),
	hideFromSearch: z.boolean().default(false),
});

export type Preferences = z.infer<typeof preferencesSchema>;

let writeQueue: Promise<unknown> = Promise.resolve();
let snapshot: Preferences = preferencesSchema.parse({});
let loaded = false;

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
	const run = writeQueue.then(task);
	writeQueue = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

let cache: Preferences | null = null;

function publish(preferences: Preferences): void {
	cache = preferences;
	snapshot = preferences;
	loaded = true;
}

// Msgpack encode/decode simplified as JSON for browser localStorage
function encodeJson(data: Preferences): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(data));
}

function decodeJson(bytes: Uint8Array): Preferences {
	const text = new TextDecoder().decode(bytes);
	return preferencesSchema.parse(JSON.parse(text));
}

function readFromDisk(): Preferences | null {
	const bytes = readLocal("preferences.data");
	if (bytes === null) return null;
	return decodeJson(bytes);
}

function writeToDisk(preferences: Preferences): void {
	writeLocal({ path: "preferences.data", content: encodeJson(preferences) });
}

export function getPreferencesSnapshot(): Preferences {
	return snapshot;
}

export function preferencesLoaded(): boolean {
	return loaded;
}

export function hydratePreferences(): void {
	if (cache !== null) return;
	const fromDisk = readFromDisk();
	if (fromDisk !== null) {
		publish(fromDisk);
	} else {
		publish(preferencesSchema.parse({}));
	}
}

export async function getPreferences(): Promise<Preferences> {
	if (cache !== null) return structuredClone(cache);
	const fromDisk = readFromDisk();
	if (fromDisk !== null) {
		publish(fromDisk);
		return structuredClone(fromDisk);
	}
	const defaults = preferencesSchema.parse({});
	publish(defaults);
	return structuredClone(defaults);
}

export async function setPreferences(
	newValues: Partial<Preferences>,
): Promise<void> {
	await enqueueWrite(async () => {
		const oldValues = await getPreferences();
		const preferences = preferencesSchema.parse({
			...oldValues,
			...newValues,
		});
		writeToDisk(preferences);
		publish(preferences);
	});
}

export async function clearAccountPreferences(): Promise<void> {
	await enqueueWrite(async () => {
		const kept: Partial<Preferences> = { ...(await getPreferences()) };
		delete kept.autoUpdateLocation;
		delete kept.geohash;
		delete kept.gridSearchFilters;
		const preferences = preferencesSchema.parse(kept);
		publish(preferences);
		writeToDisk(preferences);
	});
}

// removeLocal is exported for account data cleanup flows
export { removeLocal };

/**
 * Reading a list out of an API payload, without inventing one.
 *
 * The generated list clients all did `(json.items ?? json.data ?? []) as XItem[]`,
 * which reads as tolerance and behaves as silence: `#/routes/api/events` answers
 * `{events: […]}`, `#/routes/api/meetnow` answers `{posts: […]}`,
 * `#/routes/api/discover` answers `{candidates: […]}` and `#/routes/api/premium`
 * answers `{ladder: […]}`, so four screens rendered an empty grid with no error,
 * no empty state and nothing in the console. A missing key and an empty result set
 * are different facts and a screen should be able to tell them apart.
 *
 * `listOf` therefore takes the key the route actually answers with. It still
 * accepts `items` as a fallback because that is the convention most of the API
 * uses, and it returns `[]` — never `undefined` — so a caller cannot crash on a
 * payload it did not expect.
 */

/** The array a route answered with, under `key` (or `items`), or `[]`. */
export function listOf<T>(payload: unknown, key: string): T[] {
	if (!payload || typeof payload !== "object") return [];
	const record = payload as Record<string, unknown>;
	const candidate = record[key] ?? record.items;
	return Array.isArray(candidate) ? (candidate as T[]) : [];
}

/** A count from a payload, defaulting rather than rendering `NaN`. */
export function numberOf(payload: unknown, key: string, fallback = 0): number {
	if (!payload || typeof payload !== "object") return fallback;
	const value = (payload as Record<string, unknown>)[key];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** A nested object from a payload — `meta`, `wallet`, `pagination` — or `null`. */
export function objectAt(
	payload: unknown,
	key: string,
): Record<string, unknown> | null {
	if (!payload || typeof payload !== "object") return null;
	const value = (payload as Record<string, unknown>)[key];
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

/** A string field, or `undefined` — for optional card labels. */
export function textAt(row: unknown, key: string): string | undefined {
	if (!row || typeof row !== "object") return undefined;
	const value = (row as Record<string, unknown>)[key];
	return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * The card every generated list screen renders.
 *
 * Twenty-odd screens share one template — an id, a name, an optional description,
 * a member count, a distance, two flags and a few tags — but the routes behind them
 * answer with their own field names: `#/routes/api/events` says `title` and
 * `attendee_count`, `#/routes/api/interest/$tab` says `displayName` and
 * `distanceMeters`, `#/routes/api/calls` says `type` and `status`. Rather than
 * twenty mappers that each guess, one mapper reads the names that exist and leaves
 * the rest `undefined`, which the template already renders as "not shown".
 *
 * `raw` keeps the whole row, so a screen that needs a field this mapper does not
 * know about reads it instead of losing it.
 */
export interface CardItem {
	id: string;
	name?: string;
	title?: string;
	description?: string;
	members?: number;
	distance?: number;
	verified?: boolean;
	boosted?: boolean;
	tags?: string[];
	createdAt?: string;
	authorId?: string;
	raw: Record<string, unknown>;
}

function firstString(
	row: Record<string, unknown>,
	keys: string[],
): string | undefined {
	for (const key of keys) {
		const value = row[key];
		if (typeof value === "string" && value.trim()) return value;
	}
	return undefined;
}

function firstNumber(
	row: Record<string, unknown>,
	keys: string[],
): number | undefined {
	for (const key of keys) {
		const value = row[key];
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value)))
			return Number(value);
	}
	return undefined;
}

/** Read a route row as a card, keeping the row itself under `raw`. */
export function toCardItem(row: unknown): CardItem | null {
	if (!row || typeof row !== "object") return null;
	const record = row as Record<string, unknown>;
	const id = firstString(record, ["id", "uuid", "profileId", "userId", "step"]);
	if (!id) return null;

	const tags = Array.isArray(record.tags)
		? record.tags.filter((tag): tag is string => typeof tag === "string")
		: undefined;

	return {
		id,
		name: firstString(record, [
			"name",
			"displayName",
			"title",
			"username",
			"heading",
		]),
		title: firstString(record, ["title", "heading", "subject", "type", "kind"]),
		description: firstString(record, [
			"description",
			"body",
			"note",
			"content",
			"headline",
			"tagline",
			"summary",
			"status",
		]),
		members: firstNumber(record, [
			"members",
			"memberCount",
			"attendee_count",
			"count",
			"itemCount",
			"participants",
		]),
		distance: firstNumber(record, ["distance", "distanceMeters", "meters"]),
		verified: record.verified === true || record.isVerified === true,
		boosted:
			record.boosted === true ||
			record.promoted === true ||
			typeof record.promotedUntil === "string",
		tags: tags && tags.length > 0 ? tags : undefined,
		createdAt: firstString(record, [
			"createdAt",
			"created_at",
			"start_time",
			"startsAt",
			"at",
		]),
		authorId: firstString(record, ["authorId", "userId", "user_id", "hostId"]),
		raw: record,
	};
}

/** Map a payload's list onto cards, dropping rows without an id. */
export function toCardItems(payload: unknown, key: string): CardItem[] {
	return listOf<unknown>(payload, key)
		.map(toCardItem)
		.filter((item): item is CardItem => item !== null);
}

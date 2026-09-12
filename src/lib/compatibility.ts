/**
 * The compatibility score and the presence window, in one file both sides can
 * import.
 *
 * It lives here rather than in `#/lib/api-helpers` because that module pulls in
 * the Drizzle schema (server-only), and the grid browser service needs the same
 * numbers the API produces: a card that says "72% compatible" must mean the same
 * thing whether it came from `/api/discover` or from `#/domains/grid/service`.
 * Before this file the deck computed a score, the grid hardcoded `50`, and the
 * two presence rules were different copies.
 */

/** `last_active_at` older than this means "offline", whatever `online` says. */
export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

/** Half-life of the recency term: a week of silence costs half that score. */
export const RECENCY_HALFLIFE_DAYS = 7;

/** The five dimensions the UI advertises, and what each is worth. */
export const COMPATIBILITY_WEIGHTS = {
	tribes: 0.3,
	interests: 0.25,
	intent: 0.2,
	distance: 0.15,
	recency: 0.1,
	age: 0.05,
} as const;

/** A deck's practical reach; beyond this the distance term is zero. */
export const DISTANCE_FLOOR_KM = 25;

export type CompatibilityInput = {
	tribes: string[];
	interests: string[];
	intents: string[];
	age: number | null;
	/** Kilometres, from the coarsened coordinates only. */
	distanceKm: number | null;
	lastActiveAt: Date | null;
};

/** Jaccard overlap of two tag lists; 0 when either side is empty (never a free point). */
export function tagOverlap(a: readonly string[], b: readonly string[]): number {
	if (a.length === 0 || b.length === 0) return 0;
	const lower = (values: readonly string[]) =>
		new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
	const setA = lower(a);
	const setB = lower(b);
	if (setA.size === 0 || setB.size === 0) return 0;
	let shared = 0;
	for (const value of setA) if (setB.has(value)) shared += 1;
	return shared / new Set([...setA, ...setB]).size;
}

/** The score a viewer would see for `row`, 0–100. */
export function compatibilityScore(
	me: Pick<CompatibilityInput, "tribes" | "interests" | "intents" | "age">,
	row: CompatibilityInput,
): number {
	const w = COMPATIBILITY_WEIGHTS;
	const distance =
		row.distanceKm == null
			? 0
			: Math.max(
					0,
					1 - Math.min(row.distanceKm, DISTANCE_FLOOR_KM) / DISTANCE_FLOOR_KM,
				);
	const days = row.lastActiveAt
		? (Date.now() - row.lastActiveAt.getTime()) / 86_400_000
		: Number.POSITIVE_INFINITY;
	const recency = Number.isFinite(days)
		? 0.5 ** (Math.max(0, days) / RECENCY_HALFLIFE_DAYS)
		: 0;
	// An unknown age is neutral, not a perfect match.
	const ageGap =
		me.age != null && row.age != null
			? Math.max(0, 1 - Math.abs(me.age - row.age) / 20)
			: 0.5;

	const raw =
		w.tribes * tagOverlap(me.tribes, row.tribes) +
		w.interests * tagOverlap(me.interests, row.interests) +
		w.intent * tagOverlap(me.intents, row.intents) +
		w.distance * distance +
		w.recency * recency +
		w.age * ageGap;

	// The weights sum to 1.05 so a fully aligned profile can reach 100.
	const total =
		w.tribes + w.interests + w.intent + w.distance + w.recency + w.age;
	return Math.max(0, Math.min(100, Math.round((raw / total) * 100)));
}

/**
 * Presence, one rule for every surface: the `online` flag only counts while the
 * last activity is still inside the window. Returns the moment presence expires,
 * which is what the screens render as "online until", or `null` for offline.
 */
export function onlineUntil(
	lastActiveAt: string | number | Date | null | undefined,
	online: boolean | null | undefined,
): number | null {
	if (online !== true) return null;
	// Supabase hands back ISO text, the server hands back Date objects.
	const at =
		lastActiveAt instanceof Date
			? lastActiveAt
			: lastActiveAt == null
				? null
				: new Date(lastActiveAt);
	if (!at || Number.isNaN(at.getTime())) return null;
	const expires = at.getTime() + PRESENCE_WINDOW_MS;
	return expires > Date.now() ? expires : null;
}

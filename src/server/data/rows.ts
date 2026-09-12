/**
 * The one place a Supabase response becomes an array of typed rows.
 *
 * `select()` without a generated row type hands back `unknown`, and every handler
 * used to cast that away individually — 46 `as unknown as` sites, each one a place
 * where a renamed column or an unexpected driver response (a PostgREST error body,
 * a `null` where an array should be) would blow up inside a `.map()` and surface as
 * a 500. This keeps the cast in one file, and makes it *safe*: anything that is not
 * an array is treated as no rows, which is what every caller already assumed.
 */
export function rows<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : [];
}

/** Same rule for the single-row reads, where `maybeSingle()` may answer `null`. */
export function row<T>(value: unknown): T | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as T)
		: null;
}

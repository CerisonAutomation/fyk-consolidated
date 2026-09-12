/**
 * The one place a Supabase response becomes typed rows. Named `asRows` rather than
 * `rows` because every handler already keeps a local `rows` variable for its own
 * result set.
 *
 * `select()` without a generated row type hands back `unknown`. Every list read used
 * to cast that away where it happened — 31 sites, each one a place where a renamed
 * column or an unexpected driver response (a PostgREST error body, a `null` where an
 * array should be) would blow up inside a `.map()` and surface to a user as a 500.
 * This keeps the cast in one file and makes it *safe*: anything that is not an array
 * is treated as no rows, which is what every caller already assumed.
 *
 * Single-row reads are deliberately not converted. A `.single()` cast asserting
 * non-null is the handler's contract with Postgres, and quietly widening it to
 * `T | null` would let a missing row through as "no data" where the endpoint owes a
 * 404 instead.
 */
export function asRows<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : [];
}

/** Same rule for the single-row reads, where `maybeSingle()` may answer `null`. */
export function asRow<T>(value: unknown): T | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as T)
		: null;
}

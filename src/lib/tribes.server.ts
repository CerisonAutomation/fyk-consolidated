import { type DbLike, db } from "#/db";
import { tribes } from "#/schema";

/**
 * `users.tribes` is a jsonb array with a GIN index and no foreign key (0010), and two
 * vocabularies had grown up in it (AUDIT §3.9): `/tribes` wrote tribe **names**, while
 * an older profile editor wrote numeric ids. Nothing could resolve those numbers —
 * there is no `tags` table anywhere in the migration set — so a user holding `3` and a
 * user holding `"Hiking"` share a tribe and score zero overlap in
 * `#/lib/compatibility.ts`, which compares strings, and never appear in each other's
 * `@>` filter.
 *
 * This is the write-side half of the fix that `0022_tribes_vocabulary.sql` starts:
 * every token is resolved onto the catalogue's canonical `tribes.name` (case- and
 * whitespace-insensitively) before it is stored, so `hiking`, ` HIKING ` and `Hiking`
 * land as one value that `tribes_recount` and `tagOverlap` can both see.
 *
 * A token that does not resolve is **kept as typed** rather than dropped: it may be a
 * tribe an admin deleted last week, and silently emptying part of someone's profile
 * during a save is a worse outcome than an inert entry. It is inert either way — the
 * count trigger and the filters ignore anything that is not a catalogue name — so the
 * column converges on one vocabulary without this function ever guessing.
 */
export async function normaliseTribeTokens(
	d: DbLike = db,
	tokens: readonly (string | number)[] | null | undefined,
): Promise<string[]> {
	if (!Array.isArray(tokens) || tokens.length === 0) return [];

	const wanted = tokens
		.map((t) => String(t).trim())
		.filter((t) => t.length > 0)
		.slice(0, 24);
	if (wanted.length === 0) return [];

	// One small query, not one per token: `0019` §9 seeds 19 tribes and the table is
	// a catalogue, not a user-controlled list, so reading it whole is cheaper than
	// matching case-insensitively per entry (and `lower(name)` could not use the
	// unique index anyway).
	const rows = await d.select({ name: tribes.name }).from(tribes).limit(500);

	const byKey = new Map<string, string>();
	for (const row of rows) {
		byKey.set(row.name.toLowerCase(), row.name);
	}

	const out: string[] = [];
	for (const token of wanted) {
		const value = byKey.get(token.toLowerCase()) ?? token;
		if (!out.includes(value)) out.push(value);
	}
	return out;
}

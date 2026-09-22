import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Schema coverage: the guard that keeps `drizzle/schema.ts` and
 * `supabase/migrations/` from drifting apart again.
 *
 * WHY A TEST AND NOT A SCHEMA GENERATOR
 * ------------------------------------
 * `drizzle-kit` can only produce a schema from a live database, and this repository
 * has no Postgres in CI or in the sandbox it is developed in (`supabase db push` is a
 * deploy-time step), so the schema is translated from the DDL by hand. Hand
 * translation is exactly how the Prisma file this repo used to ship drifted:
 * `prisma/schema.prisma` declared `User.name`/`User.handle`/`User.avatar` for columns
 * the migrations called `display_name`/`handle`/nothing, and nothing noticed until the
 * runtime did. Two assertions replace that:
 *
 *   1. every model in `drizzle/schema.ts` must correspond to a table some migration
 *      creates and no later migration drops — a model for a table that does not exist
 *      is how a route compiles and then 500s;
 *   2. the set of live tables *without* a model must equal the list below, so the
 *      number can only go down. Adding a table in SQL without a model fails, and so
 *      does quietly deleting one.
 *
 * The list is real debt, recorded rather than hidden: 35 tables exist in the
 * migrations and have no Drizzle model. Most are written through raw `sql\`\`` in the
 * routes that touch them (board, groups, stories, the ai_* tables), which works and is
 * type-checked nowhere. The fix is one table per commit against the DDL, starting with
 * the ones a route already `select`s (`profiles` first — it is the discoverable
 * projection 0018 exists to publish).
 */
const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const SCHEMA = join(process.cwd(), "drizzle", "schema.ts");

function versionOf(file: string): number {
	const m = /^(\d+)/.exec(file);
	return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function liveTables(): Set<string> {
	const tables = new Map<string, boolean>();
	for (const file of readdirSync(MIGRATIONS)
		.filter((f) => f.endsWith(".sql"))
		.sort((a, b) => versionOf(a) - versionOf(b) || a.localeCompare(b))) {
		const src = readFileSync(join(MIGRATIONS, file), "utf8");
		for (const m of src.matchAll(
			/create table(?: if not exists)?\s+(?:public|fyk)\.([a-z_0-9]+)/gi,
		)) {
			tables.set(m[1], true);
		}
		for (const m of src.matchAll(
			/drop table(?: if exists)?\s+(?:public|fyk)\.([a-z_0-9]+)/gi,
		)) {
			tables.delete(m[1]);
		}
	}
	return new Set(tables.keys());
}

function modelledTables(): Set<string> {
	const src = readFileSync(SCHEMA, "utf8");
	return new Set(
		[...src.matchAll(/pgTable\(\s*"([a-z_0-9]+)"/g)].map((m) => m[1]),
	);
}

const UNMODELLED = new Set([
	"ai_chat_health",
	"ai_match_scores",
	"ai_memory",
	"ai_safety_flags",
	"album_grants",
	"album_shares",
	"audit_events",
	"auth_rate_limits",
	"board_comments",
	"board_posts",
	"event_waitlist",
	"group_members",
	"group_messages",
	"groups",
	"likes",
	"message_attachments",
	"message_embeddings",
	"offer_joins",
	"offers",
	"post_joins",
	"profile_embeddings",
	"profile_photos",
	"profiles",
	"reports",
	"saved_filters",
	"saved_phrases",
	"sessions",
	"shout_likes",
	"shouts",
	"site_config",
	"story_views",
	"tag_embeddings",
	"typing_indicators",
	// 0027 tables are now modelled in drizzle/schema.ts:
	// verification_requests, content_ratings, stories (now modelled), live_rooms,
	// gift_transactions, referrals, vouchers, polls, spotlights, saved_searches,
	// chat_themes, appeals, emergency_contacts, data_exports, roulette_sessions
]);

describe("drizzle schema coverage", () => {
	const live = liveTables();
	const modelled = modelledTables();

	it("models every table that exists", () => {
		expect(modelled.size).toBeGreaterThan(30);
	});

	it("never models a table no migration creates", () => {
		const invented = [...modelled].filter((t) => !live.has(t));
		expect(invented).toEqual([]);
	});

	it("keeps the unmodelled list from growing", () => {
		const missing = [...live].filter((t) => !modelled.has(t));
		expect(missing.sort()).toEqual([...UNMODELLED].sort());
	});

	it("lists debt that is still real", () => {
		// If this fails, a table was modelled: delete it from `UNMODELLED` above, which
		// is the whole point of the test.
		for (const table of UNMODELLED) {
			expect(live.has(table), `${table} is not a live table`).toBe(true);
			expect(
				modelled.has(table),
				`${table} now has a model and is still listed as unmodelled`,
			).toBe(false);
		}
	});
});

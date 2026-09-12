import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

/**
 * `.env.local` is read here, the way `scripts/seed.mjs` reads it.
 *
 * This is not decoration. Until the Prisma removal this file ran under
 * `dotenv -e .env.local --`, which is what put `DATABASE_URL` in front of
 * drizzle-kit; `dotenv-cli` left with the Prisma-era dependencies and the
 * wrapper left with it, so `pnpm db:push` was reading `process.env.DATABASE_URL`
 * from a shell that had never set it and pushing to an empty connection string.
 * Vite loads `.env.local` for `dev`/`build`, which is why nothing else noticed:
 * the app worked, the db:* scripts did not.
 *
 * A real environment variable always wins over the file, so CI secrets and
 * `export DATABASE_URL=…` keep working.
 */
function loadLocalEnv(): void {
	try {
		const text = readFileSync(new URL("./.env.local", import.meta.url), "utf8");
		for (const line of text.split("\n")) {
			const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
			if (!match) continue;
			const [, key, raw] = match;
			if (process.env[key] !== undefined) continue;
			process.env[key] = raw.replace(/^["']|["']$/g, "");
		}
	} catch {
		/* no .env.local — the shell may already have what we need */
	}
}
loadLocalEnv();

/**
 * Drizzle Kit configuration — the schema in `drizzle/schema.ts` is the source
 * of truth for the tables the JSON API touches.
 *
 *   pnpm db:generate   → SQL diff into ./supabase/migrations (then review!)
 *   pnpm db:push       → apply to the database in DATABASE_URL
 *   pnpm db:studio     → browse it
 *
 * `out` points at the *same* folder `supabase db push` applies, so a generated
 * migration lands in the deployable history instead of a parallel one. Files
 * are timestamp-prefixed by `supabase migration new`; `db:generate` output is
 * copied into a new file by hand, which keeps one canonical migration list.
 */
export default defineConfig({
	schema: "./drizzle/schema.ts",
	out: "./drizzle/migrations",
	dialect: "postgresql",
	// `db:generate` diffs the schema with no connection at all; `db:push` and
	// `db:studio` report a missing/blank URL themselves, which is a better message
	// than a config file throwing before they get to try.
	dbCredentials: {
		url: process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "",
	},
	// Never emit `drop` for columns this schema simply does not model yet:
	// `public.users` has ~60 columns and the API only reads a subset.
	strict: true,
	verbose: true,
});

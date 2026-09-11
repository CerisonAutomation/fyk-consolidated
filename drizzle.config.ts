import { defineConfig } from "drizzle-kit";

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
	dbCredentials: { url: process.env.DATABASE_URL ?? "" },
	// Never emit `drop` for columns this schema simply does not model yet:
	// `public.users` has ~60 columns and the API only reads a subset.
	strict: true,
	verbose: true,
});

import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import createPool, { type Sql } from "postgres";
import * as schema from "../drizzle/schema";

/**
 * The server's single database entry point.
 *
 * WHY IT CHANGED
 * --------------
 * 1. **Driver.** This used to be `new PrismaClient({ adapter: new PrismaPg(...) })`
 *    built at *module scope*. Two problems, both live-observable:
 *    - `PrismaPg`/`getDatabaseUrl()` threw while the SSR entry was still
 *      importing this file, so a container booted without `DATABASE_URL`
 *      answered `500` for *every* route — including `/` and `/about`, which
 *      never touch the database — and the failure surfaced as an opaque
 *      `HTTPError` from the streaming renderer. Now the pool is created on
 *      first query and the readable error is thrown per request.
 *    - Prisma's generated client disagreed with the actual SQL (missing
 *      `@map`s, `position` typed `String` for a `jsonb` column, an `avatar`
 *      column that does not exist). See `drizzle/schema.ts` for the list.
 * 2. **Transaction pooler.** Supabase's PgBouncer pooler (port 6543) does not
 *    support prepared statements, hence `prepare: false`. Leaving that off is
 *    the classic "works on the direct connection, 500s in production" bug.
 * 3. **Pool sizing.** One pool per process, `max` bounded: the serverless
 *    Postgres default `max_connections` is small and each extra instance of
 *    this app used to multiply it.
 *
 * Browser code must NOT import this file — it holds the service-level
 * connection string. Client reads go through Supabase + RLS
 * (`#/integrations/supabase/client`), writes that need authorisation go
 * through the API routes in `src/routes/api/**`.
 */

declare global {
	// Cached across HMR reloads (dev) and shared by every request (prod).
	var __fykDb: PostgresJsDatabase<typeof schema> | undefined;
	var __fykPool: Sql | undefined;
	var __fykDbConfigError: Error | undefined;
}

function databaseUrl(): string {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error(
			"DATABASE_URL is required — set it in .env.local (see .env.example). " +
				"Expected the Supabase Postgres pooler connection string.",
		);
	}
	return url;
}

function poolSize(): number {
	const raw = Number(process.env.DATABASE_POOL_MAX ?? 5);
	return Number.isFinite(raw) && raw > 0 && raw <= 50 ? Math.floor(raw) : 5;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
	if (globalThis.__fykDb) return globalThis.__fykDb;
	if (globalThis.__fykDbConfigError) throw globalThis.__fykDbConfigError;

	try {
		const client = createPool(databaseUrl(), {
			// PgBouncer transaction mode cannot serve prepared statements.
			prepare: false,
			max: poolSize(),
			idle_timeout: 20,
			connect_timeout: 10,
			// Never log query parameters: bios, messages and coordinates must not
			// reach stdout, where a log drain would happily index them.
			onnotice: () => {},
		});
		globalThis.__fykPool = client;
		globalThis.__fykDb = drizzle(client, { schema });
	} catch (error) {
		// Remember the failure: a misconfigured URL does not fix itself between
		// requests, and re-throwing the same error beats re-running the config.
		const wrapped = error instanceof Error ? error : new Error(String(error));
		globalThis.__fykDbConfigError = wrapped;
		throw wrapped;
	}
	return globalThis.__fykDb;
}

/**
 * Proxy so call sites keep the previous `import { db } from "@/db"` shape
 * without paying for pool creation at import time.
 */
export const db: PostgresJsDatabase<typeof schema> = new Proxy(
	{} as PostgresJsDatabase<typeof schema>,
	{
		get(_target, property) {
			const instance = getDb() as unknown as Record<string | symbol, unknown>;
			const value = Reflect.get(instance, property, instance);
			return typeof value === "function"
				? (value as (...args: unknown[]) => unknown).bind(instance)
				: value;
		},
	},
);

export { schema };

/**
 * `db` and the transaction handle a `db.transaction(tx => …)` callback receives.
 *
 * Helpers that can run either standalone or inside a caller's transaction take
 * this type: the query-builder methods are structurally identical on both, while
 * `transaction` itself is deliberately absent, because a helper that opens a
 * nested transaction is how a partial commit slips past a rollback.
 */
export type DbLike = Pick<
	PostgresJsDatabase<typeof schema>,
	"select" | "insert" | "update" | "delete" | "execute"
>;

/** Readiness probe: used by `GET /api/health?deep=1`. */
export async function pingDatabase(): Promise<void> {
	await getDb().execute(sql`select 1`);
}

/** Close the pool (graceful shutdown in the container entrypoint). */
export async function closeDatabase(): Promise<void> {
	const pool = globalThis.__fykPool;
	globalThis.__fykDb = undefined;
	globalThis.__fykPool = undefined;
	if (pool) await pool.end({ timeout: 5 });
}

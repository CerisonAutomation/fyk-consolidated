/**
 * "Does this authenticated id have a profile row yet?" — the one question three places
 * need and none of them should re-derive.
 *
 * WHY A SEPARATE FILE
 * -------------------
 * The answer decides navigation, and a wrong answer strands an account:
 *
 *   - `/api/auth/me` answers `{ user: null }` vs `{ user, profile: null }` so the shell can
 *     choose between the sign-in screen and onboarding;
 *   - `#/lib/document-auth.server` redirects a *document* to `/onboarding` for a signed-in
 *     id with no `public.users` row, which is the case that used to render an empty
 *     settings screen and a `PUT` that created the row from a form nobody was shown;
 *   - the entry gate in `EntryShell` asks the same question through supabase-js against the
 *     `profiles` projection.
 *
 * The predicate is deliberately a *three*-valued answer. `unknown` is what a database that
 * cannot be reached reports, and a render must not conclude "this account is new" from an
 * infrastructure failure — the difference between a redirect to onboarding and a blank
 * screen for every user during a DB blip is exactly that distinction.
 */

import { eq } from "drizzle-orm";
import { type DbLike, db } from "@/db";
import { users } from "@/schema";

export type Provisioning = "present" | "missing" | "unknown";

/**
 * `SELECT` on the primary key of `public.users`, which `0015`/`0018` make the canonical
 * profile row for an auth id (`users.id → auth.users(id) on delete cascade`).
 *
 * Takes an optional handle so a caller inside a transaction can ask with the same
 * visibility as its writes; without one it uses the shared pool.
 */
export async function profileRowExists(
	userId: string,
	handle?: DbLike,
): Promise<Provisioning> {
	if (!userId) return "unknown";
	try {
		const d = (handle ?? db) as DbLike;
		const rows = await d
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		return rows.length > 0 ? "present" : "missing";
	} catch {
		// No `DATABASE_URL`, a pooler that refused the connection, a statement timeout.
		// Not a signal about the account, so it must not change navigation.
		return "unknown";
	}
}

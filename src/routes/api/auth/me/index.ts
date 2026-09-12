import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { asStringArray, cleanText, methodNotAllowed } from "#/lib/api-helpers";
import type { ProfileUser } from "#/lib/types";
import { json, withSecurity } from "#/middleware";
import { users } from "#/schema";

/**
 * `GET /api/auth/me` — "who am I, and is my profile provisioned?"
 *
 * Who calls it, honestly: nothing in the browser does today. `EntryShell` reads the
 * same facts by querying `profiles` through supabase-js directly, so this endpoint
 * is the *contract* — the server-side mapping to `ProfileUser`, and the
 * `{ user: null }`-rather-than-401 distinction — rather than a live dependency, and
 * AUDIT §3.18 records the choice that has to be made (move the shell onto it, or
 * delete it). Its former caller, `src/components/auth-gate.tsx`, was imported by
 * nothing and is deleted; the server-side equivalent for documents is now
 * `#/lib/document-auth.server`, which answers the same question without a round
 * trip and without trusting the browser's word about its own session.
 *
 * Answers `200 { user: null }` for anonymous traffic rather than `401`: the
 * caller has to distinguish "not signed in" (redirect to sign-in) from "signed
 * in, profile row missing" (redirect to onboarding), and an error response
 * cannot carry that difference.
 *
 * The profile is mapped here, server-side, into `ProfileUser` — the shape the
 * shell, sidebar and topbar already type against — so no client component
 * re-derives display state and no component invents defaults such as
 * `status: "online"` (which made every user look live).
 *
 * Deliberately absent: `passwordHash`, `appleId`, `googleId`, and precise
 * coordinates. `passwordHash` still exists as a column although Supabase Auth
 * owns credentials (see AUDIT.md) — echoing it would leak a bcrypt digest into
 * the client bundle of every signed-in device.
 */
const ME_SELECT = {
	id: users.id,
	displayName: users.displayName,
	handle: users.handle,
	avatar: users.avatar,
	photos: users.photos,
	bio: users.bio,
	age: users.age,
	city: users.city,
	area: users.area,
	status: users.status,
	role: users.role,
	tier: users.tier,
	verification: users.verification,
	trustScore: users.trustScore,
	profileComplete: users.profileComplete,
	online: users.online,
	visible: users.visible,
	hidden: users.hidden,
	incognito: users.incognito,
	isDemo: users.isDemo,
	isSuspended: users.isSuspended,
	exposureLevel: users.exposureLevel,
	hideDistance: users.hideDistance,
	hideOnline: users.hideOnline,
	position: users.position,
	languages: users.languages,
	lookingFor: users.lookingFor,
	intents: users.intents,
	tagCodes: users.tagCodes,
	interests: users.interests,
	tribes: users.tribes,
	lastSeen: users.lastSeen,
	lastActiveAt: users.lastActiveAt,
	onboardingDone: users.onboardingDone,
	createdAt: users.createdAt,
	updatedAt: users.updatedAt,
};

export const Route = createFileRoute("/api/auth/me/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			POST: methodNotAllowed("GET"),
			PUT: methodNotAllowed("GET"),
			PATCH: methodNotAllowed("GET"),
			DELETE: methodNotAllowed("GET"),

			GET: withSecurity(
				async ({ caller }) => {
					if (!caller)
						return json({ user: null, profile: null }, { cache: "private" });

					const [row] = await db
						.select(ME_SELECT)
						.from(users)
						.where(eq(users.id, caller.id))
						.limit(1);

					// A suspended account still holds a valid JWT until it expires;
					// treat it as anonymous so the shell signs the device out
					// instead of rendering a frozen profile.
					if (row?.isSuspended) {
						return json(
							{ user: null, profile: null, suspended: true },
							{ cache: "private" },
						);
					}
					if (!row) {
						return json(
							{ user: { id: caller.id, email: caller.email }, profile: null },
							{ cache: "private" },
						);
					}

					const photoList = asStringArray(row.photos);
					const profile: ProfileUser = {
						id: row.id,
						email: caller.email ?? "",
						pseudo: cleanText(row.displayName, 64) || row.handle || "King",
						nick: cleanText(row.handle, 32) || undefined,
						displayName: cleanText(row.displayName, 64) || undefined,
						description: cleanText(row.bio, 1000) || undefined,
						age: row.age ?? undefined,
						city: row.city ?? undefined,
						area: row.area ?? undefined,
						// No coordinates in this payload on purpose: the shell never
						// needs them, and `geo` used to be invented from the city name.
						photos:
							photoList.length > 0 ? photoList : row.avatar ? [row.avatar] : [],
						avatar: row.avatar ?? undefined,
						position: asStringArray(row.position),
						languages: asStringArray(row.languages),
						lookingFor: asStringArray(row.lookingFor),
						intents: asStringArray(row.intents),
						tagCodes: asStringArray(row.tagCodes),
						interests: asStringArray(row.interests),
						tribes: asStringArray(row.tribes),
						status: row.online ? "online" : (row.status ?? "offline"),
						role: row.role ?? "user",
						tier: row.tier ?? "free",
						verification: row.verification ?? 0,
						trustScore: row.trustScore ?? 50,
						profileComplete: row.profileComplete ?? 0,
						online: row.online ?? false,
						visible: row.visible ?? true,
						hidden: row.hidden ?? false,
						incognito: row.incognito ?? false,
						isDemo: row.isDemo ?? false,
						exposureLevel: row.exposureLevel ?? "clean",
						hideDistance: row.hideDistance ?? false,
						hideOnline: row.hideOnline ?? false,
						lastSeen: (
							row.lastSeen ??
							row.lastActiveAt ??
							row.updatedAt
						).toISOString(),
						lastActiveAt: (
							row.lastActiveAt ??
							row.lastSeen ??
							row.updatedAt
						).toISOString(),
						onboardingDone: row.onboardingDone ?? false,
						createdAt: row.createdAt.toISOString(),
						updatedAt: row.updatedAt.toISOString(),
					};

					return json(
						{ user: { id: caller.id, email: caller.email }, profile },
						{ cache: "private" },
					);
				},
				{
					auth: "optional",
					rateLimit: {
						limit: 240,
						key: ({ caller, ip }) => `me:${caller?.id ?? ip}`,
					},
				},
			),
		},
	},
});

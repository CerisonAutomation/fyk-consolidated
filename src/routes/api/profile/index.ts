import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	z,
} from "#/lib/api-helpers";
import { normaliseTribeTokens } from "#/lib/tribes.server";
import { json, jsonError, withSecurity } from "#/middleware";
import { profilePrivate, users } from "#/schema";

/**
 * `GET|PUT /api/profile` — the caller's own profile row, and the only way an
 * account becomes real.
 *
 * `src/routes/onboarding` PUTs here as its final step. The route did not exist,
 * so a fresh signup could authenticate, would be redirected to `/onboarding` by
 * `auth-gate`, would fill every field, and then fail to persist a single one —
 * its `users` row never got created and the gate looped. `PUT` therefore upserts
 * (create-or-update keyed on the auth id) instead of updating.
 *
 * Field names follow the client and the column it writes (`pseudo` → `pseudo`
 * column, `description` → `description`, …) — see the comment on each alias in
 * `AUDIT.md` §2.3 for the Prisma-era naming drift this replaces.
 *
 * Deliberately **not** writable through this endpoint: `role`, `tier`,
 * `verification`, `trust_score`, `is_suspended`, `is_demo`, `email`, `phone`,
 * `password_hash`. Those are moderation/commerce/identity columns; `0015` adds a
 * DB trigger so even a compromised client cannot promote itself, and this route
 * never reads them from the body. Location is also not accepted here: precise
 * `lat`/`lng` are written by the map picker flow, which coarsens them.
 */
/** Whole years lived on `day`; `null` when the string is not a real date. */
function ageFromDob(day: string): number | null {
	const [year, month, date] = day.split("-").map(Number);
	if (!year || !month || !date) return null;
	const birth = new Date(Date.UTC(year, month - 1, date));
	if (
		birth.getUTCFullYear() !== year ||
		birth.getUTCMonth() !== month - 1 ||
		birth.getUTCDate() !== date
	)
		return null;
	const now = new Date();
	let years = now.getUTCFullYear() - year;
	const before =
		now.getUTCMonth() < month - 1 ||
		(now.getUTCMonth() === month - 1 && now.getUTCDate() < date);
	if (before) years -= 1;
	return years;
}

const REQUIRED_FOR_COMPLETE = [
	"pseudo",
	"description",
	"age",
	"photos",
	"interests",
	"city",
] as const;

const profileSchema = z.object({
	pseudo: z
		.string()
		.trim()
		.min(2, "Use at least 2 characters")
		.max(64)
		.optional(),
	nick: z.string().trim().min(3).max(32).optional(),
	description: z.string().max(2000).optional(),
	age: z.coerce.number().int().min(18, "18 or older").max(120).optional(),
	height: z.coerce.number().int().min(100).max(260).optional(),
	weight: z.coerce.number().int().min(25).max(400).optional(),
	body_type: z.string().max(32).optional(),
	ethnicity: z.string().max(40).optional(),
	occupation: z.string().max(120).optional(),
	interests: z.array(z.string().max(60)).max(40).optional(),
	/**
	 * `users.tribes`/`looking_for`/`position` are jsonb with a GIN index and no
	 * foreign key (`0010`), and two vocabularies already exist in them: tribe
	 * names (written by `/tribes`, which joins by name) and numeric tag ids
	 * (written by the profile editor). The column accepts both, so so does the
	 * API — rejecting one would have made a screen unable to save at all. Every
	 * comparison on the server and in the grid textifies, so `3` and `"3"`
	 * still match each other.
	 */
	tribes: z
		.array(z.union([z.number().int(), z.string().max(40)]))
		.max(24)
		.optional(),
	looking_for: z
		.array(z.union([z.number().int(), z.string().max(40)]))
		.max(24)
		.optional(),
	position: z
		.array(z.union([z.number().int(), z.string().max(40)]))
		.max(8)
		.optional(),
	languages: z.array(z.string().max(40)).max(12).optional(),
	photos: z.array(z.string().max(2048)).max(12).optional(),
	city: z.string().max(120).optional(),
	area: z.string().max(120).optional(),
	status: z.enum(["single", "dating", "friends", "it_complicated"]).optional(),
	relationship_status: z.string().max(40).optional(),
	pronouns: z.string().max(40).optional(),
	onboarding_done: z.boolean().optional(),
	visible: z.boolean().optional(),
	incognito: z.boolean().optional(),
	exposure_level: z.enum(["clean", "mature", "explicit"]).optional(),
	/**
	 * Accepted here because onboarding is one user gesture: the birth date goes
	 * to `profile_private`, the derived age and the attestation to this row. A
	 * client cannot claim to be 30 with a 2008 birthday — the age is recomputed
	 * from the dob below and any `age` in the body is overridden by it.
	 */
	dob: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
		.optional(),
	hide_distance: z.boolean().optional(),
	hide_online: z.boolean().optional(),
});

const PROFILE_SELECT = {
	id: users.id,
	displayName: users.displayName,
	handle: users.handle,
	bio: users.bio,
	occupation: users.occupation,
	relationshipStatus: users.relationshipStatus,
	pronouns: users.pronouns,
	age: users.age,
	height: users.height,
	weight: users.weight,
	bodyType: users.bodyType,
	ethnicity: users.ethnicity,
	position: users.position,
	languages: users.languages,
	lookingFor: users.lookingFor,
	interests: users.interests,
	tribes: users.tribes,
	photos: users.photos,
	avatar: users.avatar,
	city: users.city,
	area: users.area,
	status: users.status,
	visible: users.visible,
	hideDistance: users.hideDistance,
	hideOnline: users.hideOnline,
	profileComplete: users.profileComplete,
	onboardingDone: users.onboardingDone,
	updatedAt: users.updatedAt,
};

export const Route = createFileRoute("/api/profile/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			POST: methodNotAllowed("GET, PUT"),
			PATCH: methodNotAllowed("GET, PUT"),
			DELETE: methodNotAllowed("GET, PUT"),

			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					const [row] = await db
						.select(PROFILE_SELECT)
						.from(users)
						.where(eq(users.id, user.id))
						.limit(1);
					if (!row) return json({ profile: null }, { cache: "private" });
					return json({ profile: shape(row) }, { cache: "private" });
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `profile:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, profileSchema, 48 * 1024);

					const set: Partial<typeof users.$inferInsert> = {
						updatedAt: new Date(),
					};
					if (body.pseudo !== undefined)
						set.displayName = cleanText(body.pseudo, 64);
					if (body.nick !== undefined)
						set.handle = cleanText(body.nick, 32).toLowerCase();
					if (body.description !== undefined)
						set.bio = cleanText(body.description, 2000);
					if (body.age !== undefined) set.age = body.age;
					if (body.incognito !== undefined) set.incognito = body.incognito;
					if (body.exposure_level !== undefined)
						set.exposureLevel = body.exposure_level;

					if (body.dob !== undefined) {
						const years = ageFromDob(body.dob);
						if (years === null) {
							return jsonError("That date of birth is not a real day", 400);
						}
						if (years < 18) {
							return jsonError("FYKING is for adults aged 18 and over", 400);
						}
						const stored = await db
							.insert(profilePrivate)
							.values({ id: user.id, dob: body.dob })
							.onConflictDoUpdate({
								target: profilePrivate.id,
								set: { dob: body.dob, updatedAt: new Date() },
							})
							.returning({ id: profilePrivate.id });
						if (stored.length === 0) {
							return jsonError("Could not store your date of birth", 500);
						}
						set.age = years;
						set.ageVerifiedAt = new Date();
					}
					if (body.height !== undefined) set.height = body.height;
					if (body.weight !== undefined) set.weight = body.weight;
					if (body.body_type !== undefined)
						set.bodyType = cleanText(body.body_type, 32);
					if (body.ethnicity !== undefined)
						set.ethnicity = cleanText(body.ethnicity, 40);
					if (body.occupation !== undefined)
						set.occupation = cleanText(body.occupation, 120);
					if (body.interests !== undefined)
						set.interests = dedupe(body.interests);
					if (body.tribes !== undefined)
						// Resolved against `public.tribes` so the column holds one vocabulary and the
						// GIN filter plus `tagOverlap` can actually match it (0022 documents the split).
						set.tribes = await normaliseTribeTokens(db, body.tribes);
					if (body.looking_for !== undefined) set.lookingFor = body.looking_for;
					if (body.position !== undefined) set.position = body.position;
					if (body.languages !== undefined)
						set.languages = dedupe(body.languages);
					if (body.photos !== undefined) set.photos = dedupe(body.photos);
					if (body.city !== undefined) set.city = cleanText(body.city, 120);
					if (body.area !== undefined) set.area = cleanText(body.area, 120);
					if (body.status !== undefined) set.status = body.status;
					if (body.relationship_status !== undefined)
						set.relationshipStatus = cleanText(body.relationship_status, 40);
					if (body.pronouns !== undefined)
						set.pronouns = cleanText(body.pronouns, 40);
					if (body.visible !== undefined) set.visible = body.visible;
					if (body.hide_distance !== undefined)
						set.hideDistance = body.hide_distance;
					if (body.hide_online !== undefined) set.hideOnline = body.hide_online;

					// Completeness is derived here rather than trusted from the client:
					// it is the number `auth-gate`, the progress ring and the premium
					// upsell all read, so a client-supplied 100 would be a lie that
					// unlocks UI.
					const after = await db
						.select(PROFILE_SELECT)
						.from(users)
						.where(eq(users.id, user.id))
						.limit(1);
					const merged = { ...(after[0] ?? {}), ...set } as Record<
						string,
						unknown
					>;
					set.profileComplete = completeness(merged);
					if (body.onboarding_done === true) {
						// The gate in `EntryShell`/`auth-gate` only asks for four things
						// before it lets an account into the app; the 60% completeness
						// score is a *profile quality* nudge, not an entry requirement, and
						// conflating the two left a signed-up user with no photos stuck in
						// the onboarding loop. The score still has to be one of the two.
						const gateFieldsPresent = [
							merged.displayName,
							merged.handle,
							merged.age,
							merged.city,
						].every((value) => value != null && String(value).trim() !== "");
						if (!gateFieldsPresent && (set.profileComplete ?? 0) < 60) {
							return jsonError(
								"Add a display name, a handle, your age and your city to finish",
								400,
							);
						}
						set.onboardingDone = true;
						set.onboardingCompletedAt = new Date();
					}

					const [row] = await db
						.insert(users)
						.values({ id: user.id, email: user.email ?? null, ...set })
						.onConflictDoUpdate({ target: users.id, set })
						.returning(PROFILE_SELECT);

					if (!row) return jsonError("Could not save your profile", 500);
					return json({ ok: true, profile: shape(row) });
				},
				{
					maxBodySize: 48 * 1024,
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `profile:PUT:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});

function dedupe(values: string[]): string[] {
	return [
		...new Set(values.map((value) => cleanText(value, 60)).filter(Boolean)),
	];
}

function completeness(row: Record<string, unknown>): number {
	const filled = [
		typeof row.displayName === "string" &&
			(row.displayName as string).length >= 2,
		typeof row.bio === "string" && (row.bio as string).length >= 20,
		typeof row.age === "number",
		Array.isArray(row.photos) && (row.photos as unknown[]).length > 0,
		Array.isArray(row.interests) && (row.interests as unknown[]).length > 0,
		typeof row.city === "string" && (row.city as string).length > 0,
	];
	return Math.round(
		(filled.filter(Boolean).length / REQUIRED_FOR_COMPLETE.length) * 100,
	);
}

function shape(row: Record<string, unknown>) {
	return {
		id: row.id,
		pseudo: row.displayName ?? "",
		nick: row.handle ?? "",
		description: row.bio ?? "",
		occupation: row.occupation ?? "",
		relationship_status: row.relationshipStatus ?? null,
		pronouns: row.pronouns ?? null,
		age: row.age ?? null,
		height: row.height ?? null,
		weight: row.weight ?? null,
		body_type: row.bodyType ?? null,
		ethnicity: row.ethnicity ?? null,
		position: toArray(row.position),
		languages: toArray(row.languages),
		looking_for: toArray(row.lookingFor),
		interests: toArray(row.interests),
		tribes: toArray(row.tribes),
		photos: toArray(row.photos),
		avatar: row.avatar ?? null,
		city: row.city ?? null,
		area: row.area ?? null,
		status: row.status ?? null,
		visible: row.visible ?? true,
		hide_distance: row.hideDistance ?? false,
		hide_online: row.hideOnline ?? false,
		profile_complete: Number(row.profileComplete ?? 0),
		onboarding_done: row.onboardingDone ?? false,
		updated_at: (row.updatedAt instanceof Date
			? row.updatedAt
			: new Date()
		).toISOString(),
	};
}

function toArray(value: unknown): unknown[] {
	if (Array.isArray(value)) return value;
	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return value ? [value] : [];
		}
	}
	return [];
}

import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { cleanText, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { users } from "#/schema";

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
	occupation: z.string().max(120).optional(),
	interests: z.array(z.string().max(60)).max(40).optional(),
	tribes: z.array(z.number().int()).max(24).optional(),
	looking_for: z.array(z.number().int()).max(24).optional(),
	position: z.array(z.number().int()).max(8).optional(),
	languages: z.array(z.string().max(40)).max(12).optional(),
	photos: z.array(z.string().max(2048)).max(12).optional(),
	city: z.string().max(120).optional(),
	area: z.string().max(120).optional(),
	status: z.enum(["single", "dating", "friends", "it_complicated"]).optional(),
	relationship_status: z.string().max(40).optional(),
	pronouns: z.string().max(40).optional(),
	onboarding_done: z.boolean().optional(),
	visible: z.boolean().optional(),
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
					if (body.height !== undefined) set.height = body.height;
					if (body.weight !== undefined) set.weight = body.weight;
					if (body.body_type !== undefined)
						set.bodyType = cleanText(body.body_type, 32);
					if (body.occupation !== undefined)
						set.occupation = cleanText(body.occupation, 120);
					if (body.interests !== undefined)
						set.interests = dedupe(body.interests);
					if (body.tribes !== undefined) set.tribes = body.tribes;
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
						const ready = set.profileComplete >= 60;
						if (!ready) {
							return jsonError(
								"Add a name, bio, age, one photo, an interest and your city to finish",
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

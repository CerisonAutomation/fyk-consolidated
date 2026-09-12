import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { users } from "#/schema";

/**
 * `GET/PUT /api/settings` — the caller's own preferences.
 *
 * `#/components/settings/settings-client.tsx` read and wrote these columns
 * straight out of `public.users` with the browser's token. That table has no Row
 * Level Security (it never needed one while only the server held a key for it)
 * and it holds email, phone and the precise fix, so `0018_supabase_canonical.sql`
 * revokes `anon`/`authenticated` on it and this endpoint becomes the way to reach
 * the same columns. The allow-list below is the point: `notif_prefs` is a bag,
 * `role`/`tier`/`verification`/`trust_score`/`is_suspended` are not, and before
 * this the client could write any of them.
 *
 * `?view=export` answers the "download my data" button with the caller's own row
 * — the only row they may read, and every other person's data stays out of it.
 */
/**
 * The two bags are enumerated rather than accepted as `Record<string, boolean>`:
 * a settings write that could add arbitrary keys would turn `notif_prefs` into a
 * place to hide data, and every toggle in the UI is one of these booleans.
 */
const notifSchema = z
	.object({
		pushNotifications: z.boolean().optional(),
		matchNotifications: z.boolean().optional(),
		messageNotifications: z.boolean().optional(),
		eventNotifications: z.boolean().optional(),
		smartNotifications: z.boolean().optional(),
		readReceipts: z.boolean().optional(),
		discreetMode: z.boolean().optional(),
		offlineMode: z.boolean().optional(),
		voiceCommands: z.boolean().optional(),
		reduceMotion: z.boolean().optional(),
	})
	.strict();

const aiSchema = z
	.object({
		aiSuggestions: z.boolean().optional(),
		aiTranslation: z.boolean().optional(),
		aiModeration: z.boolean().optional(),
		aiMemory: z.boolean().optional(),
		autoReply: z.boolean().optional(),
	})
	.strict();

const prefsSchema = z
	.object({
		notif_prefs: notifSchema.optional(),
		ai_prefs: aiSchema.optional(),
		theme: z
			.enum(["dark", "light", "system", "midnight", "emerald", "rose"])
			.nullish(),
		accent: z.string().max(24).nullish(),
		font_size: z.number().int().min(12).max(22).nullish(),
		grid_columns: z.number().int().min(1).max(4).nullish(),
		card_style: z.string().max(24).nullish(),
		language: z.string().length(2).nullish(),
		colorblind_mode: z.boolean().nullish(),
		dnd_mode: z.boolean().nullish(),
		incognito: z.boolean().nullish(),
		hide_distance: z.boolean().nullish(),
		hide_online: z.boolean().nullish(),
		hide_last_online: z.boolean().nullish(),
		visible: z.boolean().nullish(),
	})
	.strict();

const EXPORT_COLUMNS = {
	id: users.id,
	displayName: users.displayName,
	handle: users.handle,
	bio: users.bio,
	occupation: users.occupation,
	relationshipStatus: users.relationshipStatus,
	ethnicity: users.ethnicity,
	pronouns: users.pronouns,
	birthday: users.birthday,
	age: users.age,
	height: users.height,
	weight: users.weight,
	bodyType: users.bodyType,
	position: users.position,
	languages: users.languages,
	lookingFor: users.lookingFor,
	intents: users.intents,
	tagCodes: users.tagCodes,
	interests: users.interests,
	tribes: users.tribes,
	photos: users.photos,
	avatar: users.avatar,
	city: users.city,
	area: users.area,
	status: users.status,
	theme: users.theme,
	accent: users.accent,
	fontSize: users.fontSize,
	gridColumns: users.gridColumns,
	cardStyle: users.cardStyle,
	dndMode: users.dndMode,
	colorblindMode: users.colorblindMode,
	language: users.language,
	notifPrefs: users.notifPrefs,
	aiPrefs: users.aiPrefs,
	profileComplete: users.profileComplete,
	onboardingDone: users.onboardingDone,
	createdAt: users.createdAt,
	updatedAt: users.updatedAt,
	// Deliberately excluded: `lat`/`lng` (a precise fix is not a preference and
	// an export file is the last place it should end up), `role`, `tier`,
	// `trust_score`, `verification`, `is_suspended` — moderation state belongs in
	// a staff process, not in a self-serve JSON download.
};

export const Route = createFileRoute("/api/settings/")({
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
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const view = new URL(request.url).searchParams.get("view") ?? "prefs";

					if (view === "export") {
						const [row] = await db
							.select(EXPORT_COLUMNS)
							.from(users)
							.where(eq(users.id, user.id))
							.limit(1);
						if (!row) return jsonError("No profile row yet", 404);
						return json({
							generated_at: new Date().toISOString(),
							profile: row,
						});
					}
					if (view !== "prefs") return jsonError("Unsupported view", 400);

					const [row] = await db
						.select({
							notifPrefs: users.notifPrefs,
							aiPrefs: users.aiPrefs,
							theme: users.theme,
							accent: users.accent,
							fontSize: users.fontSize,
							gridColumns: users.gridColumns,
							cardStyle: users.cardStyle,
							language: users.language,
							colorblindMode: users.colorblindMode,
							dndMode: users.dndMode,
							incognito: users.incognito,
							hideDistance: users.hideDistance,
							hideOnline: users.hideOnline,
							hideLastOnline: users.hideLastOnline,
							visible: users.visible,
						})
						.from(users)
						.where(eq(users.id, user.id))
						.limit(1);
					if (!row) return jsonError("No profile row yet", 404);

					// Snake_case keys on purpose: they are what the screen maps, and a
					// rename here would be a contract change dressed up as a fetch.
					return json(
						{
							prefs: {
								notif_prefs: row.notifPrefs ?? {},
								ai_prefs: row.aiPrefs ?? {},
								theme: row.theme ?? null,
								accent: row.accent ?? null,
								font_size: row.fontSize ?? null,
								grid_columns: row.gridColumns ?? null,
								card_style: row.cardStyle ?? null,
								language: row.language ?? null,
								colorblind_mode: row.colorblindMode ?? null,
								dnd_mode: row.dndMode ?? null,
								incognito: row.incognito ?? false,
								hide_distance: row.hideDistance ?? false,
								hide_online: row.hideOnline ?? false,
								hide_last_online: row.hideLastOnline ?? false,
								visible: row.visible ?? true,
							},
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `settings:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, prefsSchema, 16 * 1024);

					const [existing] = await db
						.select({
							notifPrefs: users.notifPrefs,
							aiPrefs: users.aiPrefs,
						})
						.from(users)
						.where(eq(users.id, user.id))
						.limit(1);
					if (!existing) return jsonError("Finish onboarding first", 409);

					const set: Partial<typeof users.$inferInsert> = {
						updatedAt: new Date(),
					};
					// Merge, not replace: the screen sends one key per toggle, and a
					// whole-object write from a single switch would clear its siblings.
					if (body.notif_prefs !== undefined) {
						set.notifPrefs = {
							...(typeof existing.notifPrefs === "object" &&
							existing.notifPrefs !== null
								? (existing.notifPrefs as Record<string, unknown>)
								: {}),
							...body.notif_prefs,
						};
					}
					if (body.ai_prefs !== undefined) {
						set.aiPrefs = {
							...(typeof existing.aiPrefs === "object" &&
							existing.aiPrefs !== null
								? (existing.aiPrefs as Record<string, unknown>)
								: {}),
							...body.ai_prefs,
						};
					}
					if (body.theme !== undefined)
						set.theme = cleanText(body.theme, 24) || null;
					if (body.accent !== undefined)
						set.accent = cleanText(body.accent, 24) || null;
					if (body.font_size !== undefined) set.fontSize = body.font_size;
					if (body.grid_columns !== undefined)
						set.gridColumns = body.grid_columns;
					if (body.card_style !== undefined)
						set.cardStyle = cleanText(body.card_style, 24) || null;
					if (body.language !== undefined) set.language = body.language;
					if (body.colorblind_mode !== undefined)
						set.colorblindMode = body.colorblind_mode;
					if (body.dnd_mode !== undefined) set.dndMode = body.dnd_mode;
					if (body.incognito !== undefined) set.incognito = body.incognito;
					if (body.hide_distance !== undefined)
						set.hideDistance = body.hide_distance;
					if (body.hide_online !== undefined) set.hideOnline = body.hide_online;
					if (body.hide_last_online !== undefined)
						set.hideLastOnline = body.hide_last_online;
					if (body.visible !== undefined) set.visible = body.visible;

					try {
						await db.update(users).set(set).where(eq(users.id, user.id));
					} catch (error) {
						return unexpected("settings:PUT", error);
					}

					return json({ ok: true, changed: Object.keys(set).length - 1 });
				},
				{
					maxBodySize: 16 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `settings:PUT:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});

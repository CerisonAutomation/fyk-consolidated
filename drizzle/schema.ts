import { sql } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	doublePrecision,
	timestamp,
	date,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

/**
 * Server-side database schema — the canonical data layer for `src/routes/api/**`.
 *
 * WHY DRIZZLE AND NOT PRISMA
 * --------------------------
 * `prisma/schema.prisma` had drifted from `supabase/migrations/`: it declared
 * `User.name`/`User.handle` while the database column is `users.pseudo`/`nick`
 * (no `@map`), `User.showDistance` while the column is `hide_distance` (also
 * inverted), `User.avatar` which does not exist in `0010_remaining_tables.sql`,
 * and `position` as `String` where the column is `jsonb`. Those are exactly the
 * class of bug a generated client hides until the first 500 in production.
 *
 * This file is deliberately written *from the SQL* — one file, readable in a
 * minute, no codegen step, no engine binaries to download at build time.
 * `0015_server_canonical.sql` reconciles the remaining gaps (adds
 * `users.avatar`) so that schema and database agree.
 *
 * Two user tables exist in this project's history: `public.profiles`
 * (0000, RLS-protected, used by the browser through Supabase) and
 * `public.users` (0010, used by this API). They are *not* linked; see AUDIT.md.
 * Everything here targets the `public.users` lineage because that is what the
 * JSON API's rows, foreign keys and rate limits were built around.
 *
 * One caveat this file cannot fix: `events`/`event_rsvps` were created by 0000
 * with `host_id`/`profile_id` referencing `public.profiles`, while
 * `meetnow_posts`/`notifications`/`push_subscriptions` reference `public.users`.
 * The declared `.references()` above documents the *API's* expectation; the
 * physical constraints stay as the migrations created them until the two user
 * tables are reconciled (AUDIT.md, P1). Do not run `drizzle-kit push` against a
 * production database before that reconciliation — generate a diff and read it.
 */

/* ----------------------------------- users ---------------------------------- */

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: text("email").notNull().unique(),
	phone: text("phone"),

	// Supabase Auth owns credentials. The column is kept for pre- Supabase
	// rows only and is never read or written by the API — see AUDIT.md.
	passwordHash: text("password_hash").notNull(),

	displayName: text("pseudo"),
	handle: text("nick"),
	bio: text("description"),
	occupation: text("occupation"),
	relationshipStatus: text("relationship_status"),
	ethnicity: text("ethnicity"),
	pronouns: text("pronouns"),
	birthday: date("birthday"),
	age: integer("age"),
	height: integer("height"),
	weight: integer("weight"),
	bodyType: text("body_type"),

	// jsonb string arrays — `asStringArray()` normalises legacy comma-strings.
	position: jsonb("position").default(sql`'[]'::jsonb`),
	languages: jsonb("languages").default(sql`'[]'::jsonb`),
	lookingFor: jsonb("looking_for").default(sql`'[]'::jsonb`),
	intents: jsonb("intents").default(sql`'[]'::jsonb`),
	tagCodes: jsonb("tag_codes").default(sql`'[]'::jsonb`),
	interests: jsonb("interests").default(sql`'[]'::jsonb`),
	tribes: jsonb("tribes").default(sql`'[]'::jsonb`),
	photos: jsonb("photos").default(sql`'[]'::jsonb`),

	avatar: text("avatar"),

	geoMode: text("geo_mode"),
	h3Index: text("h3_index"),
	// Precise fixes are only ever stored for "show my exact distance" flows.
	lat: doublePrecision("lat"),
	lng: doublePrecision("lng"),
	// ~250 m coarsened: what discovery and maps are allowed to see.
	latCoarse: doublePrecision("lat_coarse"),
	lngCoarse: doublePrecision("lng_coarse"),
	city: text("city"),
	area: text("area"),

	status: text("status").default("online"),
	role: text("role").default("user"),
	tier: text("tier").default("free"),
	verification: integer("verification").default(0),
	trustScore: integer("trust_score").default(50),
	profileComplete: integer("profile_complete").default(0),

	online: boolean("online").default(false),
	visible: boolean("visible").default(true),
	hidden: boolean("hidden").default(false),
	incognito: boolean("incognito").default(false),
	isDemo: boolean("is_demo").default(false),
	isSuspended: boolean("is_suspended").default(false),
	exposureLevel: text("exposure_level").default("clean"),
	hideDistance: boolean("hide_distance").default(false),
	hideOnline: boolean("hide_online").default(false),

	theme: text("theme"),
	accent: text("accent"),
	fontSize: integer("font_size").default(16),
	gridColumns: integer("grid_columns").default(2),
	cardStyle: text("card_style"),
	dndMode: boolean("dnd_mode").default(false),
	colorblindMode: boolean("colorblind_mode").default(false),
	language: text("language").default("en"),
	notifPrefs: jsonb("notif_prefs").default(sql`'{}'::jsonb`),
	aiPrefs: jsonb("ai_prefs").default(sql`'{}'::jsonb`),

	appleId: text("apple_id"),
	googleId: text("google_id"),

	lastCursor: text("last_cursor"),
	lastSeen: timestamp("last_seen", { withTimezone: true, precision: 6 }).defaultNow(),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, precision: 6 }).defaultNow(),
	onboardingDone: boolean("onboarding_done").default(false),
	onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, precision: 6 }),

	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

/* ---------------------------------- events ---------------------------------- */

export const events = pgTable("events", {
	id: uuid("id").primaryKey().defaultRandom(),
	hostId: uuid("host_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description"),
	activityId: text("activity_id"),
	scale: text("scale").notNull().default("casual"),
	cost: text("cost"),
	venue: text("venue"),
	address: text("address"),
	city: text("city"),
	lat: doublePrecision("lat"),
	lng: doublePrecision("lng"),
	startsAt: timestamp("starts_at", { withTimezone: true, precision: 6 }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, precision: 6 }),
	capacity: integer("capacity"),
	explicitness: text("explicitness").notNull().default("clean"),
	status: text("status").notNull().default("published"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

/** `going | maybe | declined` — composite PK doubles as the dedupe key. */
export const eventRsvps = pgTable(
	"event_rsvps",
	{
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		profileId: uuid("profile_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		status: text("status").notNull().default("going"),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.eventId, table.profileId] })],
);

/* ----------------------------------- taps ----------------------------------- */

/**
 * A "tap" (like). `UNIQUE(tapper_id, tapped_id)` in the DDL is what makes the
 * MeetNow join flow idempotent — no read-before-write to check for a duplicate.
 */
export const taps = pgTable(
	"taps",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		tapperId: uuid("tapper_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tappedId: uuid("tapped_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: text("type").default("like"),
		isSuper: boolean("is_super").default(false),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
	},
	(table) => [unique("taps_tapper_id_tapped_id_key").on(table.tapperId, table.tappedId)],
);

/* --------------------------------- meet now --------------------------------- */

/**
 * `0010_remaining_tables.sql` created this table with `category/note/location/
 * active`, while the API and the client speak `type/place/status/lat/lng/tags`.
 * `0015_server_canonical.sql` adds the missing columns; the legacy names are
 * still declared here so the same schema works before and after that migration.
 */
export const meetnowPosts = pgTable("meetnow_posts", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),

	type: text("type"),
	place: text("place"),
	status: text("status").default("active"),
	lat: doublePrecision("lat"),
	lng: doublePrecision("lng"),
	note: text("note"),
	location: text("location"),
	category: text("category"),
	tags: jsonb("tags").default(sql`'[]'::jsonb`),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull(),
	active: boolean("active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export type MeetnowPostRow = typeof meetnowPosts.$inferSelect;

/* ------------------------------- notifications ------------------------------ */

export const notifications = pgTable("notifications", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	title: text("title").notNull(),
	body: text("body"),
	actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
	href: text("href"),
	read: boolean("read").default(false),
	readAt: timestamp("read_at", { withTimezone: true, precision: 6 }),
	hidden: boolean("hidden").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
});

/* ------------------------------ push subscriptions -------------------------- */

/**
 * One row per browser/service-worker endpoint. `(userId, endpoint)` is unique
 * (0014) so re-registering rotates keys instead of duplicating pushes.
 */
export const pushSubscriptions = pgTable(
	"push_subscriptions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		endpoint: text("endpoint").notNull(),
		p256dh: text("p256dh").notNull(),
		auth: text("auth").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
	},
	(table) => [unique("push_subscriptions_user_id_endpoint_key").on(table.userId, table.endpoint)],
);

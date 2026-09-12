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
	/**
	 * Unique, and nullable since `0017`: Supabase also issues phone-only sessions,
	 * and a NOT NULL email made `PUT /api/profile` unable to create the row for
	 * those accounts. Never exposed through any response payload.
	 */
	email: text("email").unique(),
	phone: text("phone"),

	/**
	 * Legacy: Supabase Auth owns credentials, so this column is never read or
	 * written by the API. Nullable since `0015` (it used to be NOT NULL, which
	 * made a Supabase-only signup impossible).
	 */
	passwordHash: text("password_hash"),

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
	/**
	 * Set by `POST /api/boost` when a `consumables_inventory` boost is consumed.
	 * Discovery orders on it (`is boosted AND not expired` first), so a boost has
	 * a visible effect instead of being a flag nobody reads.
	 */
	boostExpiresAt: timestamp("boost_expires_at", { withTimezone: true, precision: 6 }),
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

/**
 * Granted consumables (boosters, super likes). `POST /api/boost` decrements one
 * row per call, so a boost always has a cost recorded in the same table the shop
 * writes to — it cannot be minted by an API caller.
 */
export const consumablesInventory = pgTable("consumables_inventory", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	quantity: integer("quantity").default(1),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
});

/* ------------------------- social graph (0010 + 0000) ----------------------- */

/** Saved profiles ("favourites"). `UNIQUE(user_id, target_id)` is the toggle key. */
export const favorites = pgTable(
	"favorites",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		targetId: uuid("target_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
	},
	(table) => [unique("favorites_user_id_target_id_key").on(table.userId, table.targetId)],
);

/** "Who viewed me". Written by the profile view beacon, read by /api/interest/visitors. */
export const footprints = pgTable("footprints", {
	id: uuid("id").primaryKey().defaultRandom(),
	visitorId: uuid("visitor_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	visitedId: uuid("visited_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	preset: text("preset"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
});

/** A private note the caller keeps about another user (never shown to them). */
export const userNotes = pgTable(
	"user_notes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		noteOwnerId: uuid("note_owner_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		targetUserId: uuid("target_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow(),
	},
	(table) => [unique("user_notes_note_owner_id_target_user_id_key").on(table.noteOwnerId, table.targetUserId)],
);

/**
 * Matches are `profiles`-keyed in `0000_profiles.sql` with a canonical
 * `user_a < user_b` ordering. Because `users.id` is the same uuid as the auth
 * (and therefore the profile) id, the API reads them directly; see AUDIT.md §3.2
 * for the reconciliation that must replace this bridge.
 */
export const matches = pgTable("matches", {
	id: uuid("id").primaryKey().defaultRandom(),
	userA: uuid("user_a").notNull(),
	userB: uuid("user_b").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
	unmatchedAt: timestamp("unmatched_at", { withTimezone: true, precision: 6 }),
});

export const blocks = pgTable("blocks", {
	id: uuid("id").primaryKey().defaultRandom(),
	blockerId: uuid("blocker_id").notNull(),
	blockedId: uuid("blocked_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
});

/* ---------------------------------- chat ----------------------------------- */

export const conversations = pgTable("conversations", {
	id: uuid("id").primaryKey().defaultRandom(),
	matchId: uuid("match_id"),
	/** Sorted `profile_id` pair joined by `-`; the dedupe key (0016). */
	memberKey: text("member_key"),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
});

/** Membership is the authorisation check for every conversation read. */
export const conversationMembers = pgTable(
	"conversation_members",
	{
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversations.id, { onDelete: "cascade" }),
		profileId: uuid("profile_id").notNull(),
		lastReadAt: timestamp("last_read_at", { withTimezone: true, precision: 6 }),
		archivedAt: timestamp("archived_at", { withTimezone: true, precision: 6 }),
	},
	(table) => [primaryKey({ columns: [table.conversationId, table.profileId] })],
);

/**
 * `body`, not `content`, and `unsent_at`/`expires_at` are the recall and
 * disappearing-media lifecycle — both must be filtered on read or a recalled
 * message keeps rendering for the other participant.
 */
export const messages = pgTable("messages", {
	id: uuid("id").primaryKey().defaultRandom(),
	conversationId: uuid("conversation_id")
		.notNull()
		.references(() => conversations.id, { onDelete: "cascade" }),
	senderId: uuid("sender_id").notNull(),
	type: text("type").notNull().default("text"),
	body: text("body"),
	storagePath: text("storage_path"),
	replyToId: uuid("reply_to_id"),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }),
	unsentAt: timestamp("unsent_at", { withTimezone: true, precision: 6 }),
	editedAt: timestamp("edited_at", { withTimezone: true, precision: 6 }),
	/** Real columns from `0017_message_actions.sql` — the pin button needs them. */
	isPinned: boolean("is_pinned").notNull().default(false),
	pinnedAt: timestamp("pinned_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
});

/** One reaction per (message, member): the `emoji` CHECK is the allowed set. */
export const messageReactions = pgTable(
	"message_reactions",
	{
		messageId: uuid("message_id")
			.notNull()
			.references(() => messages.id, { onDelete: "cascade" }),
		profileId: uuid("profile_id").notNull(),
		emoji: text("emoji").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.messageId, table.profileId] })],
);

/** Read receipts, per message and member (the `readBy` the chat shows). */
export const messageReads = pgTable(
	"message_reads",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		messageId: uuid("message_id")
			.notNull()
			.references(() => messages.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		readAt: timestamp("read_at", { withTimezone: true, precision: 6 }).defaultNow(),
	},
	(table) => [unique("message_reads_message_id_user_id_key").on(table.messageId, table.userId)],
);

/* ---------------------------------- albums ---------------------------------- */

export const privateAlbums = pgTable("private_albums", {
	id: uuid("id").primaryKey().defaultRandom(),
	ownerId: uuid("owner_id").notNull(),
	name: text("name").notNull().default("Private album"),
	defaultAccessPolicy: text("default_access_policy").notNull().default("standard"),
	defaultDurationSeconds: integer("default_duration_seconds"),
	defaultMaxOpens: integer("default_max_opens"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).defaultNow(),
});

export const privateAlbumItems = pgTable("private_album_items", {
	id: uuid("id").primaryKey().defaultRandom(),
	ownerId: uuid("owner_id").notNull(),
	storagePath: text("storage_path").notNull(),
	position: integer("position").notNull().default(0),
	albumId: uuid("album_id"),
	mediaKind: text("media_kind").notNull().default("image"),
	caption: text("caption"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
});

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

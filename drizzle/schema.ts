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
	index,
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
	/**
	 * "Show my last online" in `/settings/privacy`. Added with its consumer by
	 * `0026_privacy_controls.sql`, because the screen had been offering this switch for
	 * as long as it offered `hide_online` while no table had a column for it: the
	 * difference is that a user may be happy to show "online" and refuse "last seen
	 * 4 minutes ago", which is a far more identifying fact. Honoured by
	 * `toProfileCard()` and `publicProfile()`.
	 */
	hideLastOnline: boolean("hide_last_online").default(false),

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
	/**
	 * When the adult attestation was last accepted. 0000 kept this on
	 * `profiles` alone, which stopped it being writable once `profiles`
	 * became a read-only projection (0018): the date of birth lives in
	 * `profile_private`, and the attestation belongs with the rest of the row.
	 */
	ageVerifiedAt: timestamp("age_verified_at", { withTimezone: true, precision: 6 }),

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
/**
 * `profile_private` (0000) — the only place a real date of birth is kept.
 * Never projected into `profiles`, never selected by a list endpoint; the
 * derived `age` is what discovery sees.
 */
export const profilePrivate = pgTable("profile_private", {
	id: uuid("id").primaryKey(),
	dob: date("dob", { mode: "string" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

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

/**
 * "I never want to see this person again" — a per-viewer edge, distinct from
 * `users.hidden`, which is "my profile is hidden from everyone". `/settings/hidden`
 * had nothing to list before this table existed (`0018`).
 */
export const hides = pgTable(
	"hides",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		hiderId: uuid("hider_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		hiddenId: uuid("hidden_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).defaultNow(),
	},
	(table) => [unique("hides_hider_id_hidden_id_key").on(table.hiderId, table.hiddenId)],
);

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

/* --------------------------------- economy ---------------------------------- */

/**
 * One row per account, created on first read by `GET /api/wallet`.
 *
 * `balance` is not writable by application code since `0019`: a trigger derives
 * it from `wallet_transactions`, and `wallet_balance_is_derived()` raises if
 * anything but the ledger trigger changes it. That is the fix for three separate
 * balances (`wallet.balance`, the ledger and `king_pet.bones`) disagreeing about
 * how many bones an account owns.
 */
export const wallet = pgTable(
	"wallet",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.unique()
			.references(() => users.id, { onDelete: "cascade" }),
		balance: integer("balance").notNull().default(0),
		currency: text("currency").notNull().default("bones"),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	},
);

/**
 * The append-only ledger: the only way a balance moves.
 *
 * `amount` is SIGNED (0019) — positive credits, negative debits — because the
 * old "always positive + a credit/debit tag" convention is what let
 * `balance + amount` credit the wallet on a purchase. `source` names the product
 * that moved the money; `idempotencyKey` makes a retried request a no-op instead
 * of a second mint.
 */
export const walletTransactions = pgTable(
	"wallet_transactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		walletId: uuid("wallet_id")
			.notNull()
			.references(() => wallet.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		amount: integer("amount").notNull(),
		description: text("description").notNull(),
		source: text("source").notNull().default("server"),
		idempotencyKey: text("idempotency_key"),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	},
);

/**
 * What the payment provider thinks the account is paying for. Since 0019 this is
 * the *provider record*: `premium_entitlements` is the answer to "is this account
 * premium", because a subscription row can be `past_due` while the entitlement is
 * still valid until `expires_at`.
 */
export const subscriptions = pgTable("subscriptions", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	tier: text("tier").notNull().default("free"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	status: text("status").notNull().default("active"),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

/** The privilege row. Written only by the API, and only after a payment exists. */
export const premiumEntitlements = pgTable("premium_entitlements", {
	profileId: uuid("profile_id")
		.primaryKey()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	tier: text("tier").notNull().default("free"),
	source: text("source").notNull().default("none"),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

/** King Pet state. Progression columns are server-owned (0019 trigger). */
export const kingPet = pgTable("king_pet", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: "cascade" }),
	name: text("name").default("Kingsley"),
	stage: text("stage").default("baby"),
	mood: text("mood").default("happy"),
	experience: integer("experience").default(0),
	level: integer("level").default(1),
	streak: integer("streak").default(0),
	wardrobe: jsonb("wardrobe").default(sql`'[]'::jsonb`),
	equipped: jsonb("equipped").default(sql`'[]'::jsonb`),
	adventures: jsonb("adventures").default(sql`'[]'::jsonb`),
	moodLog: jsonb("mood_log").default(sql`'[]'::jsonb`),
	lastFedAt: timestamp("last_fed_at", { withTimezone: true, precision: 6 }),
	lastPlayedAt: timestamp("last_played_at", { withTimezone: true, precision: 6 }),
	pendingAdventure: jsonb("pending_adventure"),
	lastAdventureAt: timestamp("last_adventure_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});


export const petItems = pgTable("pet_items", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	type: text("type").notNull(),
	emoji: text("emoji"),
	boneCost: integer("bone_cost").notNull(),
	stageRequired: text("stage_required").default("baby"),
});

export const petAdventures = pgTable("pet_adventures", {
	id: uuid("id").primaryKey().defaultRandom(),
	theme: text("theme").notNull(),
	description: text("description"),
	emoji: text("emoji"),
	durationMinutes: integer("duration_minutes").default(30),
	boneCost: integer("bone_cost").notNull(),
	rewardType: text("reward_type").default("xp"),
	rewardAmount: integer("reward_amount").default(40),
});

/** Fansites: a creator's page, and the subscriber edge that replaced the "count notification rows" fiction. */
export const fansites = pgTable("fansites", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	coverUrl: text("cover_url"),
	subscriberCount: integer("subscriber_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const fansiteSubscribers = pgTable(
	"fansite_subscribers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		fansiteId: uuid("fansite_id")
			.notNull()
			.references(() => fansites.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	},
	(table) => [unique("fansite_subscribers_fansite_id_user_id_key").on(table.fansiteId, table.userId)],
);

/* --------------------------------- safety (0021) ------------------------------ */

/**
 * A user's own emergency contacts. Created by the browser through
 * `POST /api/safety/contacts`: this is data *about* the user, not privilege, and
 * RLS lets them edit it freely — the same line 0019 §5 drew for `user_notes`.
 *
 * `safety_contacts_not_self` in the migration makes the bug this table exists to
 * fix impossible at the row: an account cannot be its own emergency contact. The
 * composite unique on (id, user_id) is not redundancy — `safety_checkins` points at
 * *that* pair, so a check-in cannot reference somebody else's contact even with a
 * guessed uuid.
 */
export const safetyContacts = pgTable(
	"safety_contacts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		contactUserId: uuid("contact_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		phone: text("phone"),
		email: text("email"),
		note: text("note"),
		isDefault: boolean("is_default").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		unique("safety_contacts_id_user_id_key").on(table.id, table.userId),
		index("safety_contacts_owner_idx").on(
			table.userId,
			table.isDefault,
			table.createdAt,
		),
	],
);

/**
 * The safety check-in record. Read-only for the browser (RLS select-own and no
 * INSERT/UPDATE/DELETE grant): arming, confirming and marking overdue each notify a
 * third party, so they belong to `#/lib/safety.server.ts` and the routes around it.
 *
 * `status` is `text` + CHECK in the migration rather than a pg enum for the usual
 * reason (`ALTER TYPE ... ADD VALUE` cannot be used in the same transaction that
 * creates it), and the same four values are what `notifications` mirrors:
 * `check_in`, `check_in_resolved`, `check_in_overdue`.
 *
 * `alertedAt` is what makes the overdue transition safe to compute lazily: no job
 * runner exists in this deployment, so the first read after `due_at` marks the row
 * `missed`, and only the statement that flipped `alerted_at` from null gets to
 * notify. `notificationId` is the projection in the inbox, not the record.
 */
export const safetyCheckins = pgTable(
	"safety_checkins",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		contactId: uuid("contact_id").references(() => safetyContacts.id, {
			onDelete: "set null",
		}),
		place: text("place").notNull().default(""),
		lat: doublePrecision("lat"),
		lng: doublePrecision("lng"),
		armedAt: timestamp("armed_at", { withTimezone: true, precision: 6 })
			.notNull()
			.defaultNow(),
		dueAt: timestamp("due_at", { withTimezone: true, precision: 6 }).notNull(),
		resolvedAt: timestamp("resolved_at", { withTimezone: true, precision: 6 }),
		status: text("status")
			.notNull()
			.default("armed")
			.$type<"armed" | "safe" | "missed" | "cancelled">(),
		alertedAt: timestamp("alerted_at", { withTimezone: true, precision: 6 }),
		alertedContact: uuid("alerted_contact").references(() => users.id, {
			onDelete: "set null",
		}),
		note: text("note"),
		notificationId: uuid("notification_id"),
	},
	(table) => [
		index("safety_checkins_owner_idx").on(table.userId, table.armedAt),
	],
);

/* ---------------------------------- tribes ---------------------------------- */

/**
 * The tribe catalogue (`0010`), seeded by `0019` §9.
 *
 * Membership is a `users.tribes` jsonb array of **names**, not an edge table: that is
 * what the GIN index `users_tribes_idx` filters on and what
 * `#/lib/compatibility.ts`'s `tagOverlap` intersects. `member_count` is derived by
 * `tribes_recount` (0019 §7, repaired in 0022 §0) and a hand-written value is refused
 * by the counter guard, so nothing here may update it.
 *
 * There is no `tags` table in this schema, which is why `0022`'s header can say the
 * numeric tokens that used to appear in `users.tribes` were never foreign keys to
 * anything: they were unresolvable, not merely a second vocabulary.
 */
export const tribes = pgTable("tribes", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull().unique(),
	description: text("description"),
	icon: text("icon"),
	memberCount: integer("member_count").default(0),
	createdAt: timestamp("created_at", {
		withTimezone: true,
		precision: 6,
	}).defaultNow(),
});

/* --------------------------- complete features (0027) ------------------------ */

export const verificationRequests = pgTable("verification_requests", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	pose: text("pose").notNull(),
	selfieUrl: text("selfie_url").notNull(),
	status: text("status").notNull().default("pending"),
	confidence: doublePrecision("confidence"),
	reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, precision: 6 }),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const contentRatings = pgTable("content_ratings", {
	id: uuid("id").primaryKey().defaultRandom(),
	mediaId: text("media_id").notNull(),
	ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	url: text("url").notNull(),
	rating: text("rating").notNull().default("UNPROCESSED"),
	confidence: doublePrecision("confidence").notNull().default(0),
	reasons: jsonb("reasons").notNull().default(sql`'[]'::jsonb`),
	requiresHumanReview: boolean("requires_human_review").notNull().default(false),
	cdnToken: text("cdn_token"),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const stories = pgTable("stories", {
	id: uuid("id").primaryKey().defaultRandom(),
	authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	mediaUrl: text("media_url"),
	text: text("text"),
	viewCount: integer("view_count").notNull().default(0),
	viewers: jsonb("viewers").notNull().default(sql`'[]'::jsonb`),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull(),
	viewOnce: boolean("view_once").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const liveRooms = pgTable("live_rooms", {
	id: uuid("id").primaryKey().defaultRandom(),
	hostId: uuid("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description"),
	type: text("type").notNull().default("video"),
	status: text("status").notNull().default("live"),
	viewerCount: integer("viewer_count").notNull().default(0),
	peakViewers: integer("peak_viewers").notNull().default(0),
	totalCoins: integer("total_coins").notNull().default(0),
	startedAt: timestamp("started_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	endedAt: timestamp("ended_at", { withTimezone: true, precision: 6 }),
});

export const giftTransactions = pgTable("gift_transactions", {
	id: uuid("id").primaryKey().defaultRandom(),
	fromId: uuid("from_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	toId: uuid("to_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	giftId: text("gift_id").notNull(),
	cost: integer("cost").notNull(),
	creatorReceives: integer("creator_receives").notNull(),
	context: text("context").notNull().default("profile"),
	contextId: text("context_id"),
	message: text("message"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const referrals = pgTable("referrals", {
	id: uuid("id").primaryKey().defaultRandom(),
	referrerId: uuid("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	refereeId: uuid("referee_id").references(() => users.id, { onDelete: "set null" }),
	code: text("code").notNull(),
	clicks: integer("clicks").notNull().default(0),
	conversions: integer("conversions").notNull().default(0),
	rewardDays: integer("reward_days").notNull().default(7),
	rewardCoins: integer("reward_coins").notNull().default(100),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const vouchers = pgTable("vouchers", {
	id: uuid("id").primaryKey().defaultRandom(),
	code: text("code").notNull().unique(),
	discountPercent: integer("discount_percent"),
	freeDays: integer("free_days"),
	tier: text("tier"),
	maxUses: integer("max_uses").notNull().default(100),
	usedCount: integer("used_count").notNull().default(0),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull(),
	createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const polls = pgTable("polls", {
	id: uuid("id").primaryKey().defaultRandom(),
	messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
	conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
	question: text("question").notNull(),
	options: jsonb("options").notNull(),
	totalVotes: integer("total_votes").notNull().default(0),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull(),
	createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const spotlights = pgTable("spotlights", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	startsAt: timestamp("starts_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	endsAt: timestamp("ends_at", { withTimezone: true, precision: 6 }).notNull(),
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const savedSearches = pgTable("saved_searches", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	filters: jsonb("filters").notNull(),
	alertsEnabled: boolean("alerts_enabled").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const chatThemes = pgTable(
	"chat_themes",
	{
		conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
		userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
		background: text("background"),
		bubbleColor: text("bubble_color"),
		wallpaper: text("wallpaper"),
		updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.conversationId, table.userId] })],
);

export const appeals = pgTable("appeals", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	targetType: text("target_type").notNull(),
	targetId: text("target_id").notNull(),
	reason: text("reason").notNull(),
	status: text("status").notNull().default("pending"),
	reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const emergencyContacts = pgTable("emergency_contacts", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	phone: text("phone").notNull(),
	relationship: text("relationship").notNull(),
	isPrimary: boolean("is_primary").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const dataExports = pgTable("data_exports", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	includes: jsonb("includes").notNull().default(sql`'[]'::jsonb`),
	status: text("status").notNull().default("pending"),
	downloadUrl: text("download_url"),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }),
	requestedAt: timestamp("requested_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, precision: 6 }),
});

export const rouletteSessions = pgTable("roulette_sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	status: text("status").notNull().default("waiting"),
	matchedWith: uuid("matched_with").references(() => users.id, { onDelete: "set null" }),
	startedAt: timestamp("started_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	matchedAt: timestamp("matched_at", { withTimezone: true, precision: 6 }),
	endedAt: timestamp("ended_at", { withTimezone: true, precision: 6 }),
});

/* --------------------------- divine complete (0028) -------------------------- */

export const userAppConfigs = pgTable("user_app_configs", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
	discreetIcon: text("discreet_icon").notNull().default("default"),
	discreetEnabled: boolean("discreet_enabled").notNull().default(false),
	appLockEnabled: boolean("app_lock_enabled").notNull().default(false),
	appLockPinHash: text("app_lock_pin_hash"),
	appLockBiometric: boolean("app_lock_biometric").notNull().default(false),
	appLockTimeoutSec: integer("app_lock_timeout_sec").notNull().default(60),
	pauseMode: jsonb("pause_mode"),
	widgetConfig: jsonb("widget_config").notNull().default(sql`'{"enabled":true}'::jsonb`),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const multiAccountTokens = pgTable("multi_account_tokens", {
	id: uuid("id").primaryKey().defaultRandom(),
	ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	accountId: uuid("account_id").notNull(),
	email: text("email").notNull(),
	displayName: text("display_name").notNull(),
	accessTokenHash: text("access_token_hash").notNull(),
	refreshTokenHash: text("refresh_token_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const scheduledMessages = pgTable("scheduled_messages", {
	id: uuid("id").primaryKey().defaultRandom(),
	conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
	senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	type: text("type").notNull().default("text"),
	body: text("body").notNull(),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true, precision: 6 }).notNull(),
	status: text("status").notNull().default("scheduled"),
	sentAt: timestamp("sent_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const wishlists = pgTable("wishlists", {
	id: uuid("id").primaryKey().defaultRandom(),
	ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	participantId: uuid("participant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	title: text("title").notNull().default("Our Wishlist"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const wishlistItems = pgTable("wishlist_items", {
	id: uuid("id").primaryKey().defaultRandom(),
	wishlistId: uuid("wishlist_id").notNull().references(() => wishlists.id, { onDelete: "cascade" }),
	text: text("text").notNull(),
	category: text("category").notNull().default("general"),
	addedBy: uuid("added_by").notNull().references(() => users.id, { onDelete: "cascade" }),
	votes: jsonb("votes").notNull().default(sql`'[]'::jsonb`),
	voteCount: integer("vote_count").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const hotPicsRequests = pgTable("hot_pics_requests", {
	id: uuid("id").primaryKey().defaultRandom(),
	requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	status: text("status").notNull().default("pending"),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const photoScores = pgTable("photo_scores", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	url: text("url").notNull(),
	quality: integer("quality").notNull(),
	lighting: integer("lighting").notNull(),
	blur: integer("blur").notNull(),
	smile: integer("smile").notNull(),
	background: integer("background").notNull(),
	appeal: integer("appeal").notNull(),
	issues: jsonb("issues").notNull().default(sql`'[]'::jsonb`),
	suggestions: jsonb("suggestions").notNull().default(sql`'[]'::jsonb`),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const photoEnhancements = pgTable("photo_enhancements", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	originalUrl: text("original_url").notNull(),
	enhancedUrl: text("enhanced_url"),
	adjustments: jsonb("adjustments").notNull().default(sql`'{}'::jsonb`),
	allowed: boolean("allowed").notNull().default(true),
	blockedReason: text("blocked_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const aiConversations = pgTable("ai_conversations", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
	type: text("type").notNull(),
	input: jsonb("input").notNull(),
	output: jsonb("output").notNull(),
	model: text("model").notNull().default("heuristic"),
	tokensUsed: integer("tokens_used").notNull().default(0),
	latencyMs: integer("latency_ms").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const aiUsage = pgTable("ai_usage", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	feature: text("feature").notNull(),
	count: integer("count").notNull().default(1),
	date: date("date").notNull().defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const aiSuggestions = pgTable("ai_suggestions", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	suggestions: jsonb("suggestions").notNull(),
	selectedIndex: integer("selected_index"),
	selectedAt: timestamp("selected_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const translationCache = pgTable("translation_cache", {
	id: uuid("id").primaryKey().defaultRandom(),
	sourceText: text("source_text").notNull(),
	sourceLang: text("source_lang").notNull(),
	targetLang: text("target_lang").notNull(),
	translatedText: text("translated_text").notNull(),
	model: text("model").notNull().default("on_device"),
	confidence: doublePrecision("confidence").notNull().default(0.8),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const payPerReadUnlocks = pgTable("pay_per_read_unlocks", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
	cost: integer("cost").notNull(),
	unlockedAt: timestamp("unlocked_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const chatPinned = pgTable("chat_pinned", {
	id: uuid("id").primaryKey().defaultRandom(),
	conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
	messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
	pinnedBy: uuid("pinned_by").notNull().references(() => users.id, { onDelete: "cascade" }),
	pinnedAt: timestamp("pinned_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const chatEphemeralSettings = pgTable("chat_ephemeral_settings", {
	conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	durationSec: integer("duration_sec").notNull().default(0),
	enabled: boolean("enabled").notNull().default(false),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.conversationId, t.userId] })]);

export const screenshotLogs = pgTable("screenshot_logs", {
	id: uuid("id").primaryKey().defaultRandom(),
	conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
	reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	detectedAt: timestamp("detected_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	platform: text("platform").notNull().default("unknown"),
});

export const groupRoles = pgTable("group_roles", {
	groupId: uuid("group_id").notNull(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	role: text("role").notNull().default("member"),
	grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
	grantedAt: timestamp("granted_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.groupId, t.userId] })]);

export const groupBroadcasts = pgTable("group_broadcasts", {
	id: uuid("id").primaryKey().defaultRandom(),
	groupId: uuid("group_id").notNull(),
	authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	body: text("body").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const rewardedChatGrants = pgTable("rewarded_chat_grants", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
	grantedAt: timestamp("granted_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	source: text("source").notNull().default("ad"),
	used: boolean("used").notNull().default(false),
});

export const speedDatingEvents = pgTable("speed_dating_events", {
	id: uuid("id").primaryKey().defaultRandom(),
	title: text("title").notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, precision: 6 }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, precision: 6 }).notNull(),
	maxParticipants: integer("max_participants").notNull().default(20),
	roundDurationSec: integer("round_duration_sec").notNull().default(180),
	status: text("status").notNull().default("scheduled"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const speedDatingParticipants = pgTable("speed_dating_participants", {
	id: uuid("id").primaryKey().defaultRandom(),
	eventId: uuid("event_id").notNull().references(() => speedDatingEvents.id, { onDelete: "cascade" }),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	round: integer("round").notNull().default(1),
	matchedWith: uuid("matched_with").references(() => users.id, { onDelete: "set null" }),
	status: text("status").notNull().default("waiting"),
	joinedAt: timestamp("joined_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const calendarSync = pgTable("calendar_sync", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
	provider: text("provider").notNull().default("none"),
	enabled: boolean("enabled").notNull().default(false),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, precision: 6 }),
	freeSlots: jsonb("free_slots").notNull().default(sql`'[]'::jsonb`),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const calendarEvents = pgTable("calendar_events", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, precision: 6 }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, precision: 6 }).notNull(),
	location: text("location"),
	isPrivate: boolean("is_private").notNull().default(false),
	source: text("source").notNull().default("manual"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const profileStats = pgTable("profile_stats", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
	viewsTotal: integer("views_total").notNull().default(0),
	viewsUnique: integer("views_unique").notNull().default(0),
	likesSent: integer("likes_sent").notNull().default(0),
	likesReceived: integer("likes_received").notNull().default(0),
	matchesTotal: integer("matches_total").notNull().default(0),
	messagesSent: integer("messages_sent").notNull().default(0),
	messagesReceived: integer("messages_received").notNull().default(0),
	replyRate: doublePrecision("reply_rate").notNull().default(0),
	bestPhotoUrl: text("best_photo_url"),
	bestReplyHour: integer("best_reply_hour"),
	updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const profileAnalyticsEvents = pgTable("profile_analytics_events", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	eventType: text("event_type").notNull(),
	actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
	metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const consumablesCatalog = pgTable("consumables_catalog", {
	id: uuid("id").primaryKey().defaultRandom(),
	sku: text("sku").notNull().unique(),
	name: text("name").notNull(),
	description: text("description"),
	priceCoins: integer("price_coins").notNull(),
	priceUsdCents: integer("price_usd_cents"),
	type: text("type").notNull(),
	quantity: integer("quantity").notNull().default(1),
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const promoCodes = pgTable("promo_codes", {
	id: uuid("id").primaryKey().defaultRandom(),
	code: text("code").notNull().unique(),
	discountPercent: integer("discount_percent"),
	freeDays: integer("free_days"),
	freeCoins: integer("free_coins"),
	tier: text("tier"),
	maxUses: integer("max_uses").notNull().default(100),
	usedCount: integer("used_count").notNull().default(0),
	minTier: text("min_tier"),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull(),
	createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const promoRedemptions = pgTable("promo_redemptions", {
	id: uuid("id").primaryKey().defaultRandom(),
	promoId: uuid("promo_id").notNull().references(() => promoCodes.id, { onDelete: "cascade" }),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	redeemedAt: timestamp("redeemed_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const engagementNudges = pgTable("engagement_nudges", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	title: text("title").notNull(),
	body: text("body").notNull(),
	href: text("href"),
	sentAt: timestamp("sent_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	openedAt: timestamp("opened_at", { withTimezone: true, precision: 6 }),
	clickedAt: timestamp("clicked_at", { withTimezone: true, precision: 6 }),
});

export const reengagementCampaigns = pgTable("reengagement_campaigns", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	type: text("type").notNull(),
	targetFilter: jsonb("target_filter").notNull().default(sql`'{}'::jsonb`),
	content: jsonb("content").notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, precision: 6 }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, precision: 6 }).notNull(),
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const analyticsFunnel = pgTable("analytics_funnel", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	step: text("step").notNull(),
	reachedAt: timestamp("reached_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
});

export const gridPresets = pgTable("grid_presets", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	filters: jsonb("filters").notNull(),
	isQuick: boolean("is_quick").notNull().default(false),
	icon: text("icon"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const compatibilityScores = pgTable("compatibility_scores", {
	id: uuid("id").primaryKey().defaultRandom(),
	userA: uuid("user_a").notNull().references(() => users.id, { onDelete: "cascade" }),
	userB: uuid("user_b").notNull().references(() => users.id, { onDelete: "cascade" }),
	score: integer("score").notNull(),
	dimensions: jsonb("dimensions").notNull().default(sql`'{}'::jsonb`),
	calculatedAt: timestamp("calculated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const secretAdmirers = pgTable("secret_admirers", {
	id: uuid("id").primaryKey().defaultRandom(),
	admirerId: uuid("admirer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	admiredId: uuid("admired_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	revealed: boolean("revealed").notNull().default(false),
	revealedAt: timestamp("revealed_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const emergencyShares = pgTable("emergency_shares", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	contactId: uuid("contact_id").notNull().references(() => emergencyContacts.id, { onDelete: "cascade" }),
	lat: doublePrecision("lat").notNull(),
	lng: doublePrecision("lng").notNull(),
	place: text("place"),
	message: text("message"),
	sharedAt: timestamp("shared_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const deletionRequests = pgTable("deletion_requests", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
	reason: text("reason"),
	status: text("status").notNull().default("pending"),
	graceEndsAt: timestamp("grace_ends_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	requestedAt: timestamp("requested_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 6 }),
});

export const rateLimitLogs = pgTable("rate_limit_logs", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
	ip: text("ip"),
	endpoint: text("endpoint").notNull(),
	count: integer("count").notNull().default(1),
	windowStart: timestamp("window_start", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	blocked: boolean("blocked").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const backupExports = pgTable("backup_exports", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	type: text("type").notNull().default("full"),
	encrypted: boolean("encrypted").notNull().default(true),
	sizeBytes: integer("size_bytes"),
	status: text("status").notNull().default("pending"),
	downloadUrl: text("download_url"),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const offlineQueue = pgTable("offline_queue", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	action: text("action").notNull(),
	payload: jsonb("payload").notNull(),
	attempts: integer("attempts").notNull().default(0),
	status: text("status").notNull().default("pending"),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	processedAt: timestamp("processed_at", { withTimezone: true, precision: 6 }),
});

export const privacyReports = pgTable("privacy_reports", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	periodFrom: date("period_from").notNull(),
	periodTo: date("period_to").notNull(),
	profileViews: integer("profile_views").notNull().default(0),
	uniqueViewers: integer("unique_viewers").notNull().default(0),
	blockedCount: integer("blocked_count").notNull().default(0),
	dataUsage: jsonb("data_usage").notNull().default(sql`'{}'::jsonb`),
	activity: jsonb("activity").notNull().default(sql`'{}'::jsonb`),
	generatedAt: timestamp("generated_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

/* --------------------------- routing optimisation (0029) ------------------- */

export const otpCodes = pgTable("otp_codes", {
	id: uuid("id").primaryKey().defaultRandom(),
	phone: text("phone").notNull(),
	country: text("country").notNull().default("+1"),
	codeHash: text("code_hash").notNull(),
	attempts: integer("attempts").notNull().default(0),
	verified: boolean("verified").notNull().default(false),
	expiresAt: timestamp("expires_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, precision: 6 }),
});

export const routingMetrics = pgTable("routing_metrics", {
	id: uuid("id").primaryKey().defaultRandom(),
	route: text("route").notNull(),
	method: text("method").notNull(),
	p50Ms: doublePrecision("p50_ms").notNull().default(0),
	p95Ms: doublePrecision("p95_ms").notNull().default(0),
	p99Ms: doublePrecision("p99_ms").notNull().default(0),
	bundleKb: doublePrecision("bundle_kb").notNull().default(0),
	codeLines: integer("code_lines").notNull().default(0),
	duplicationScore: doublePrecision("duplication_score").notNull().default(0),
	status: text("status").notNull().default("pass"),
	measuredAt: timestamp("measured_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const routeDeduplication = pgTable("route_deduplication", {
	id: uuid("id").primaryKey().defaultRandom(),
	originalRoute: text("original_route").notNull(),
	canonicalRoute: text("canonical_route").notNull(),
	reason: text("reason").notNull(),
	savingsKb: doublePrecision("savings_kb").notNull().default(0),
	savingsLines: integer("savings_lines").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const bundleOptimisation = pgTable("bundle_optimisation", {
	id: uuid("id").primaryKey().defaultRandom(),
	bundleName: text("bundle_name").notNull(),
	currentKb: doublePrecision("current_kb").notNull(),
	targetKb: doublePrecision("target_kb").notNull(),
	criticalKb: doublePrecision("critical_kb").notNull(),
	lazyKb: doublePrecision("lazy_kb").notNull(),
	ultraLazyKb: doublePrecision("ultra_lazy_kb").notNull(),
	savingsKb: doublePrecision("savings_kb").notNull(),
	savingsPercent: doublePrecision("savings_percent").notNull(),
	strategy: text("strategy").notNull(),
	measuredAt: timestamp("measured_at", { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});


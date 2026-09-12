#!/usr/bin/env node
/**
 * `pnpm db:seed` — demo accounts for a local Supabase/Postgres.
 *
 * Why this exists as a plain script: the Prisma seed it replaced
 * (`dotenv -e .env.local -- prisma db seed`) was wired to `prisma/schema.prisma`,
 * which had already drifted from `supabase/migrations/` and could not express the
 * `auth.users → public.users` relationship at all. Prisma is gone; the schema is
 * Drizzle's, and the rows below are written against the real columns.
 *
 * Two rules follow from the 0018 migration:
 *
 *   1. `public.users.id` has a foreign key to `auth.users(id)`, so a demo profile
 *      cannot be inserted before its login exists. Auth users are therefore
 *      created first, through GoTrue's admin API, which needs
 *      `SUPABASE_SERVICE_ROLE_KEY`. Without that key the script stops and says so
 *      — it never pretends to have seeded something.
 *   2. `public.profiles` is a projection maintained by triggers and direct writes
 *      are refused, so this script only touches `public.users`; the mirror fills
 *      `profiles` (and `discoverable`, `handle`, the coarsened `age`) by itself.
 *
 * Usage:
 *   DATABASE_URL=postgres://... [SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...] \
 *     node scripts/seed.mjs [--with-activity]
 *
 * `--with-activity` additionally seeds taps/matches/a conversation so the social
 * screens have something to show. Idempotent: every insert is keyed on the demo
 * email/handle and skips existing rows.
 */
import { readFileSync } from "node:fs";
import process from "node:process";

const DEMO_PASSWORD = process.env.FYK_SEED_PASSWORD ?? "fyk-demo-password-2026";
const WITH_ACTIVITY = process.argv.includes("--with-activity");

// ---------------------------------------------------------------------------
// env: .env.local if present, otherwise the process environment
// ---------------------------------------------------------------------------
function loadEnv() {
	try {
		const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
		for (const line of text.split("\n")) {
			const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
			if (!match) continue;
			const [, key, raw] = match;
			if (process.env[key] !== undefined) continue;
			process.env[key] = raw.replace(/^["']|["']$/g, "");
		}
	} catch {
		/* no .env.local — fine, the shell may already have what we need */
	}
}
loadEnv();

const DATABASE_URL = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DATABASE_URL) {
	fail(
		"DATABASE_URL (or SUPABASE_DB_URL) is required. Example: postgres://postgres:postgres@127.0.0.1:54322/postgres",
	);
}

let postgres;
try {
	({ default: postgres } = await import("postgres"));
} catch {
	fail("`postgres` is not installed — run pnpm install first.");
}

/** `prepare: false` is mandatory: the Supabase transaction pooler has no statement cache. */
const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

// ---------------------------------------------------------------------------
// the demo set
// ---------------------------------------------------------------------------
const DEMO = [
	{
		email: "demo.aina@fyk.local",
		nick: "aina",
		pseudo: "Aina",
		birthday: "1994-03-14",
		city: "Sliema",
		area: "Seafront",
		lat: 35.9126,
		lng: 14.5019,
		occupation: "Bar manager",
		interests: ["late nights", "sea swimming", "vinyl"],
	},
	{
		email: "demo.jonas@fyk.local",
		nick: "jonas",
		pseudo: "Jonas",
		birthday: "1990-11-02",
		city: "St Julian's",
		area: "Paceville",
		lat: 35.9187,
		lng: 14.4894,
		occupation: "Sound engineer",
		interests: ["techno", "surf", "dogs"],
	},
	{
		email: "demo.mirel@fyk.local",
		nick: "mirel",
		pseudo: "Mirel",
		birthday: "1997-06-21",
		city: "Valletta",
		area: "Street 1.5",
		lat: 35.8989,
		lng: 14.5146,
		occupation: "Conservator",
		interests: ["history", "film photography", "wine"],
	},
	{
		email: "demo.tomas@fyk.local",
		nick: "tomas",
		pseudo: "Tomas",
		birthday: "1988-01-30",
		city: "Sliema",
		area: "Tigné",
		lat: 35.9105,
		lng: 14.5065,
		occupation: "Chef",
		interests: ["cooking", "late nights", "dogs"],
	},
	{
		email: "demo.nadia@fyk.local",
		nick: "nadia",
		pseudo: "Nadia",
		birthday: "1999-09-09",
		city: "Mellieha",
		area: "Bugibba",
		lat: 35.9569,
		lng: 14.3606,
		occupation: "Dive instructor",
		interests: ["freediving", "surf", "sea swimming"],
	},
	{
		email: "demo.pete@fyk.local",
		nick: "pete",
		pseudo: "Pete",
		birthday: "1992-07-17",
		city: "Valletta",
		area: "The Grand Harbour",
		lat: 35.8944,
		lng: 14.521,
		occupation: "Architect",
		interests: ["brutalism", "vinyl", "film photography"],
	},
];

function fail(message) {
	console.error(`\n✗ ${message}\n`);
	process.exit(1);
}

/**
 * Create the login in GoTrue. `email_confirm: true` keeps the demo accounts
 * sign-in-able immediately; the password is the shared seed password unless
 * `FYK_SEED_PASSWORD` overrides it.
 */
async function ensureAuthUsers() {
	if (!SERVICE_KEY || !SUPABASE_URL) {
		fail(
			"public.users.id references auth.users (0018), so a demo row needs a login first.\n" +
				"  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then re-run.\n" +
				"  (Directly inserting into auth.users is not supported and would leave\n" +
				"   GoTrue out of sync with the table.)",
		);
	}
	const created = [];
	for (const person of DEMO) {
		const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				apikey: SERVICE_KEY,
				Authorization: `Bearer ${SERVICE_KEY}`,
			},
			body: JSON.stringify({
				email: person.email,
				password: DEMO_PASSWORD,
				email_confirm: true,
				app_metadata: { role: "user" },
			}),
		});
		if (response.ok) {
			const body = await response.json();
			created.push(body.id);
			continue;
		}
		const text = await response.text();
		// "already exists" is the expected answer on a second run.
		if (/already exists|422/i.test(text)) continue;
		fail(`GoTrue refused to create ${person.email}: HTTP ${response.status} ${text.slice(0, 200)}`);
	}
	return created.length;
}

/** Look up the auth ids for the demo emails (works whether we just created them or not). */
async function authIdsByEmails() {
	const emails = DEMO.map((person) => person.email);
	const rows = await sql`
		select id, email from auth.users where email = any(${emails})
	`;
	return new Map(rows.map((row) => [row.email, row.id]));
}

async function seedUsers(ids) {
	let inserted = 0;
	for (const person of DEMO) {
		const id = ids.get(person.email);
		if (!id) continue;
		const result = await sql`
			insert into public.users (
				id, email, pseudo, nick, birthday, description, occupation,
				interests, tribes, looking_for, languages, photos,
				city, area, lat, lng, lat_coarse, lng_coarse,
				age, height, weight, body_type, pronouns,
				status, role, tier, verification, trust_score, profile_complete,
				online, visible, hidden, incognito, is_demo, is_suspended,
				relationship_status, onboarding_done, onboarding_completed_at,
				age_verified_at, last_active_at, last_seen
			) values (
				${id}, ${person.email}, ${person.pseudo}, ${person.nick}, ${person.birthday},
				${`Seeded for local development. ${person.occupation} who likes ${person.interests.join(", ")}.`},
				${person.occupation},
				${sql.json(person.interests)}, ${sql.json([1, 4])}, ${sql.json([1, 2])},
				${sql.json(["en", "mt"])}, ${sql.json([])},
				${person.city}, ${person.area},
				${person.lat}, ${person.lng},
				-- Coarsened the way the client does it (~250 m), so discovery and the
				-- grid can use these rows without ever seeing the precise fix.
				${round5(person.lat)}, ${round5(person.lng)},
				${ageFrom(person.birthday)}, ${170 + (inserted % 4) * 7}, ${72_000 + inserted * 1_500},
				${"athletic"}, ${"he/him"},
				${"single"}, ${"user"}, ${null}, ${2}, ${70}, ${100},
				${inserted % 2 === 0}, ${true}, ${false}, ${false}, ${true}, ${false},
				${"single"}, ${true}, now(), now(), now() - (${inserted} || ' hours')::interval, now()
			)
			on conflict (id) do nothing
		`;
		inserted += result.length;
	}
	return inserted;
}

async function seedActivity() {
	const people = await sql`
		select id, nick from public.users where is_demo order by nick
	`;
	if (people.length < 2) return { taps: 0, matches: 0, threads: 0 };

	// `taps` is keyed on (tapper_id, tapped_id); `matches` has no uniqueness
	// constraint at all, so both are guarded with NOT EXISTS rather than relying
	// on an `on conflict` that the schema does not offer.
	let taps = 0;
	let matches = 0;
	let threads = 0;
	for (let i = 0; i + 1 < people.length; i += 2) {
		const a = people[i];
		const b = people[i + 1];
		const liked = await sql`
			insert into public.taps (tapper_id, tapped_id, type)
			select ${a.id}, ${b.id}, 'like'
			where not exists (
				select 1 from public.taps
				where tapper_id = ${a.id} and tapped_id = ${b.id}
			)
		`;
		taps += liked.length;
		const likedBack = await sql`
			insert into public.taps (tapper_id, tapped_id, type)
			select ${b.id}, ${a.id}, 'like'
			where not exists (
				select 1 from public.taps
				where tapper_id = ${b.id} and tapped_id = ${a.id}
			)
		`;
		taps += likedBack.length;

		const paired = await sql`
			insert into public.matches (user_a, user_b)
			select least(${a.id}, ${b.id}), greatest(${a.id}, ${b.id})
			where not exists (
				select 1 from public.matches
				where user_a = least(${a.id}, ${b.id})
				  and user_b = greatest(${a.id}, ${b.id})
			)
		`;
		matches += paired.length;

		// One thread per matched pair, built the way `POST /api/conversations`
		// builds one: `member_key` is the sorted id pair joined by "-", plus a
		// member row each side.
		const [match] = paired[0] ?? (await sql`
			select id from public.matches
			where user_a = least(${a.id}, ${b.id}) and user_b = greatest(${a.id}, ${b.id})
			limit 1
		`);
		const memberKey = [a.id, b.id].sort().join("-");
		const existing = await sql`
			select id from public.conversations where member_key = ${memberKey} limit 1
		`;
		const conversationId = existing[0]?.id ?? crypto.randomUUID();
		if (!existing[0]) {
			await sql`
				insert into public.conversations (id, match_id, member_key, last_message_at)
				values (${conversationId}, ${match?.id ?? null}, ${memberKey}, now())
			`;
			await sql`
				insert into public.conversation_members (conversation_id, profile_id)
				values (${conversationId}, ${a.id}), (${conversationId}, ${b.id})
			`;
			await sql`
				insert into public.messages (conversation_id, sender_id, type, body)
				values (${conversationId}, ${a.id}, 'text',
						'Seeded thread — say something to wake the chat screens up.')
			`;
			threads += 1;
		}
	}
	return { taps, matches, threads };
}

function round5(value) {
	return Math.round(value * 100_000) / 100_000;
}

function ageFrom(iso) {
	const [year, month, day] = iso.split("-").map(Number);
	const now = new Date();
	let years = now.getUTCFullYear() - year;
	if (
		now.getUTCMonth() < month - 1 ||
		(now.getUTCMonth() === month - 1 && now.getUTCDate() < day)
	)
		years -= 1;
	return years;
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
try {
	const created = await ensureAuthUsers();
	const ids = await authIdsByEmails();
	if (ids.size === 0) {
		fail("No demo logins exist in auth.users, and none could be created.");
	}
	const users = await seedUsers(ids);
	const activity = WITH_ACTIVITY ? await seedActivity() : null;

	// `users_project_profile` is a row trigger, so `profiles` already mirrors the
	// inserts above; this is only a guard against a database whose triggers were
	// recreated by hand.
	await sql`select public.users_apply_projection(id) from public.users where is_demo`;

	const projected = await sql`
		select count(*)::int as total from public.profiles
		where id in (select id from public.users where is_demo)
	`;
	console.log(
		`\n✓ seeded ${users} demo profile(s)` +
			(created ? ` (${created} new auth user(s))` : "") +
			(activity
				? `, ${activity.taps} tap(s), ${activity.matches} match(es), ${activity.messages} thread(s)`
				: "") +
			`\n  ${projected[0].total} of them are mirrored into public.profiles and discoverable.\n` +
			`  password for every demo login: ${DEMO_PASSWORD}\n`,
	);
} catch (error) {
	fail(error instanceof Error ? error.message : String(error));
} finally {
	await sql.end({ timeout: 2 });
}

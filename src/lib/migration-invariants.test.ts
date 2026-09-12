import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static invariants over `supabase/migrations/` and the code that uses it.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * This repository is developed with no Postgres available: `supabase db push` is a
 * deploy-time step, so the migrations are *read*, never executed, during review. That
 * is survivable for DDL syntax and fatal for the classes of defect that only appear at
 * runtime — and every one of the four classes below was actually found this way during
 * the audit, twice in some cases:
 *
 *   - `client.rpc("wallet_credit_and_log")` and `types.ts`'s `find_similar_profiles`:
 *     calls to Postgres functions no migration has ever created. The first had a
 *     hand-written fallback that overwrote the balance, which is how it stayed hidden;
 *   - `MEDIA_BUCKET = "media"` while `003_storage.sql` created five *differently named*
 *     buckets: every upload answered "Bucket not found" and every read produced a
 *     valid-looking URL to nothing;
 *   - `notifications_type_check` rejecting `'check_in'`, `wallet_tx_type_check`
 *     rejecting `'credit'`, `consumables_type_check` rejecting what the shop sold,
 *     `subscriptions.tier` rejecting `'gold'`: the writes were rejected and the callers
 *     did not read the error, so the UI reported success;
 *   - two derived-count triggers referencing `OLD` from an INSERT row trigger (and one
 *     referencing `NEW` from a DELETE trigger), which plpgsql refuses with
 *     `record "old" is not assigned yet` — the reason `0019` would have aborted every
 *     signup until `0022` §0 repaired it.
 *
 * Each rule here is the machine-checked version of one of those findings, so the next
 * time somebody adds a call, a bucket or a trigger, the failure is a test rather than a
 * bug report. None of them require a database.
 */
const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

function versionOf(file: string): number {
	const m = /^(\d+)/.exec(file);
	return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

/** Migration sources in the order Supabase applies them. */
function migrations(): { file: string; src: string }[] {
	return readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort((a, b) => versionOf(a) - versionOf(b) || a.localeCompare(b))
		.map((f) => ({
			file: f,
			src: readFileSync(join(MIGRATIONS_DIR, f), "utf8"),
		}));
}

const ALL = migrations().map((m) => ({
	...m,
	raw: m.src,
	src: stripSql(m.src),
}));

/** SQL comments removed: prose about a defect must not satisfy a rule about it. */
function stripSql(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

/** Postgres built-ins a migration may legitimately call in a `select`. */
const BUILTIN = new Set([
	"now",
	"current_setting",
	"set_config",
	"gen_random_uuid",
	"nextval",
	"txid_current",
]);

/** Every `src/**` and `supabase/functions/**` file that can call the database. */
function sources(dir: string, exts: string[]): { file: string; src: string }[] {
	const out: { file: string; src: string }[] = [];
	// Test files are excluded on purpose: a guard that reads its own prose would have
	// to avoid describing the defects it exists to prevent.
	const ignored = /\.(test|spec)\.[cm]?[tj]sx?$|routeTree\.gen\.ts$/;
	const walk = (d: string) => {
		for (const entry of readdirSync(d, { withFileTypes: true })) {
			const p = join(d, entry.name);
			if (entry.isDirectory()) walk(p);
			else if (
				exts.some((e) => entry.name.endsWith(e)) &&
				!ignored.test(entry.name)
			)
				out.push({ file: p, src: readFileSync(p, "utf8") });
		}
	};
	try {
		walk(dir);
	} catch {
		/* missing directory is not an invariant failure */
	}
	return out;
}

const appSources = [
	...sources(join(ROOT, "src"), [".ts", ".tsx"]),
	...sources(join(ROOT, "supabase", "functions"), [".ts"]),
	...sources(join(ROOT, "scripts"), [".mjs", ".ts"]),
];

/**
 * Tables whose `type` column is a CHECK list, with the constraint that lists it. The
 * migrations do not agree on a naming pattern, and `taps.type` is deliberately absent:
 * it is a plain `text` column with no CHECK, which is why `type: "meetnow_join"` has
 * never failed there. Keeping the list explicit is the point — a guard that guessed
 * would silently stop covering a table the day a constraint were renamed.
 */
const TYPE_CHECKS: Record<string, string> = {
	notifications: "notifications_type_check",
	walletTransactions: "wallet_tx_type_check",
	storiesMedia: "stories_media_type_check",
	groupMessages: "group_messages_type_check",
	consumablesInventory: "consumables_type_check",
};

/**
 * The `{ … }` row objects of a `.values(…)` argument: one for the single-row form, one
 * per element for the array form. Nested braces stay inside the row they belong to.
 */
function rowObjects(src: string, from: number): string[] {
	const out: string[] = [];
	let i = from;
	let guard = 0;
	while (i < src.length && guard++ < 40) {
		while (i < src.length && /[\s,[\]]/.test(src[i]!)) i++;
		if (src[i] !== "{") break;
		let depth = 0;
		const start = i;
		for (; i < src.length; i++) {
			if (src[i] === "{") depth++;
			else if (src[i] === "}") {
				depth--;
				if (depth === 0) {
					out.push(src.slice(start + 1, i));
					i++;
					break;
				}
			}
		}
		if (depth !== 0) break;
	}
	return out;
}

/** Split on commas that are not inside quotes, parentheses or braces. */
function splitTop(text: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let current = "";
	for (const ch of text) {
		if (quote) {
			current += ch;
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === "'" || ch === `"`) {
			quote = ch;
			current += ch;
			continue;
		}
		if (ch === "(" || ch === "[" || ch === "{") depth++;
		else if (ch === ")" || ch === "]" || ch === "}") depth--;
		if (ch === "," && depth === 0) {
			out.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	if (current.trim()) out.push(current);
	return out;
}

/** Each top-level `( … )` of a `values` clause, for multi-row inserts. */
function valueTuples(src: string, from: number): string[] {
	const out: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let current = "";
	for (let i = from; i < src.length; i++) {
		const ch = src[i]!;
		if (quote) {
			current += ch;
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === "'" || ch === `"`) {
			quote = ch;
			current += ch;
			continue;
		}
		if (ch === "(") {
			depth++;
			if (depth === 1) {
				current = "";
				continue;
			}
		}
		if (ch === ")") {
			depth--;
			if (depth === 0) {
				out.push(current);
				continue;
			}
		}
		if (depth === 0) {
			if (ch === ";") break;
			continue;
		}
		current += ch;
		if (out.length > 200) break;
	}
	return out;
}

/**
 * The literals of the *last* definition of a named CHECK, as they are on the
 * database. Only `constraint <name> check` counts — a migration that merely talks
 * about the constraint must not satisfy a rule about it.
 */
function constraintLiterals(constraint: string): Set<string> | null {
	let found: Set<string> | null = null;
	for (const { src } of ALL) {
		const anchor = src.search(
			new RegExp(`constraint\\s+${constraint}\\s+check\\s*\\(`, "i"),
		);
		if (anchor < 0) continue;
		const open = src.indexOf("(", src.indexOf("check", anchor));
		if (open < 0) continue;
		let depth = 0;
		let close = -1;
		for (let i = open; i < src.length; i++) {
			if (src[i] === "(") depth++;
			else if (src[i] === ")") {
				depth--;
				if (depth === 0) {
					close = i;
					break;
				}
			}
		}
		if (close < 0) continue;
		const body = src.slice(open + 1, close);
		const list = /in\s*\(([^)]*)\)/i.exec(body);
		const values = list
			? [...list[1].matchAll(/'([^']*)'/g)].map((m) => m[1])
			: [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]);
		if (values.length === 0) continue;
		found = new Set(values);
	}
	return found;
}

/** SQL/JS line and block comments, removed so prose cannot satisfy a rule. */
function stripComments(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])--[^\n]*/g, "$1");
}

describe("migration invariants", () => {
	it("defines every function the app calls with .rpc()", () => {
		const defined = new Set<string>();
		for (const { src } of ALL) {
			for (const m of src.matchAll(
				/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi,
			)) {
				defined.add(m[1]);
			}
		}
		const called = new Set<string>();
		for (const { src } of appSources) {
			// Comments are stripped first: this repository documents its defects, and
			// a removed `client.rpc("wallet_credit_and_log")` lives on in prose. A rule
			// that counts prose would forbid explaining anything.
			for (const m of stripComments(src).matchAll(
				/\.rpc\(\s*["'`]([a-z_0-9]+)["'`]/gi,
			)) {
				called.add(m[1]);
			}
		}
		const missing = [...called].filter((name) => !defined.has(name));
		expect(
			missing,
			`rpc() calls with no migration: ${missing.join(", ")}`,
		).toEqual([]);
		expect(called.size).toBeGreaterThan(0);
	});

	it("creates every storage bucket the app writes to", () => {
		const buckets = new Set<string>();
		for (const { src } of ALL) {
			const blocks = src.matchAll(
				/insert\s+into\s+storage\.buckets[\s\S]*?(\n\s*values[\s\S]*?);/gi,
			);
			for (const block of blocks) {
				for (const m of block[1].matchAll(/\(\s*'([a-z0-9_-]+)'\s*,/gi)) {
					buckets.add(m[1]);
				}
			}
		}
		const used = new Set<string>();
		for (const { file, src } of appSources) {
			if (file.endsWith("types.ts")) continue;
			for (const m of src.matchAll(
				/\.storage\s*\.\s*from\(\s*["'`]([a-z0-9_-]+)["'`]/gi,
			)) {
				used.add(m[1]);
			}
			// `MEDIA_BUCKET`/`CHAT_BUCKET` indirection is the majority of call sites,
			// so the constant is resolved before the comparison.
			for (const m of src.matchAll(
				/export const (\w*BUCKET\w*)\s*=\s*"([a-z0-9_-]+)"/gi,
			)) {
				for (const { src: other } of appSources) {
					if (new RegExp(`from\\(\\s*${m[1]}`).test(other)) used.add(m[2]);
				}
			}
		}
		const missing = [...used].filter((b) => !buckets.has(b));
		expect(
			missing,
			`buckets referenced by the app and created by no migration: ${missing.join(", ")} (created: ${[...buckets].join(", ")})`,
		).toEqual([]);
		expect(used.size).toBeGreaterThanOrEqual(3);
	});

	it("never reads OLD in an INSERT trigger or NEW in a DELETE trigger", () => {
		const bodies = new Map<string, string>();
		for (const { src } of ALL) {
			// Any dollar-quote tag, not just `$$`: 0018 uses `$fn$` because a nested
			// `$$` would otherwise terminate the outer block, and a scanner that only
			// knows `$$` concludes the file references a function nobody defines.
			for (const m of src.matchAll(
				/create\s+or\s+replace\s+function\s+public\.(\w+)\s*\([^)]*\)[\s\S]*?\$([a-z_0-9]*)\$([\s\S]*?)\$\2\$/gi,
			)) {
				bodies.set(m[1], stripComments(m[3]));
			}
		}
		const offenders: string[] = [];
		for (const { file, src } of ALL) {
			for (const m of src.matchAll(
				/create\s+trigger\s+(\w+)\s+((?:before|after)\s+[\s\S]{0,80}?)\s+on\s+(?:public|fyk)\.(\w+)[\s\S]{0,80}?for each row execute (?:function|procedure)\s+public\.(\w+)\(\)/gi,
			)) {
				const [, trigger, when, table, fn] = m;
				const body = bodies.get(fn);
				if (!body) {
					offenders.push(
						`${file}: trigger ${trigger} executes ${fn}(), which no migration defines`,
					);
					continue;
				}
				const guards = /tg_op/i.test(body);
				const inserts = /\binsert\b/i.test(when);
				const deletes = /\bdelete\b/i.test(when);
				if (inserts && /\bold\.\w+/i.test(body) && !guards) {
					offenders.push(
						`${file}: ${fn} reads OLD in trigger ${trigger} on ${table} (insert) without branching on tg_op`,
					);
				}
				if (deletes && /\bnew\.\w+/i.test(body) && !guards) {
					offenders.push(
						`${file}: ${fn} reads NEW in trigger ${trigger} on ${table} (delete) without branching on tg_op`,
					);
				}
			}
		}
		expect(offenders).toEqual([]);
	});

	it("drops each policy before recreating it, so a file can be re-applied", () => {
		const offenders: string[] = [];
		for (const { file, src } of ALL) {
			const drops = new Set<string>();
			for (const line of src.split("\n")) {
				const d =
					/drop\s+policy\s+if\s+exists\s+"?([a-z0-9_]+)"?\s+on\s+(?:public|fyk)\.(\w+)/i.exec(
						line,
					);
				if (d) drops.add(`${d[2]}.${d[1]}`);
				const c =
					/create\s+policy\s+([a-z0-9_]+)\s+on\s+(?:public|fyk)\.(\w+)/i.exec(
						line,
					);
				if (c && !drops.has(`${c[2]}.${c[1]}`)) {
					offenders.push(
						`${file}: create policy ${c[1]} on ${c[2]} with no preceding drop`,
					);
				}
			}
		}
		// Only the files written *after* the audit's idempotency rule (0016+) are held to
		// it: 0000–0015 predate it and re-applying those files is not a supported path.
		const modern = offenders.filter((o) => {
			const v = versionOf(o.split(":")[0].replace(/^.*\//, ""));
			return v >= 16;
		});
		expect(modern).toEqual([]);
	});

	it("never uses ALTER TYPE ... ADD VALUE, which cannot be used in the same transaction that adds it", () => {
		const hits: string[] = [];
		for (const { file, src } of ALL) {
			if (/alter\s+type[\s\S]{0,120}add\s+value/i.test(src)) hits.push(file);
		}
		expect(
			hits,
			"use text + CHECK instead: `db push` wraps a whole file in one transaction, and a new enum label cannot be used inside it",
		).toEqual([]);
	});

	it.each(
		Object.entries(TYPE_CHECKS),
	)("%s accepts only the types its CHECK lists", (table, constraint) => {
		const allowed = constraintLiterals(constraint);
		if (!allowed) {
			expect(
				`no ${constraint} in the migration set`,
				`${table}.type is written by this app, so it must be constrained by a named CHECK the guard can read`,
			).toBe("present");
			return;
		}
		const offenders: string[] = [];

		// Drizzle writes: `tx.insert(<table>).values({ … })`, including the array form.
		for (const { file, src } of appSources) {
			for (const m of src.matchAll(
				new RegExp(
					`insert\\(\\s*${table}\\s*\\)\\s*\\.values\\s*\\(?\\s*(\\[|\\{)`,
					"g",
				),
			)) {
				for (const row of rowObjects(src, m.index + m[0].length - 1)) {
					for (const t of row.matchAll(
						/(?:^|[,{])\s*type:\s*"([a-z_0-9]+)"/gi,
					)) {
						if (!allowed.has(t[1])) offenders.push(`${file}: "${t[1]}"`);
					}
				}
			}
		}

		// SQL writes, in the migrations and in the edge functions: the column list says
		// which value is the type, so the values are matched positionally, by name.
		for (const { file, src } of ALL) {
			for (const m of src.matchAll(
				/insert\s+into\s+(?:public\.)?([a-z_]+)\s*\(([^)]*)\)\s*values\s*/gi,
			)) {
				const camel = m[1].replace(/_+([a-z])/gi, (_x, c: string) =>
					c.toUpperCase(),
				);
				if (camel !== table) continue;
				const columns = splitTop(m[2]).map((c) =>
					c.trim().replace(/["`]/g, "").toLowerCase(),
				);
				const at = columns.indexOf("type");
				if (at < 0) continue;
				for (const tuple of valueTuples(src, m.index + m[0].length)) {
					const cells = splitTop(tuple);
					const cell = cells[at];
					if (!cell) continue;
					const lit = /^\s*'([a-z_0-9]+)'\s*$/i.exec(cell);
					if (lit && !allowed.has(lit[1])) {
						offenders.push(`${file}: '${lit[1]}' (column list position ${at})`);
					}
				}
			}
		}

		expect(
			[...new Set(offenders)],
			`${constraint} rejects these with SQLSTATE 23514, which aborts the statement — and, in the routes that wrap the insert in a transaction, the writes around it too: the feature looks reachable and quietly does nothing`,
		).toEqual([]);
	});

	it("grants the roles the migrations assume exist", () => {
		// `anon` and `authenticated` are created by Supabase itself; a `grant to fyk_app`
		// would abort the whole file on every project, so role names used in grants are
		// pinned to the two that exist.
		const roles = new Set<string>();
		for (const { src } of ALL) {
			for (const m of src.matchAll(
				/(?:grant|revoke)[^;]*?\b(?:to|from)\s+([a-z_0-9,\s]+);/gi,
			)) {
				for (const r of m[1].split(",")) {
					const name = r.trim();
					if (name) roles.add(name);
				}
			}
		}
		const allowed = new Set([
			"anon",
			"authenticated",
			"service_role",
			"public",
		]);
		const unknown = [...roles].filter((r) => !allowed.has(r));
		expect(
			unknown,
			`grants to roles this deployment does not create: ${unknown.join(", ")}`,
		).toEqual([]);
	});

	it("never references a table a later migration creates", () => {
		const createdIn = new Map<string, number>();
		for (let i = 0; i < ALL.length; i++) {
			for (const m of ALL[i].src.matchAll(
				/create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public|fyk)\.([a-z_0-9]+)/gi,
			)) {
				if (!createdIn.has(m[1].toLowerCase()))
					createdIn.set(m[1].toLowerCase(), i);
			}
		}
		const offenders: string[] = [];
		for (let i = 0; i < ALL.length; i++) {
			const src = ALL[i].src;
			for (const m of src.matchAll(
				/create\s+(?:unique\s+)?index(?:\s+if\s+not\s+exists)?\s+\w+\s+on\s+(?:public|fyk)\.([a-z_0-9]+)/gi,
			)) {
				const at = createdIn.get(m[1].toLowerCase());
				if (at !== undefined && at > i) {
					offenders.push(
						`${ALL[i].file}: index on ${m[1]}, created in ${ALL[at].file}`,
					);
				}
			}
			for (const m of src.matchAll(
				/create\s+materialized\s+view(?:\s+if\s+not\s+exists)?\s+\S+[\s\S]{0,900}?\b(?:from|join)\s+(?:public|fyk)\.([a-z_0-9]+)/gi,
			)) {
				const at = createdIn.get(m[1].toLowerCase());
				if (at !== undefined && at > i) {
					offenders.push(
						`${ALL[i].file}: materialized view reads ${m[1]}, created in ${ALL[at].file}`,
					);
				}
			}
		}
		// This is the rule that would have caught 0009 for the last five months: fifteen
		// `CREATE INDEX` statements and one materialized view pointed at tables that
		// 0010 creates, on a file that also opened with `ALTER SYSTEM` — so `supabase db
		// push` aborted there and nothing after it had ever been applied. 0023 holds the
		// statements now.
		expect(offenders).toEqual([]);
	});

	it("does not touch server configuration", () => {
		const offenders: string[] = [];
		for (const { file, src } of ALL) {
			for (const m of src.matchAll(
				/\b(alter\s+system|alter\s+database)\b[^;]*/gi,
			)) {
				offenders.push(`${file}: ${m[0].trim().slice(0, 72)}`);
			}
		}
		// `ALTER SYSTEM`/`ALTER DATABASE SET` need privileges a project's SQL role does
		// not have, apply cluster-wide, and survive no rollback. `0021` also relies on a
		// *transaction-local* `set_config`, which is the allowed shape: scoped, revertible,
		// and it cannot make one environment behave differently from another.
		expect(offenders).toEqual([]);
	});

	it("defines the functions the migration set itself calls", () => {
		const defined = new Set<string>();
		for (const { src } of ALL) {
			for (const m of src.matchAll(
				/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi,
			)) {
				defined.add(m[1]);
			}
		}
		const offenders: string[] = [];
		for (const { file, src } of ALL) {
			for (const m of stripComments(src).matchAll(
				/\bselect\s+(?:public\.)?([a-z_0-9]+)\s*\(\s*\)\s*;/gi,
			)) {
				const name = m[1];
				if (BUILTIN.has(name)) continue;
				if (!defined.has(name)) offenders.push(`${file}: select ${name}()`);
			}
		}
		expect(offenders).toEqual([]);
	});
});

/**
 * Edge-function trust, and the tables a function's own caller owns.
 *
 * A Supabase Edge Function is an HTTP endpoint on a public hostname whose authentication is
 * decided by configuration, not code — and this repository declared no `[functions.*]`
 * section at all, so all five inherited the platform default `verify_jwt = true`. That
 * default is correct for the two a signed-in browser calls with its access token, and fatal
 * for the two whose caller cannot produce one: `notify` is invoked by `pg_net` from a trigger
 * and `cron-cleanup` by an external scheduler, so both were 401-ing every attempt —
 * "scheduled housekeeping" and "push delivery" were simultaneously true on paper and dead in
 * production. The fix cannot be "turn the check off", because both of those functions hold
 * the service role: one sends attacker-chosen text to another user's lock screen, the other
 * deletes rows. So the invariant is the *pair* — an opened function must carry a shared
 * secret — and this file is what keeps the pair from drifting apart again.
 */
describe("edge-function trust", () => {
	const config = readFileSync(join(ROOT, "supabase", "config.toml"), "utf8");
	const functionsDir = join(ROOT, "supabase", "functions");
	const names = readdirSync(functionsDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);
	const functions = sources(functionsDir, [".ts"]).map((f) => ({
		...f,
		name: f.file.split(sep).slice(-2)[0] ?? "",
	}));

	/** The explicit `verify_jwt` for a function, or `null` when it declares nothing. */
	function declaredVerify(name: string): boolean | null {
		let inSection = false;
		for (const raw of config.split("\n")) {
			const line = raw.trim();
			if (line.startsWith("[")) {
				inSection = line === `[functions.${name}]`;
				continue;
			}
			if (!inSection) continue;
			const m = /^verify_jwt\s*=\s*(true|false)$/.exec(line);
			if (m) return m[1] === "true";
		}
		return null;
	}

	it("declares a JWT posture for every function instead of inheriting one", () => {
		const undeclared = names.filter((n) => declaredVerify(n) === null);
		expect(undeclared).toEqual([]);
	});

	it("keeps the functions a browser calls behind the platform check", () => {
		// `ai-chat` spends money and `moderate` spends a provider call, both keyed off the
		// caller's identity; `verify_jwt = false` would leave the limiter with nothing
		// anonymous to be limited by.
		const mustVerify = ["ai-chat", "moderate"];
		const offenders = mustVerify.filter((n) => declaredVerify(n) !== true);
		expect(offenders).toEqual([]);
	});

	it("requires a shared secret of any unauthenticated function that holds privilege", () => {
		const offenders: string[] = [];
		for (const { name, src } of functions) {
			if (declaredVerify(name) !== false) continue;
			const privileged =
				/SERVICE_ROLE_KEY/.test(src) ||
				/\.from\(\s*"\w+"\s*\)\.(insert|update|delete)\(/.test(src) ||
				/\.rpc\(\s*"\w+"/.test(src);
			if (!privileged) continue;
			const header = /headers\.get\(\s*"x-fyk-[a-z-]+-token"\s*\)/.test(src);
			const secret = /Deno\.env\.get\(\s*"[A-Z0-9_]*TOKEN"\s*\)/.test(src);
			// Refusing while unconfigured is the difference between "not yet deployed" and
			// "open to the internet until somebody remembers".
			const refuses =
				/if\s*\(\s*![A-Za-z0-9_]*TOKEN\s*\)[\s\S]{0,260}?503/.test(src);
			if (!header || !secret || !refuses) {
				offenders.push(
					`${name}: header=${header} secret=${secret} refusesUnset=${refuses}`,
				);
			}
		}
		expect(offenders).toEqual([]);
	});

	it("does not let a notification trigger call something that inserts notifications", () => {
		// The self-amplification this prevents: 0023 §4 put an AFTER INSERT trigger on
		// `public.notifications` that POSTs to `notify`, and `notify` wrote a row into
		// `public.notifications`. Had the write been legal, every push would have re-fired
		// the trigger that produced it. It was not legal — `push` is a transport, not a value
		// in `notifications_type_check` — so the failure was *silent* instead: the function
		// was rejected, and a user who enabled notifications received none, forever.
		const stripped = ALL.map((m) => stripSql(m.src)).join("\n");
		const notifyTriggers: { table: string; fn: string }[] = [];
		for (const m of stripped.matchAll(
			/create\s+trigger\b([\s\S]{0,420}?)execute\s+function\s+(?:public\.)?([a-z_0-9]+)\s*\(\s*\)/gi,
		)) {
			const table = /\bon\s+(?:public\.)?([a-z_0-9]+)/i.exec(m[1])?.[1];
			if (!table) continue;
			const body = new RegExp(
				`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${m[2]}\\b[\\s\\S]{0,400}?\\$fn\\$([\\s\\S]*?)\\$fn\\$`,
				"i",
			).exec(stripped);
			if (body && /net\.http_post/i.test(body[1])) {
				notifyTriggers.push({ table, fn: m[2] });
			}
		}
		// A "found nothing" result and a "found no violation" result are the same number,
		// so the set the rule walks has to be non-empty or the guard is vacuous: an earlier
		// version of this test captured the function's *header* (lazy `\\$fn\\$` stops at the
		// opening delimiter) and passed because it had silently seen nothing.
		expect(notifyTriggers).toContainEqual({
			table: "notifications",
			fn: "enqueue_push_notification",
		});
		const offenders: string[] = [];
		for (const { name, src } of functions) {
			for (const m of src.matchAll(/\.from\(\s*"(\w+)"\s*\)\.insert\(/g)) {
				const hit = notifyTriggers.find((t) => t.table === m[1]);
				if (hit) {
					offenders.push(
						`functions/${name}: inserts into ${m[1]}, which fires ${hit.fn}()`,
					);
				}
			}
		}
		expect(offenders).toEqual([]);
	});

	it("keeps the push payload and the service worker in step", () => {
		// `public/sw.js` is a static file in a different language, build and runtime from
		// its producer, so nothing else joins them: a renamed field would mean every
		// notification renders `undefined`, and no type error anywhere.
		const notify = functions.find((f) => f.name === "notify");
		expect(notify).toBeDefined();
		expect(
			/JSON\.stringify\(\s*\{\s*title,\s*body,\s*href\s*\}\s*\)/.test(
				notify?.src ?? "",
			),
		).toBe(true);
		const sw = readFileSync(join(ROOT, "public", "sw.js"), "utf8");
		for (const key of ["title", "body", "href"]) {
			expect(new RegExp(`\\b${key}\\b`).test(sw)).toBe(true);
		}
	});
});

#!/usr/bin/env node
/**
 * Contract audit — every `/api/*` path the app calls must exist, and every route
 * that exists should have a caller.
 *
 * WHY THIS EXISTS
 * ---------------
 * "Route exists" and "screen works" are different claims. A generated screen can
 * `fetch("/api/groups")` for a route nobody wrote; the request then falls through
 * to `/api/$`, which answers a correct JSON 404, and the screen renders its empty
 * state forever. Nothing in the compiler connects the two halves, so this script
 * is the connection: it reads the route tree and every callsite, and fails the
 * build when they disagree.
 *
 * It checks four things:
 *   1. UNMATCHED  — a callsite with no route (the app asks for something absent).
 *   2. METHOD     — a callsite whose verb the matched route does not declare
 *                   (the route answers 405, or worse, falls through to HTML).
 *   3. ORPHAN     — a route no caller and no registry entry references (dead
 *                   surface, or a screen that was never wired).
 *   4. REGISTRY   — a path in `src/lib/routing/canonical-routes.ts` that does not
 *                   exist, i.e. the single source of truth pointing at nothing.
 *
 * USAGE
 *   node scripts/audit-contracts.mjs            # fail-closed report
 *   node scripts/audit-contracts.mjs --json     # machine-readable, same exit code
 *   node scripts/audit-contracts.mjs --allow-orphans
 *
 * Exit code 1 on any unmatched callsite, method mismatch or dead registry entry.
 * Orphans are reported but only fail with --strict-orphans: a route reached by a
 * webhook, a cron, or a native client has no in-repo caller by design.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const API_DIR = join(SRC, "routes", "api");
const REGISTRY = join(SRC, "lib", "routing", "canonical-routes.ts");

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const strictOrphans = args.has("--strict-orphans");
const allowOrphans = args.has("--allow-orphans");

/* -------------------------------------------------------------------------- */
/* filesystem                                                                  */
/* -------------------------------------------------------------------------- */

function walk(dir, filter) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...walk(full, filter));
		else if (filter(full)) out.push(full);
	}
	return out;
}

const isSource = (p) => /\.(ts|tsx)$/.test(p);
/** Generated route tree and tests quote paths without calling them. */
const isCaller = (p) =>
	isSource(p) &&
	!p.startsWith(`${API_DIR}/`) &&
	!p.endsWith("routeTree.gen.ts") &&
	!/\.test\.tsx?$/.test(p) &&
	!p.endsWith("/canonical-routes.ts") &&
	!p.endsWith("/api-deduplication.ts");

/* -------------------------------------------------------------------------- */
/* routes                                                                      */
/* -------------------------------------------------------------------------- */

/** `src/routes/api/groups/$groupId/index.ts` -> `/api/groups/*` */
function routePath(file) {
	let path = relative(API_DIR, file).replace(/\\/g, "/");
	path = path.replace(/\/index\.tsx?$/, "").replace(/\.tsx?$/, "");
	if (path === "$" || path === "$.tsx") return null; // catch-all, matches nothing specific
	const segments = path
		.split("/")
		.filter(Boolean)
		.map((segment) => (segment.startsWith("$") ? "*" : segment));
	return `/api/${segments.join("/")}`.replace(/\/$/, "") || "/api";
}

const VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

/** Verbs a route file declares inside `handlers: { ... }`. */
function declaredVerbs(source) {
	const found = new Set();
	for (const verb of VERBS) {
		// Handler keys are declared at a fixed indent inside `handlers:`; matching
		// the key rather than the word keeps `methodNotAllowed("GET, POST")` strings
		// (which name verbs a route *refuses*) out of the result.
		const re = new RegExp(`^\\s*${verb}:`, "m");
		if (re.test(source)) found.add(verb);
	}
	return found;
}

const routeFiles = walk(API_DIR, isSource);
const routes = new Map();
for (const file of routeFiles) {
	const path = routePath(file);
	if (!path) continue;
	const source = readFileSync(file, "utf8");
	routes.set(path, {
		path,
		file: relative(ROOT, file),
		verbs: declaredVerbs(source),
		splats: path.split("/").filter((s) => s === "*").length,
	});
}

/* -------------------------------------------------------------------------- */
/* callsites                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Blank out comments, preserving every offset and line break.
 *
 * WHY: a route's own documentation names the paths it replaced — the header of
 * `#/routes/paywall` lists `/api/billing/checkout` precisely to say that path does
 * not exist. Counting those mentions as callsites made the audit report the fixed
 * bug as an open one, and made a well-documented file look worse than a silent one.
 *
 * Comment characters are replaced with spaces rather than removed so `match.index`
 * still points at the same offset in the original source, and line numbers in the
 * report stay true. String and template literals are copied verbatim: an
 * interpolated path (`/api/presence/${id}`) is a real callsite and must survive.
 */
function stripComments(source) {
	let out = "";
	let i = 0;
	const n = source.length;
	while (i < n) {
		const ch = source[i];
		const next = source[i + 1];

		if (ch === "/" && next === "/") {
			while (i < n && source[i] !== "\n") {
				out += " ";
				i += 1;
			}
			continue;
		}
		if (ch === "/" && next === "*") {
			out += "  ";
			i += 2;
			while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
				out += source[i] === "\n" ? "\n" : " ";
				i += 1;
			}
			out += i < n ? "  " : "";
			i += 2;
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") {
			const quote = ch;
			out += ch;
			i += 1;
			while (i < n) {
				if (source[i] === "\\") {
					out += source.slice(i, i + 2);
					i += 2;
					continue;
				}
				out += source[i];
				if (source[i] === quote) {
					i += 1;
					break;
				}
				i += 1;
			}
			continue;
		}
		out += ch;
		i += 1;
	}
	return out;
}

/**
 * Extract `/api/...` literals with the verb they are called with.
 *
 * The verb is read from the same statement: `method: "POST"` inside the options
 * object, or the default GET. Interpolated segments become the wildcard, so a
 * call to `/api/messages/$\{id\}/react` matches the route declared for
 * `/api/messages/$messageId/react`.
 */
function callsitesIn(file) {
	// Comments are blanked first: see `stripComments`. Offsets and line numbers are
	// unchanged, so the report still points at the real line.
	const source = stripComments(readFileSync(file, "utf8"));
	const out = [];
	// Two shapes, because an interpolated path can hold any expression: a quoted
	// literal runs to its own quote, and a template literal runs to its backtick
	// (`/api/presence/${encodeURIComponent(id)}` is one callsite, not a syntax the
	// old character class could express — it silently dropped every path built with
	// a function call, which is how `/api/presence/*` looked orphaned).
	const re = /(["'])(\/api\/[^"'\n]*)\1|(`)(\/api\/[^`\n]*)\3/g;
	for (const match of source.matchAll(re)) {
		const raw = match[2] ?? match[4] ?? "";
		if (raw === "/api" || raw === "/api/") continue;
		// A query string is not a path segment: `/api/board?${params}` is a call to
		// `/api/board`, and treating the interpolation as a wildcard hid the match.
		const path = raw
			.split("?")[0]
			.replace(/\$\{[^}]*\}/g, "*")
			.replace(/["'`]/g, "")
			.replace(/\/$/, "")
			.replace(/\*+/g, "*");
		// Look at the statement around the literal for an explicit verb. Reading a
		// fixed window rather than parsing JS is deliberate: the goal is to catch a
		// POST to a GET-only route, and every caller in this repo writes the verb on
		// the same call.
		const window = source.slice(match.index, match.index + 400);
		const method = /method:\s*["'](GET|POST|PUT|PATCH|DELETE)["']/.exec(window);
		const line = source.slice(0, match.index).split("\n").length;
		out.push({
			path,
			raw,
			verb: method ? method[1] : "GET",
			file: relative(ROOT, file),
			line,
		});
	}
	return out;
}

const callerFiles = walk(SRC, isCaller);
const callsites = callerFiles.flatMap(callsitesIn);

/* -------------------------------------------------------------------------- */
/* matching                                                                    */
/* -------------------------------------------------------------------------- */

function segments(path) {
	return path.split("/").filter(Boolean);
}

/** A callsite matches when every segment aligns, `*` matching any one segment. */
function matches(callPath, routePathValue) {
	const a = segments(callPath);
	const b = segments(routePathValue);
	if (a.length !== b.length) return false;
	return a.every((segment, i) => segment === "*" || b[i] === "*" || segment === b[i]);
}

function findRoute(callPath) {
	// Exact first so a static route wins over a param route, the same ranking the
	// router applies at runtime.
	if (routes.has(callPath)) return routes.get(callPath);
	for (const route of routes.values()) {
		if (matches(callPath, route.path)) return route;
	}
	return null;
}

const uniqueCalls = new Map();
for (const call of callsites) {
	const key = `${call.verb} ${call.path}`;
	if (!uniqueCalls.has(key)) uniqueCalls.set(key, { ...call, callers: [] });
	uniqueCalls.get(key).callers.push(`${call.file}:${call.line}`);
}

const unmatched = [];
const methodMismatches = [];
const matched = new Set();

for (const call of uniqueCalls.values()) {
	const route = findRoute(call.path);
	if (!route) {
		unmatched.push(call);
		continue;
	}
	matched.add(route.path);
	if (route.verbs.size > 0 && !route.verbs.has(call.verb)) {
		methodMismatches.push({
			...call,
			route: route.file,
			declared: [...route.verbs].sort().join(", "),
		});
	}
}

/* -------------------------------------------------------------------------- */
/* registry                                                                    */
/* -------------------------------------------------------------------------- */

const registrySource = readFileSync(REGISTRY, "utf8");
/** Paths the single-source-of-truth registry advertises, params normalised to `*`. */
const registryPaths = [
	...new Set(
		[...registrySource.matchAll(/["'](\/api\/[A-Za-z0-9/_$.-]*)["']/g)].map(
			(m) =>
				m[1]
					.split("/")
					.map((segment) => (segment.startsWith("$") ? "*" : segment))
					.join("/"),
		),
	),
];

const deadRegistry = registryPaths.filter((path) => !findRoute(path));

/* -------------------------------------------------------------------------- */
/* orphans                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Routes with no in-repo caller. Reachable-by-external-client is legitimate
 * (`/api/health` for a load balancer, `/api/push/subscribe` for the service
 * worker), so these are reported, not failed, unless --strict-orphans.
 */
const orphans = [...routes.values()]
	.filter((route) => !matched.has(route.path))
	.filter((route) => !registryPaths.some((p) => matches(route.path, p)))
	.map((route) => `${route.path} (${route.file})`);

/* -------------------------------------------------------------------------- */
/* report                                                                      */
/* -------------------------------------------------------------------------- */

const summary = {
	routes: routes.size,
	callsites: callsites.length,
	uniqueCalls: uniqueCalls.size,
	unmatched: unmatched.length,
	methodMismatches: methodMismatches.length,
	deadRegistry: deadRegistry.length,
	orphans: orphans.length,
};

if (asJson) {
	process.stdout.write(
		`${JSON.stringify(
			{
				summary,
				unmatched: unmatched.map((c) => ({
					path: c.path,
					verb: c.verb,
					callers: c.callers,
				})),
				methodMismatches,
				deadRegistry,
				orphans,
			},
			null,
			2,
		)}\n`,
	);
} else {
	const line = (s = "") => process.stdout.write(`${s}\n`);
	line("API contract audit");
	line(`  routes declared   ${summary.routes}`);
	line(`  callsites scanned ${summary.callsites} (${summary.uniqueCalls} unique verb+path)`);
	line(`  unmatched         ${summary.unmatched}`);
	line(`  method mismatch   ${summary.methodMismatches}`);
	line(`  dead registry     ${summary.deadRegistry}`);
	line(`  orphan routes     ${summary.orphans}${allowOrphans ? " (allowed)" : ""}`);
	if (unmatched.length) {
		line("\nUNMATCHED — the app calls a path no route answers:");
		for (const c of unmatched.sort((a, b) => a.path.localeCompare(b.path)))
			line(`  ${c.verb.padEnd(6)} ${c.path}\n         ${c.callers.slice(0, 4).join("\n         ")}`);
	}
	if (methodMismatches.length) {
		line("\nMETHOD MISMATCH — the route exists but refuses this verb:");
		for (const c of methodMismatches)
			line(`  ${c.verb.padEnd(6)} ${c.path}  route declares ${c.declared}  (${c.route})\n         ${c.callers.slice(0, 4).join("\n         ")}`);
	}
	if (deadRegistry.length) {
		line("\nDEAD REGISTRY — canonical-routes.ts points at paths that do not exist:");
		for (const p of deadRegistry) line(`  ${p}`);
	}
	if (orphans.length && !allowOrphans) {
		line("\nORPHAN ROUTES — no caller in src/ (webhook/cron/native-only, or unwired):");
		for (const o of orphans.sort()) line(`  ${o}`);
	}
}

const failing =
	summary.unmatched > 0 ||
	summary.methodMismatches > 0 ||
	summary.deadRegistry > 0 ||
	(strictOrphans && summary.orphans > 0);

if (failing && !asJson) {
	process.stdout.write(
		"\nFAIL — the UI and the API disagree. Add the missing route or repoint the caller at its canonical path.\n",
	);
}
process.exit(failing ? 1 : 0);

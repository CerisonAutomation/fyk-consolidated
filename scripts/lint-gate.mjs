#!/usr/bin/env node
/**
 * `pnpm lint:changed` — a blocking lint gate that can actually be turned on.
 *
 * THE PROBLEM IT SOLVES
 * ---------------------
 * The repository carries UI debt: 314 lint errors over `src` + `drizzle`, concentrated in
 * ~60 screen files (`useExhaustiveDependencies`, `a11y/*`, `noExplicitAny`,
 * `useIterableCallbackReturn`). A CI step that fails on all of them fails on every PR, so
 * it is information-free — which is exactly how the current `pnpm lint` step has been read
 * for months (AUDIT §3.17). Mass-fixing 60 design files in one pass is worse: hook
 * dependency arrays and JSX semantics are behaviour changes, and this project cannot afford
 * a diff where the wiring is indistinguishable from a redesign.
 *
 * So the debt is **baselined** rather than ignored:
 *
 *   - `lint-baseline.json` records how many errors each (file, rule) pair has today;
 *   *this* run may not exceed that number, so a PR cannot add a violation to a file that
 *   already has some, and cannot add a *new class* of violation anywhere;
 *   - fixing a violation makes the file report below its allowance, which is printed as a
 *   housekeeping note; `pnpm lint:baseline` shrinks the ledger, and CI enforces the shrink
 *   on `main` (`--strict-baseline`) so the file can only get smaller, never quietly
 *   re-inflated;
 *   - only files changed against the base ref are examined, so the gate costs seconds.
 *
 * WHY NOT `biome lint --changed --since=origin/main`
 * --------------------------------------------------
 * Measured: with an empty diff Biome prints "The list is empty." and **exits 1**, so
 * "nothing to check" fails the build; and in a shallow checkout, or against a base ref CI
 * never fetched, the scan degrades to the same empty list. The diff is therefore computed
 * here with plain `git`, restricted to files that (a) still exist and (b) live in the
 * linted scope — a deleted file in the diff otherwise reaches Biome as
 * `internalError/io  No such file or directory`, which is also measured, not guessed.
 *
 * Base ref: `LINT_BASE`, else `origin/main`, else `HEAD` (which lints the working tree —
 * right on a local branch, and the only option with no remote ref to compare against).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const ROOT = new URL("../", import.meta.url);
const BASELINE_FILE = "lint-baseline.json";
const SCOPES = ["src", "drizzle"];
const LINTABLE = /\.(tsx?|mts|cts)$/;

const baselinePath = new URL(`../${BASELINE_FILE}`, import.meta.url);

const args = new Set(process.argv.slice(2));
const updateBaseline = args.has("--update-baseline");
const strict = args.has("--strict-baseline");

function git(gitArgs) {
	const r = spawnSync("git", gitArgs, { encoding: "utf8" });
	return r.status === 0 ? r.stdout : null;
}

/** Biome's own CLI, through Node, so the shebang/PATH story is identical in CI and here. */
function biome(biomeArgs) {
	return spawnSync(
		process.execPath,
		["./node_modules/@biomejs/biome/bin/biome", ...biomeArgs],
		{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	);
}

/**
 * Parse Biome's JSON report, or stop.
 *
 * This matters more than it looks: `tally` is the only thing between "the tool
 * could not run" and "the code is clean". With a partially installed
 * `node_modules` — which happens here, and in CI whenever an optional platform
 * package like `@biomejs/biome-linux-x64` fails to link — Biome writes to stderr
 * and prints no JSON at all. The old code read that as zero diagnostics, so
 * `lint:changed` reported "0 over the grandfathered allowance" and exited 0,
 * and `--update-baseline` would have written an empty ledger, which is the same
 * lie with a longer tail: every violation in the repository becomes new debt the
 * next run reports.
 */
function parseReport(run, checkedCount) {
	if (run.error) {
		console.error(`lint: could not run biome — ${run.error.message}`);
		process.exit(1);
	}
	const stdout = (run.stdout ?? "").trim();
	if (stdout === "") {
		const tail = (run.stderr ?? "").trim().split("\n").slice(-4).join("\n");
		console.error(
			`lint: biome produced no report for ${checkedCount} file(s) (exit ${run.status}). ` +
				"This is treated as a broken run, not a clean one.\n" +
				(tail ? `  biome said: ${tail}\n` : "") +
				"  Check the install: `pnpm install --frozen-lockfile`.",
		);
		process.exit(1);
	}
	let parsed;
	try {
		parsed = JSON.parse(stdout);
	} catch (error) {
		console.error(
			`lint: biome's JSON report is unreadable (${error.message}); the gate cannot be trusted on a half-written report.`,
		);
		process.exit(1);
	}
	if (!Array.isArray(parsed.diagnostics)) {
		console.error("lint: biome's report has no `diagnostics` array — refusing to read that as clean.");
		process.exit(1);
	}
	// Exit status 1 means "violations found"; with none in the report, the two
	// disagree and one of them is lying about the run.
	if (run.status !== 0 && parsed.diagnostics.length === 0) {
		console.error(
			`lint: biome exited ${run.status} but reported no diagnostics — refusing to read a contradictory run as clean.`,
		);
		process.exit(1);
	}
	return parsed;
}

/** Diagnostics → `file → rule → count`, error severity only (warnings never failed CI). */
function tally(diagnostics) {
	const out = new Map();
	for (const d of diagnostics) {
		if (d.severity !== "error") continue;
		const file = d.location?.path;
		const rule = d.category ?? "unknown";
		if (!file) continue;
		if (!out.has(file)) out.set(file, new Map());
		const byRule = out.get(file);
		byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
	}
	return out;
}

if (updateBaseline) {
	const run = biome([
		"lint",
		"--reporter=json",
		"--max-diagnostics=100000",
		...SCOPES,
	]);
	if (run.error) {
		console.error(`lint: could not run biome — ${run.error.message}`);
		process.exit(1);
	}
	const counts = tally(parseReport(run, SCOPES.length).diagnostics);
	const serialised = {};
	for (const [file, byRule] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
		serialised[file] = Object.fromEntries(
			[...byRule].sort((a, b) => a[0].localeCompare(b[0])),
		);
	}
	const total = [...counts.values()].reduce(
		(sum, byRule) => sum + [...byRule.values()].reduce((s, n) => s + n, 0),
		0,
	);
	writeFileSync(
		baselinePath,
		`${JSON.stringify(
			{
				_comment:
					"Grandfathered Biome lint errors, per file and rule, generated by `pnpm lint:baseline`. It is a debt ledger, not a config: a changed file may not exceed these counts, and the numbers may only go down. Do not add an entry to silence a new violation — fix the violation.",
				"generated-at": new Date().toISOString().slice(0, 10),
				"error-total": total,
				files: serialised,
			},
			null,
			"\t",
		)}\n`,
	);
	console.log(
		`lint: ${BASELINE_FILE} regenerated — ${counts.size} file(s), ${total} grandfathered error(s).`,
	);
	console.log(
		"Review the diff: it should only ever shrink. A growing ledger means somebody wrote new violations.",
	);
	process.exit(0);
}

function resolveBase() {
	const fromEnv = process.env.LINT_BASE?.trim();
	if (fromEnv && git(["rev-parse", "--verify", "--quiet", fromEnv]) !== null) {
		return fromEnv;
	}
	for (const candidate of ["origin/main", "HEAD"]) {
		if (git(["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`]) !== null) {
			return candidate;
		}
	}
	return null;
}

const base = resolveBase();
if (!base) {
	console.log("lint:changed — no base ref available, nothing to compare against.");
	process.exit(0);
}

// Both comparisons, unioned: `${base}...HEAD` is what a PR diff is (commits since the
// merge base), while `${base}` alone also catches the uncommitted edits a developer is
// holding. Using only the first made a local run report "nothing changed" while files in
// the working tree were plainly modified.
const diff = [
	git(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]),
	git(["diff", "--name-only", "--diff-filter=ACMR", base]),
]
	.filter((x) => typeof x === "string")
	.join("\n");
const untracked = git(["ls-files", "--others", "--exclude-standard"]) ?? "";

const changed = [
	...new Set(
		`${diff}\n${untracked}`
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean),
	),
].filter(
	(f) =>
		LINTABLE.test(f) &&
		SCOPES.some((s) => f.startsWith(`${s}/`)) &&
		existsSync(f),
);

if (changed.length === 0) {
	console.log(`lint:changed — no lintable source changed against ${base}.`);
	process.exit(0);
}

let baseline = {};
if (existsSync(baselinePath)) {
	try {
		baseline = JSON.parse(readFileSync(baselinePath, "utf8")).files ?? {};
	} catch (error) {
		console.error(
			`lint:changed — ${BASELINE_FILE} is unreadable (${error.message}); the gate cannot be trusted without it.`,
		);
		process.exit(1);
	}
}

const run = biome(["lint", "--reporter=json", "--max-diagnostics=100000", ...changed]);
const counts = tally(parseReport(run, changed.length).diagnostics);

const failures = [];
const improvements = [];
for (const [file, byRule] of counts) {
	const allowed = baseline[file] ?? {};
	for (const [rule, n] of byRule) {
		const cap = allowed[rule] ?? 0;
		if (n > cap) failures.push({ file, rule, n, cap });
	}
	for (const [rule, cap] of Object.entries(allowed)) {
		const n = byRule.get(rule) ?? 0;
		if (n < cap) improvements.push({ file, rule, n, cap });
	}
}
// A rule the ledger lists but this run did not see, *in a file this run did check*.
// Files outside the diff are deliberately skipped: this run only looked at the changed
// files, so treating "not seen" as "fixed" would make `--strict-baseline` fail on every
// push whose diff does not happen to include all 56 ledger entries.
const checked = new Set(changed);
for (const [file, allowed] of Object.entries(baseline)) {
	if (!checked.has(file)) continue;
	if (counts.has(file)) continue;
	for (const [rule, cap] of Object.entries(allowed)) {
		if (cap > 0) improvements.push({ file, rule, n: 0, cap });
	}
}

console.log(
	`lint:changed — ${changed.length} file(s) checked against ${base}, ${failures.length} over the grandfathered allowance.`,
);
for (const f of failures) {
	console.error(
		`  ${f.file}: ${f.n} × ${f.rule} (baseline allows ${f.cap}) — fix it; do not raise the baseline.`,
	);
}
if (improvements.length > 0) {
	const total = improvements.reduce((s, i) => s + (i.cap - i.n), 0);
	console.log(
		`  ${improvements.length} rule(s) now report fewer errors than the ledger allows (${total} fixed). Run \`pnpm lint:baseline\` to shrink it${strict ? " — required on main" : ""}.`,
	);
}
if (failures.length > 0) {
	console.error(
		"\nlint:changed failed. Each line is a violation this branch added; the count for that file+rule was already grandfathered, so there is no excuse of the form \"the repo is full of these\".",
	);
	process.exit(1);
}
if (strict && improvements.length > 0) {
	console.error(
		"\nlint:changed --strict-baseline: the ledger is stale and the repository is better than it says. Shrink it with `pnpm lint:baseline` and commit the smaller file.",
	);
	process.exit(1);
}
process.exit(0);

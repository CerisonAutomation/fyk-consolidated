import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	findSettingsSection,
	isSettingsSection,
	isWritableField,
	PRIVACY_COLUMNS_IN_SECTIONS,
	refusalReason,
	SETTINGS_SECTION_KEYS,
	SETTINGS_SECTIONS,
	writableFields,
} from "./settings-sections";

/**
 * The settings registry, checked against the schema and the routes that share it.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Seventeen screens posted to seventeen paths that did not exist, and each of them
 * rendered "Saved" from a mutation that had thrown. Replacing that with one route and
 * a registry moves the risk: a registry entry can name a column the schema does not
 * have, or a bag key `PUT /api/settings` strips, and nothing at compile time connects
 * the two. These tests are that connection, written to fail on the shape that broke
 * before — a field that looks stored and is not.
 */
const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const strip = (src: string) =>
	src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

function slice(source: string, from: string, to: string): string {
	const a = source.indexOf(from);
	const b = source.indexOf(to, a + from.length);
	expect(a, `missing anchor: ${from}`).toBeGreaterThanOrEqual(0);
	expect(b, `missing end anchor: ${to}`).toBeGreaterThan(a);
	return source.slice(a, b);
}

/** `model key → column name` for one `pgTable` block in `drizzle/schema.ts`. */
function tableColumns(tableName: string): Map<string, string> {
	const schema = read("drizzle/schema.ts");
	const anchor = `pgTable(\n\t"${tableName}",`;
	const plain = `pgTable("${tableName}", {`;
	const start = schema.includes(anchor)
		? schema.indexOf(anchor)
		: schema.indexOf(plain);
	expect(start, `${tableName} not found in drizzle/schema.ts`).toBeGreaterThan(
		0,
	);
	const body = schema.slice(start, start + 12_000);
	const columns = new Map<string, string>();
	for (const m of body.matchAll(/^\t(\w+):\s*\w+\("([a-z0-9_]+)"/gm))
		columns.set(m[1], m[2]);
	return columns;
}

/** The section keys the generated screens actually request. */
const CALLED_SECTIONS = [
	"accessibility",
	"account-settings",
	"ai-toggles",
	"backup-restore",
	"change-password",
	"data",
	"data-export",
	"deactivate",
	"discreet-icon",
	"dnd",
	"language",
	"location",
	"media",
	"notifications",
	"permissions",
	"pin-lock",
	"two-factor",
];

describe("settings registry: shape", () => {
	it("declares every section the screens call, and nothing unreachable", () => {
		expect(SETTINGS_SECTION_KEYS.length).toBeGreaterThanOrEqual(17);
		for (const key of CALLED_SECTIONS) {
			expect(
				SETTINGS_SECTION_KEYS,
				`${key} is called by a screen but not declared`,
			).toContain(key);
			expect(isSettingsSection(key), key).toBe(true);
			expect(findSettingsSection(key)?.key, key).toBe(key);
		}
		for (const key of SETTINGS_SECTION_KEYS)
			expect(
				CALLED_SECTIONS,
				`${key} is declared but no screen requests it`,
			).toContain(key);
	});

	it("uses url-safe, unique section keys", () => {
		const seen = new Set<string>();
		for (const section of SETTINGS_SECTIONS) {
			expect(section.key, section.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
			expect(seen.has(section.key), `${section.key} declared twice`).toBe(
				false,
			);
			seen.add(section.key);
			expect(section.title.length, section.key).toBeGreaterThan(2);
			expect(section.description.length, section.key).toBeGreaterThan(10);
		}
	});

	it("gives every field a unique key inside its section", () => {
		for (const section of SETTINGS_SECTIONS) {
			const seen = new Set<string>();
			expect(section.fields.length, section.key).toBeGreaterThan(0);
			for (const field of section.fields) {
				expect(field.key, `${section.key}.${field.key}`).toMatch(
					/^[a-zA-Z][a-zA-Z0-9]*$/,
				);
				expect(
					seen.has(field.key),
					`${section.key}.${field.key} declared twice`,
				).toBe(false);
				seen.add(field.key);
				expect(
					field.label.length,
					`${section.key}.${field.key}`,
				).toBeGreaterThan(1);
			}
		}
	});
});

describe("settings registry: every field points at real storage", () => {
	it("names a column that exists on public.users", () => {
		const columns = tableColumns("users");
		expect(columns.size).toBeGreaterThan(40);
		let checked = 0;
		for (const section of SETTINGS_SECTIONS) {
			for (const field of section.fields) {
				if (field.storage !== "users" || !field.column) continue;
				checked += 1;
				expect(
					columns.has(field.column),
					`${section.key}.${field.key} writes users.${field.column}, which drizzle/schema.ts does not declare`,
				).toBe(true);
			}
		}
		expect(checked).toBeGreaterThan(10);
	});

	it("names a column that exists on public.user_app_configs", () => {
		const columns = tableColumns("user_app_configs");
		expect(columns.size).toBeGreaterThan(5);
		let checked = 0;
		for (const section of SETTINGS_SECTIONS) {
			for (const field of section.fields) {
				if (field.storage !== "appConfig" || !field.appConfigField) continue;
				checked += 1;
				expect(
					columns.has(field.appConfigField),
					`${section.key}.${field.key} writes user_app_configs.${field.appConfigField}, which drizzle/schema.ts does not declare`,
				).toBe(true);
			}
		}
		expect(checked).toBeGreaterThanOrEqual(6);
	});

	it("only uses bag keys PUT /api/settings already accepts", () => {
		const route = strip(read("src/routes/api/settings/index.ts"));
		const bagKeys = (anchor: string, stop: string) =>
			new Set(
				[...slice(route, anchor, stop).matchAll(/^\t+(\w+):\s/gm)].map(
					(m) => m[1],
				),
			);
		const notif = bagKeys("const notifSchema = z", "\n\nconst aiSchema");
		const ai = bagKeys("const aiSchema = z", "\n\nconst prefsSchema");
		expect(notif.size).toBeGreaterThanOrEqual(8);
		expect(ai.size).toBeGreaterThanOrEqual(4);

		for (const section of SETTINGS_SECTIONS) {
			for (const field of section.fields) {
				if (field.storage === "notifPrefs")
					expect(
						notif.has(field.key),
						`${section.key}.${field.key} writes notif_prefs.${field.key}, which notifSchema strips`,
					).toBe(true);
				if (field.storage === "aiPrefs")
					expect(
						ai.has(field.key),
						`${section.key}.${field.key} writes ai_prefs.${field.key}, which aiSchema strips`,
					).toBe(true);
			}
		}
	});

	it("keeps the options of a select inside the constraint the database enforces", () => {
		// `discreet_icon` and `app_lock_timeout_sec` are CHECKed in 0028; a registry
		// that offered a ninth icon would produce a write the database refuses.
		const migration = read("supabase/migrations/0028_divine_complete.sql");
		const icons = [...migration.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
		const discreet = findSettingsSection("discreet-icon")?.fields.find(
			(f) => f.key === "discreetIcon",
		);
		expect(discreet?.options?.length).toBeGreaterThanOrEqual(8);
		for (const option of discreet?.options ?? [])
			expect(
				icons,
				`discreet icon '${option}' is not in the 0028 CHECK`,
			).toContain(option);

		const timeout = findSettingsSection("pin-lock")?.fields.find(
			(f) => f.key === "appLockTimeoutSec",
		);
		expect(timeout?.min).toBe(10);
		expect(timeout?.max).toBe(3600);
	});
});

describe("settings registry: nothing claims to store what it cannot", () => {
	it("treats every device, auth and route field as not writable here", () => {
		let checked = 0;
		for (const section of SETTINGS_SECTIONS) {
			for (const field of section.fields) {
				if (!["device", "auth", "route"].includes(field.storage)) continue;
				checked += 1;
				const writable = isWritableField(field);
				if (writable) {
					// The one writable exception: a password, relayed to the provider with
					// the caller's own token and never stored here.
					expect(field.storage, `${section.key}.${field.key}`).toBe("auth");
					expect(field.writeOnly, `${section.key}.${field.key}`).toBe(true);
				} else {
					expect(
						field.canonicalRoute || field.note,
						`${section.key}.${field.key} is refused with no route and no explanation`,
					).toBeTruthy();
				}
			}
		}
		expect(checked).toBeGreaterThan(10);
	});

	it("never returns a write-only field as a value", () => {
		for (const section of SETTINGS_SECTIONS) {
			for (const field of section.fields) {
				if (!field.writeOnly) continue;
				expect(field.type, `${section.key}.${field.key}`).toBe("text");
				expect(
					["auth", "appConfig"].includes(field.storage),
					`${section.key}.${field.key} is write-only but stored in ${field.storage}`,
				).toBe(true);
				expect(field.note, `${section.key}.${field.key}`).toBeTruthy();
			}
		}
	});

	it("explains every refusal in words a screen can render", () => {
		for (const section of SETTINGS_SECTIONS) {
			for (const field of section.fields) {
				if (isWritableField(field)) continue;
				const reason = refusalReason(field);
				expect(reason.length, `${section.key}.${field.key}`).toBeGreaterThan(
					10,
				);
				expect(reason, `${section.key}.${field.key}`).not.toMatch(
					/undefined|null/,
				);
			}
		}
	});

	it("agrees with the privacy map about which columns a switch writes", () => {
		// `/settings/permissions` and `/settings/privacy` must describe the same five
		// columns, or one screen can save a preference the other contradicts.
		for (const column of [
			"hideDistance",
			"hideOnline",
			"hideLastOnline",
			"incognito",
			"visible",
		])
			expect(
				PRIVACY_COLUMNS_IN_SECTIONS,
				`${column} is a privacy column no section writes`,
			).toContain(column);
	});

	it("lists writable fields for a section without inventing any", () => {
		const notifications = findSettingsSection("notifications");
		expect(notifications).toBeTruthy();
		const writable = writableFields(notifications as never).map((f) => f.key);
		expect(writable).toContain("pushNotifications");
		expect(writable).not.toContain("pushSubscription");

		// Sections that own no writes say so, and point at the route that does.
		for (const key of ["deactivate", "backup-restore", "two-factor"]) {
			const section = findSettingsSection(key);
			expect(writableFields(section as never).length, key).toBe(0);
			expect(
				section?.actions?.length,
				`${key} offers no action either`,
			).toBeGreaterThan(0);
		}
	});
});

describe("settings registry: one definition of the export", () => {
	it("keeps EXPORT_COLUMNS in the shared module, not in a route", () => {
		const server = read("src/lib/settings.server.ts");
		expect(server).toContain("export const EXPORT_COLUMNS = {");
		expect(strip(read("src/routes/api/settings/index.ts"))).not.toContain(
			"const EXPORT_COLUMNS = {",
		);
		// The exclusion that makes the download safe to hand over.
		expect(server).not.toContain("lat: users.lat");
		expect(server).not.toContain("trustScore: users.trustScore");
	});
});

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { type DbLike, db } from "@/db";
import { cleanText } from "@/lib/api-helpers";
import { hashPin, validatePin } from "@/lib/app-lock";
import {
	findSettingsSection,
	isWritableField,
	refusalReason,
	type SettingsField,
	type SettingsSection,
} from "@/lib/settings-sections";
import { logError } from "@/lib/logger";
import { twoFactorStatus } from "@/lib/two-factor.server";
import { users, userAppConfigs } from "@/schema";

/**
 * Reading and writing one settings section, against the registry in
 * `#/lib/settings-sections`.
 *
 * THE RULE THIS MODULE ENFORCES
 * -----------------------------
 * A field is written where its truth lives, or the write is refused with the name of
 * the route that owns it. There is no third outcome, and specifically no "accepted
 * and dropped": the generated settings screens used to post a form to a path nothing
 * answered and then render "Saved", which is the same lie `#/lib/settings-map` was
 * written to stop for the privacy switches.
 *
 * So `writeSection` returns `changed` and `refused` side by side, and the route
 * reports both. A screen that posts `{ units: "km" }` learns that `units` is a
 * per-device setting instead of believing the server holds it.
 */

const SCOPE = "settings/sections";

/** The `users` columns a section may write, by registry `column` name. */
const USER_COLUMNS = {
	theme: users.theme,
	accent: users.accent,
	fontSize: users.fontSize,
	gridColumns: users.gridColumns,
	cardStyle: users.cardStyle,
	colorblindMode: users.colorblindMode,
	dndMode: users.dndMode,
	incognito: users.incognito,
	visible: users.visible,
	hideDistance: users.hideDistance,
	hideOnline: users.hideOnline,
	hideLastOnline: users.hideLastOnline,
	language: users.language,
	city: users.city,
	area: users.area,
	displayName: users.displayName,
	handle: users.handle,
} as const;

type UserColumnKey = keyof typeof USER_COLUMNS;

const APP_CONFIG_COLUMNS = {
	discreetEnabled: userAppConfigs.discreetEnabled,
	discreetIcon: userAppConfigs.discreetIcon,
	appLockEnabled: userAppConfigs.appLockEnabled,
	appLockBiometric: userAppConfigs.appLockBiometric,
	appLockTimeoutSec: userAppConfigs.appLockTimeoutSec,
	appLockPinHash: userAppConfigs.appLockPinHash,
} as const;

type AppConfigKey = keyof typeof APP_CONFIG_COLUMNS;

/** Read-only values that are derived rather than stored, computed per request. */
export type DerivedValues = Record<string, unknown>;

export type SectionPayload = {
	section: string;
	title: string;
	description: string;
	values: Record<string, unknown>;
	fields: Array<Omit<SettingsField, "column" | "appConfigField">>;
	actions: SettingsSection["actions"];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readUserRow(userId: string, tx: DbLike) {
	const [row] = await tx
		.select({
			theme: users.theme,
			accent: users.accent,
			fontSize: users.fontSize,
			gridColumns: users.gridColumns,
			cardStyle: users.cardStyle,
			colorblindMode: users.colorblindMode,
			dndMode: users.dndMode,
			incognito: users.incognito,
			visible: users.visible,
			hideDistance: users.hideDistance,
			hideOnline: users.hideOnline,
			hideLastOnline: users.hideLastOnline,
			language: users.language,
			city: users.city,
			area: users.area,
			displayName: users.displayName,
			handle: users.handle,
			latCoarse: users.latCoarse,
			lngCoarse: users.lngCoarse,
			photos: users.photos,
			profileComplete: users.profileComplete,
			createdAt: users.createdAt,
			notifPrefs: users.notifPrefs,
			aiPrefs: users.aiPrefs,
			email: users.email,
			twoFactorEnabled: users.twoFactorEnabled,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return row;
}

async function readAppConfig(userId: string, tx: DbLike) {
	const [row] = await tx
		.select()
		.from(userAppConfigs)
		.where(eq(userAppConfigs.userId, userId))
		.limit(1);
	return row;
}

/**
 * The section's current values, plus the field metadata a screen renders from.
 *
 * Write-only fields (a PIN, a password) are reported as `null` rather than omitted,
 * so a form can show "not set" without the response ever carrying a stored value.
 */
export async function readSection(
	userId: string,
	sectionKey: string,
	tx: DbLike = db,
): Promise<SectionPayload | { error: "unknown-section" } | { error: "no-profile" }> {
	const section = findSettingsSection(sectionKey);
	if (!section) return { error: "unknown-section" };

	const userRow = await readUserRow(userId, tx);
	if (!userRow) return { error: "no-profile" };
	const appConfig = await readAppConfig(userId, tx);
	const notifPrefs = isRecord(userRow.notifPrefs) ? userRow.notifPrefs : {};
	const aiPrefs = isRecord(userRow.aiPrefs) ? userRow.aiPrefs : {};

	// Derived facts a section shows but nothing stores. Each is computed here rather
	// than cached, because a stale value in a settings screen reads as a lie.
	const derived: DerivedValues = {
		photoCount: Array.isArray(userRow.photos) ? userRow.photos.length : 0,
		memberSince: userRow.createdAt?.toISOString() ?? null,
		profileComplete: userRow.profileComplete ?? null,
		email: userRow.email ?? null,
		latCoarse: userRow.latCoarse ?? null,
		lngCoarse: userRow.lngCoarse ?? null,
		bundledLocales: undefined,
	};

	if (sectionKey === "two-factor") {
		const status = await twoFactorStatus(userId, tx);
		derived.enabled = status.enabled;
		derived.recoveryCodesLeft = status.recoveryCodesLeft;
		derived.pendingEnrolment = status.pendingEnrolment;
	}
	if (sectionKey === "account-settings") {
		const status = await twoFactorStatus(userId, tx);
		derived.twoFactorEnabled = status.enabled;
	}

	const values: Record<string, unknown> = {};
	for (const field of section.fields) {
		if (field.writeOnly) {
			values[field.key] = null;
			continue;
		}
		switch (field.storage) {
			case "users": {
				const column = field.column as UserColumnKey | undefined;
				if (column && derived[field.key] !== undefined) {
					values[field.key] = derived[field.key];
					break;
				}
				values[field.key] = column ? (userRow[column] ?? null) : null;
				break;
			}
			case "notifPrefs":
				values[field.key] = notifPrefs[field.key] ?? false;
				break;
			case "aiPrefs":
				values[field.key] = aiPrefs[field.key] ?? false;
				break;
			case "appConfig": {
				const key = field.appConfigField as AppConfigKey | undefined;
				// The PIN hash is never a value, only a fact: is one set.
				if (key === "appLockPinHash") {
					values[field.key] = Boolean(appConfig?.appLockPinHash);
					break;
				}
				values[field.key] = key ? (appConfig?.[key] ?? null) : null;
				break;
			}
			default:
				// device / auth / route: the registry says who owns it, and the
				// response says so too rather than inventing a value.
				values[field.key] = derived[field.key] ?? null;
		}
	}

	return {
		section: section.key,
		title: section.title,
		description: section.description,
		values,
		// `column` and `appConfigField` are storage internals; a screen gets the rest.
		fields: section.fields.map(({ column: _c, appConfigField: _a, ...rest }) => rest),
		actions: section.actions ?? [],
	};
}

export type WriteOutcome = {
	ok: boolean;
	section: string;
	/** Field keys whose value was stored. */
	changed: string[];
	values: Record<string, unknown>;
	/** Field keys that were not stored, and the reason in the words the screen shows. */
	refused: Array<{ key: string; reason: string; route?: string }>;
	/** Keys nobody declared: a typo is a refusal, not a silent drop. */
	unknown: string[];
};

export type WriteFailure =
	| { kind: "unknown-section" }
	| { kind: "no-profile" }
	| { kind: "invalid"; key: string; message: string }
	| { kind: "auth-forward-failed"; status: number; message: string };

/** Coerce and bounds-check one value against its field definition. */
function coerce(
	field: SettingsField,
	value: unknown,
): { ok: true; value: string | number | boolean } | { ok: false; message: string } {
	switch (field.type) {
		case "toggle": {
			if (typeof value !== "boolean")
				return { ok: false, message: `${field.key} must be true or false` };
			return { ok: true, value };
		}
		case "number": {
			const num = typeof value === "number" ? value : Number.parseInt(String(value), 10);
			if (!Number.isFinite(num))
				return { ok: false, message: `${field.key} must be a number` };
			if (field.min !== undefined && num < field.min)
				return { ok: false, message: `${field.key} must be at least ${field.min}` };
			if (field.max !== undefined && num > field.max)
				return { ok: false, message: `${field.key} must be at most ${field.max}` };
			return { ok: true, value: num };
		}
		case "select": {
			const text = cleanText(String(value ?? ""), field.maxLength ?? 64);
			if (!field.options?.includes(text))
				return {
					ok: false,
					message: `${field.key} must be one of: ${field.options?.join(", ") ?? "the listed options"}`,
				};
			return { ok: true, value: text };
		}
		case "text": {
			const text = cleanText(String(value ?? ""), field.maxLength ?? 500);
			return { ok: true, value: text };
		}
		case "info":
			return { ok: false, message: `${field.key} is not a value you can set` };
	}
}

/**
 * Forward a password change to the auth provider using the caller's own token.
 *
 * This API holds no password column and no service key that could set one, so the
 * only honest way to serve the screen is to relay the request with the bearer token
 * the caller already sent — the provider then enforces its own policy and its own
 * "sign out other sessions" behaviour.
 */
export async function forwardPasswordChange(
	accessToken: string,
	newPassword: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
	const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(
		/\/+$/,
		"",
	);
	if (!url)
		return {
			ok: false,
			status: 503,
			message: "Authentication is not configured on this server",
		};
	try {
		const response = await fetch(`${url}/auth/v1/user`, {
			method: "PUT",
			headers: {
				authorization: `Bearer ${accessToken}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ password: newPassword }),
		});
		if (!response.ok) {
			let message = "The auth provider refused the new password";
			try {
				const payload = (await response.json()) as {
					error?: string;
					message?: string;
					msg?: string;
				};
				message = payload.msg ?? payload.message ?? payload.error ?? message;
			} catch {
				// A non-JSON error body is still an error; the status carries the meaning.
			}
			return { ok: false, status: response.status, message };
		}
		return { ok: true };
	} catch (error) {
		logError(SCOPE, error, { stage: "password-forward" });
		return {
			ok: false,
			status: 502,
			message: "Could not reach the auth provider",
		};
	}
}

/**
 * Apply a section write.
 *
 * Every accepted key is validated against its field definition and written to its own
 * store; the bags are merged, never replaced, because a screen posts one switch at a
 * time and a whole-object write would clear its siblings.
 */
export async function writeSection(
	params: {
		userId: string;
		sectionKey: string;
		payload: Record<string, unknown>;
		accessToken?: string | null;
	},
	tx: DbLike = db,
): Promise<WriteOutcome | WriteFailure> {
	const { userId, sectionKey, payload } = params;
	const section = findSettingsSection(sectionKey);
	if (!section) return { kind: "unknown-section" };

	const userRow = await readUserRow(userId, tx);
	if (!userRow) return { kind: "no-profile" };

	const declared = new Map(section.fields.map((field) => [field.key, field]));
	const changed: string[] = [];
	const refused: WriteOutcome["refused"] = [];
	const unknown: string[] = [];

	const userPatch: Record<string, unknown> = {};
	const appConfigPatch: Record<string, unknown> = {};
	const notifPatch: Record<string, unknown> = {};
	const aiPatch: Record<string, unknown> = {};

	for (const [key, rawValue] of Object.entries(payload)) {
		if (key === "action") continue;
		const field = declared.get(key);
		if (!field) {
			unknown.push(key);
			continue;
		}
		if (!isWritableField(field)) {
			refused.push({
				key,
				reason: refusalReason(field),
				route: field.canonicalRoute,
			});
			continue;
		}

		// A password is not stored here at all: it is relayed to the provider.
		if (field.storage === "auth") {
			const text = String(rawValue ?? "");
			if (text.length < 8)
				return {
					kind: "invalid",
					key,
					message: "A password needs at least 8 characters",
				};
			if (!params.accessToken)
				return {
					kind: "auth-forward-failed",
					status: 401,
					message: "Sign in again to change your password",
				};
			const forwarded = await forwardPasswordChange(params.accessToken, text);
			if (!forwarded.ok)
				return {
					kind: "auth-forward-failed",
					status: forwarded.status,
					message: forwarded.message,
				};
			changed.push(key);
			continue;
		}

		// The PIN is the one field whose stored form is a hash of the input.
		if (field.appConfigField === "appLockPinHash") {
			const pin = String(rawValue ?? "");
			const validated = validatePin(pin);
			if (!validated.valid)
				return {
					kind: "invalid",
					key,
					message: validated.error ?? "That PIN is not acceptable",
				};
			appConfigPatch.appLockPinHash = hashPin(pin);
			changed.push(key);
			continue;
		}

		const coerced = coerce(field, rawValue);
		if (!coerced.ok) return { kind: "invalid", key, message: coerced.message };

		switch (field.storage) {
			case "users": {
				const column = field.column as UserColumnKey | undefined;
				if (!column) {
					refused.push({ key, reason: refusalReason(field) });
					break;
				}
				// `language` is stored as the two-letter base subtag: a bundle is
				// chosen per locale, and the column's own length is 2.
				userPatch[column] =
					column === "language"
						? String(coerced.value).slice(0, 2).toLowerCase()
						: coerced.value;
				changed.push(key);
				break;
			}
			case "notifPrefs":
				notifPatch[key] = coerced.value;
				changed.push(key);
				break;
			case "aiPrefs":
				aiPatch[key] = coerced.value;
				changed.push(key);
				break;
			case "appConfig": {
				const column = field.appConfigField as AppConfigKey | undefined;
				if (!column) {
					refused.push({ key, reason: refusalReason(field) });
					break;
				}
				appConfigPatch[column] = coerced.value;
				changed.push(key);
				break;
			}
			default:
				refused.push({
					key,
					reason: refusalReason(field),
					route: field.canonicalRoute,
				});
		}
	}

	const now = new Date();
	if (Object.keys(userPatch).length > 0 || Object.keys(notifPatch).length > 0 || Object.keys(aiPatch).length > 0) {
		const set: Record<string, unknown> = { ...userPatch, updatedAt: now };
		if (Object.keys(notifPatch).length > 0)
			set.notifPrefs = {
				...(isRecord(userRow.notifPrefs) ? userRow.notifPrefs : {}),
				...notifPatch,
			};
		if (Object.keys(aiPatch).length > 0)
			set.aiPrefs = {
				...(isRecord(userRow.aiPrefs) ? userRow.aiPrefs : {}),
				...aiPatch,
			};
		await tx.update(users).set(set).where(eq(users.id, userId));
	}

	if (Object.keys(appConfigPatch).length > 0) {
		// One row per account (0028): upsert so a first save does not need the row to
		// exist, and so two devices saving at once cannot create two.
		await tx
			.insert(userAppConfigs)
			.values({ userId, ...appConfigPatch, updatedAt: now })
			.onConflictDoUpdate({
				target: userAppConfigs.userId,
				set: { ...appConfigPatch, updatedAt: now },
			});
	}

	const values: Record<string, unknown> = {};
	for (const key of changed) {
		const field = declared.get(key);
		if (!field) continue;
		// Never echo a secret back, not even the value just sent.
		values[key] = field.writeOnly ? null : (payload[key] ?? null);
	}

	return {
		ok: changed.length > 0,
		section: section.key,
		changed,
		values,
		refused,
		unknown,
	};
}

/**
 * The columns a "download my data" returns.
 *
 * One list, used by both `GET /api/settings?view=export` and
 * `POST /api/settings/data-export`, because two definitions of "my data" drift: one
 * gains a column and the other quietly becomes the smaller download.
 *
 * Deliberately excluded: `lat`/`lng` (a precise fix is not a preference, and an
 * export file is the last place it should end up), and `role`/`tier`/`trust_score`/
 * `verification`/`is_suspended` (moderation state belongs to a staff process, not to
 * a self-serve JSON download).
 */
export const EXPORT_COLUMNS = {
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
	twoFactorEnabled: users.twoFactorEnabled,
	createdAt: users.createdAt,
	updatedAt: users.updatedAt,
} as const;

export type DataExport = {
	generated_at: string;
	reference: string;
	profile: Record<string, unknown> | null;
};

/** Build the caller's own export document. */
export async function buildExport(
	userId: string,
	tx: DbLike = db,
): Promise<DataExport> {
	const [row] = await tx
		.select(EXPORT_COLUMNS)
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return {
		generated_at: new Date().toISOString(),
		reference: exportReference(),
		profile: (row as Record<string, unknown> | undefined) ?? null,
	};
}

/**
 * A nonce for the export document, so two downloads are distinguishable in a log and
 * a replayed file can be dated. Not a security boundary: the export is the caller's
 * own data, fetched with their own token.
 */
export function exportReference(): string {
	return createHash("sha256")
		.update(randomBytes(16))
		.digest("hex")
		.slice(0, 16);
}

/** Constant-time string compare, for anything this module ever compares. */
export function safeEqual(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}

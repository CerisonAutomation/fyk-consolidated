/**
 * The feature-flag registry, and the only place a flag is defined.
 *
 * WHY A REGISTRY RATHER THAN `if (import.meta.env.X)`
 * ---------------------------------------------------
 * A flag that lives at its use site cannot be listed, cannot be reported to an
 * operator, and cannot be turned off without a deploy. `/api/feature-flags` answers
 * `useFeatureFlags()` in `#/hooks/prd-hooks`, and it can only answer honestly if the
 * set of flags is data.
 *
 * The module is deliberately free of `process.env` and `import.meta.env` so it can be
 * imported by client code, by tests, and by the route alike; reading the environment
 * is the caller's job (`readEnvFlags`). That keeps one definition of a flag and one
 * place where the environment is trusted.
 *
 * PRECEDENCE, highest first
 *   1. per-request overrides (the route's `?flag=` debug parameter, internal roles only)
 *   2. environment (`FYK_FLAG_<KEY>` — `1/true/on/yes` enable, `0/false/off/no` disable)
 *   3. `site_config` row `feature_flags` (jsonb object, operator-editable without a deploy)
 *   4. the flag's `defaultOn`
 */

export type FlagAudience = "all" | "paid" | "internal";

export type FeatureFlag = {
	/** Wire name, camelCase, stable: clients cache on it. */
	key: string;
	/** What the flag gates, in one line an operator can act on. */
	description: string;
	defaultOn: boolean;
	/** Who may see the surface at all; the route narrows further by tier/role. */
	audience: FlagAudience;
};

export const FEATURE_FLAGS: readonly FeatureFlag[] = [
	{
		key: "payments",
		description:
			"Real card checkout; off means every purchase returns 503 with the standard message",
		defaultOn: false,
		audience: "all",
	},
	{
		key: "aiInsights",
		description:
			"Profile analysis, chat health and reply drafting through /api/ai",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "board",
		description: "The public board: posts, comments and join counts",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "shouts",
		description: "Public shouts feed with likes and paid promotion",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "groups",
		description: "Community groups with membership, roles and group messages",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "tribes",
		description: "Interest tribes and tribe-based compatibility overlap",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "fansites",
		description: "Creator fansites with subscriptions",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "events",
		description: "Community events, RSVP and calendar export",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "speedDating",
		description: "Scheduled speed-dating rooms with rounds",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "meetNow",
		description: "Immediate meet-up requests to nearby members",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "videoCalls",
		description: "In-app video and voice calls",
		defaultOn: false,
		audience: "paid",
	},
	{
		key: "voiceNotes",
		description: "Voice notes in chat",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "stories",
		description: "Ephemeral stories with viewer receipts",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "kingPet",
		description: "The pet companion, its streak and its mood log",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "travelMode",
		description: "Browse another city before arriving",
		defaultOn: true,
		audience: "paid",
	},
	{
		key: "incognito",
		description: "Browse without appearing in anyone's deck or footprint",
		defaultOn: true,
		audience: "paid",
	},
	{
		key: "safetyCheckIn",
		description: "Date check-ins with emergency contacts",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "translation",
		description: "Message translation through /api/ai/translation",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "promotions",
		description:
			"Paid entity promotion (groups, shouts, activities, fansites, board posts)",
		defaultOn: true,
		audience: "all",
	},
	{
		key: "pushNotifications",
		description: "Web push delivery; off keeps in-app notifications only",
		defaultOn: true,
		audience: "all",
	},
] as const;

export const FEATURE_FLAG_KEYS: readonly string[] = FEATURE_FLAGS.map(
	(f) => f.key,
);

export function isFeatureFlagKey(value: unknown): value is string {
	return typeof value === "string" && FEATURE_FLAG_KEYS.includes(value);
}

const TRUTHY = new Set(["1", "true", "on", "yes"]);
const FALSY = new Set(["0", "false", "off", "no"]);

/** Parse one environment value; anything unrecognised means "no opinion". */
export function parseFlagValue(raw: string | null | undefined): boolean | null {
	if (raw === null || raw === undefined) return null;
	const v = raw.trim().toLowerCase();
	if (TRUTHY.has(v)) return true;
	if (FALSY.has(v)) return false;
	return null;
}

/** Environment variable name for a flag key: `aiInsights` → `FYK_FLAG_AI_INSIGHTS`. */
export function flagEnvName(key: string): string {
	return `FYK_FLAG_${key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`;
}

export type FlagContext = {
	tier?: string | null;
	role?: string | null;
};

export type FlagResolution = {
	/** key → effective value, for every flag in the registry. */
	flags: Record<string, boolean>;
	/** Which flags the caller may not see at all, and why. */
	hidden: Record<string, string>;
};

/**
 * Resolve the registry against config, environment, audience and overrides.
 *
 * `readEnv` is injected so this stays testable and free of `process.env`: the route
 * passes `(k) => process.env[k]`, a test passes a literal object.
 */
export function resolveFeatureFlags(input: {
	config?: Record<string, unknown> | null;
	readEnv?: (name: string) => string | undefined;
	context?: FlagContext;
	overrides?: Record<string, boolean>;
}): FlagResolution {
	const { config, readEnv, context, overrides } = input;
	const tier = context?.tier ?? "free";
	const paid = tier !== "free";
	const internal = context?.role === "admin" || context?.role === "moderator";

	const flags: Record<string, boolean> = {};
	const hidden: Record<string, string> = {};

	for (const flag of FEATURE_FLAGS) {
		let value = flag.defaultOn;

		const fromConfig = config ? config[flag.key] : undefined;
		const configValue = parseFlagValue(
			typeof fromConfig === "boolean"
				? String(fromConfig)
				: (fromConfig as string | undefined),
		);
		if (configValue !== null) value = configValue;

		const envValue = readEnv
			? parseFlagValue(readEnv(flagEnvName(flag.key)))
			: null;
		if (envValue !== null) value = envValue;

		if (
			overrides &&
			isFeatureFlagKey(flag.key) &&
			typeof overrides[flag.key] === "boolean"
		)
			value = overrides[flag.key];

		if (flag.audience === "paid" && !paid) {
			hidden[flag.key] = "tier";
			flags[flag.key] = false;
			continue;
		}
		if (flag.audience === "internal" && !internal) {
			hidden[flag.key] = "role";
			flags[flag.key] = false;
			continue;
		}
		flags[flag.key] = value;
	}

	return { flags, hidden };
}

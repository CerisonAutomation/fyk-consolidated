import pino, { type LoggerOptions } from "pino";

/**
 * Server-side logger.
 *
 * AI_RULES.md mandates `pino` and forbids `console.*`, but the module it points
 * at (`#/lib/logger`) did not exist — so server modules either used `console.*`
 * or swallowed errors entirely. This is that module.
 *
 * Rules:
 *   - never log secrets, tokens, or raw user content (redact first:
 *     `#/core/lib/redact/text`);
 *   - pretty output in dev, JSON lines in production (log-drain friendly);
 *   - silent under Vitest so failures stay readable.
 */

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const options: LoggerOptions = {
	level: isTest
		? "silent"
		: (process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug")),
	base: undefined,
	// Belt-and-braces: if a secret does reach a log line, mask it.
	redact: {
		paths: [
			"password",
			"*.password",
			"newPassword",
			"*.newPassword",
			"token",
			"*.token",
			"accessToken",
			"*.accessToken",
			"authorization",
			"*.authorization",
			"headers.authorization",
			"headers.cookie",
			"serviceRoleKey",
			"*.serviceRoleKey",
		],
		censor: "[redacted]",
	},
	timestamp: pino.stdTimeFunctions.isoTime,
};

// `pino-pretty` is a devDependency: only ask for it when we are not in a
// production runtime and not under test.
const destination =
	!isProduction && !isTest
		? {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "SYS:HH:MM:ss.l",
					ignore: "pid,hostname",
				},
			}
		: undefined;

export const logger = destination
	? pino({ ...options, transport: destination })
	: pino(options);

/** Short helper for the common "unexpected error in a request handler" case. */
export function logError(
	scope: string,
	error: unknown,
	extra?: Record<string, unknown>,
): void {
	logger.error({ err: error, scope, ...extra }, `${scope}: failed`);
}

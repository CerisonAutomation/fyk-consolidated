/**
 * The reasons a report can carry.
 *
 * `#/routes/api/safety/reports` accepts any 3–80 character reason, so the vocabulary is
 * not enforced by the database — which is exactly why it lives here. The report form,
 * the moderation queue that groups reports by reason, and any future appeal surface have
 * to agree on these strings or "harassment" in one place becomes "Harassment " in
 * another and the counts split.
 *
 * The values are what gets stored, so they are snake_case and stable; `label` is what a
 * person reads. The order is by seriousness, which is the order the select shows.
 */

export const REPORT_REASONS = [
	{ value: "harassment", label: "Harassment or threats" },
	{ value: "hate_speech", label: "Hate speech" },
	{ value: "underage", label: "Appears to be under 18" },
	{ value: "impersonation", label: "Impersonating someone" },
	{ value: "scam", label: "Scam or fake profile" },
	{ value: "explicit_content", label: "Explicit content outside its limits" },
	{ value: "spam", label: "Spam or advertising" },
	{ value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

/** `public.reports.target_type` — the enum the API validates against. */
export const REPORT_TARGET_TYPES = [
	"profile",
	"message",
	"event",
	"board",
	"album",
] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const MAX_DETAILS = 1000;

/** What happens after a report is filed, in the order it happens. */
export const REPORT_PROMISE = [
	"It goes to the moderation queue marked open.",
	"A moderator reads it, with the profile and the messages it refers to.",
	"Nothing is sent to the person you reported, and they are not told who reported them.",
	"Filing the same reason against the same profile twice folds into the first report rather than making a second one.",
] as const;

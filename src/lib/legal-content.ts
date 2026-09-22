/**
 * The legal documents behind `/legal`, as data.
 *
 * WHY IT IS NOT FETCHED
 * ---------------------
 * The screen fetched `/api/legal` and posted to `/api/legal/{id}/action`; neither
 * endpoint existed. Legal text is not dynamic, and a document that ships with the code
 * can be diffed alongside the behaviour it promises — which is the only version of a
 * privacy notice that stays true.
 *
 * These are plain summaries of what this build does, written against the code: each
 * section names the mechanism it describes. They are not a substitute for the operator's
 * own counsel-approved policy, and `operator` below is where that is stated on screen.
 */

export interface LegalSection {
	heading: string;
	body: string;
}

export interface LegalDocument {
	slug: string;
	title: string;
	summary: string;
	/** When this summary was last reconciled with the code. */
	updated: string;
	sections: LegalSection[];
}

/** Shown on the screen, because a template summary is not a legal notice. */
export const OPERATOR_NOTICE =
	"These summaries describe what this build of the app does and are written against the code. A published deployment must replace them with the operator's own counsel-approved policy.";

export const LEGAL_DOCUMENTS: LegalDocument[] = [
	{
		slug: "privacy",
		title: "Privacy",
		summary: "What is collected, what it is used for, and what you can switch off.",
		updated: "2026-09-22",
		sections: [
			{
				heading: "What is stored",
				body: "Your account: the email or phone Supabase Auth issued you, and the profile you fill in. Your activity: sessions, messages, taps, likes, blocks, reports, events you said going to, groups you joined, and the ledger entries behind your bones balance. Your media lives in the media storage bucket, referenced by URLs the profile rows hold.",
			},
			{
				heading: "What is not stored",
				body: "Session identity is a SHA-256 hash of the token, never the token itself, so the device list can recognise a session without holding a credential that could be replayed. Passwords are held by Supabase Auth, not in these tables. Location is used to compute distances and is not written as raw coordinates on the profile.",
			},
			{
				heading: "Who can read it",
				body: "Row Level Security is on for every table holding personal data, and the policies are per-table: a profile is readable while it is visible and not suspended, a block list only by the person who wrote it, a report only by moderators. Server routes read through the service role, which is why the policies are set on tables rather than trusted to the client.",
			},
			{
				heading: "Your controls",
				body: "Visibility, hidden mode, hide-distance, hide-online and hide-last-online are separate switches, and each is enforced where the data would be published. Blocks stop discovery, likes and messages in both directions. You can export your data as JSON and delete your account, which cascades through the tables that reference it.",
			},
			{
				heading: "Retention",
				body: "Messages, sessions and ledger rows stay until you delete your account or the operator's retention schedule removes them. Reports and moderation records are kept after deletion with your identifier removed, because they are the record of a decision that other people may need reviewed.",
			},
		],
	},
	{
		slug: "terms",
		title: "Terms of use",
		summary: "What you agree to, what gets you removed, and what the app promises.",
		updated: "2026-09-22",
		sections: [
			{
				heading: "Who can use this",
				body: "The sign-up form requires you to confirm you are 18 or over, and the age is stored on the profile. An account that appears to belong to somebody under 18 is suspended pending review, and the moderation queue treats that report as urgent.",
			},
			{
				heading: "Your content",
				body: "Photos and messages you upload stay yours; the operator needs the right to store and display them in order to run the product. Verification photos are used for the check, not for promotion. Uploading somebody else's image as your own, or an image generated to impersonate them, is grounds for removal.",
			},
			{
				heading: "What gets an account removed",
				body: "Harassment, hate speech, threats, sexual content involving minors, impersonation, scams and commercial solicitation are removed on report. Reports are read by moderators; a profile under review is excluded from discovery rather than left visible while it is looked at.",
			},
			{
				heading: "Money",
				body: "Bones are a balance in a ledger that records each movement; they are not a currency and hold no value outside the app. Tiers are activated through the same ledger. Purchases are idempotent — a repeated or retried request credits once — and refunds appear as their own ledger entries.",
			},
			{
				heading: "Availability",
				body: "The service is provided as-is. Features that depend on third parties — SMS delivery, push notifications, payment providers — are disabled rather than simulated when those providers are not configured, and the screens say so instead of failing silently.",
			},
		],
	},
	{
		slug: "cookies",
		title: "Cookies and local storage",
		summary: "What the browser keeps, and how to clear it.",
		updated: "2026-09-22",
		sections: [
			{
				heading: "What is used",
				body: "A Supabase Auth session token, which is what signs you in; a small number of UI preferences such as the last filter you used; and no advertising or cross-site trackers, because none are loaded by this build.",
			},
			{
				heading: "Why nothing is sent",
				body: "There is no third-party analytics script in the bundle. Telemetry, where an operator enables it, is first-party and writes to the operator's own store.",
			},
			{
				heading: "Clearing them",
				body: "Signing out removes the local token and revokes the session server-side. Clearing site data in the browser removes the preferences as well; neither action deletes your account, which is done deliberately from the account screen.",
			},
		],
	},
	{
		slug: "community",
		title: "Community guidelines",
		summary: "The behaviour the moderation queue is built around.",
		updated: "2026-09-22",
		sections: [
			{
				heading: "Consent is the whole product",
				body: "A tap is not consent, a match is not consent, and a message is not consent. Reports about pressure after a clear no are reviewed as harassment. Unsending a message removes its body from the conversation rather than only hiding it in the sender's view.",
			},
			{
				heading: "Discrimination",
				body: "Slurs and attacks on the basis of race, ethnicity, nationality, religion, disability, HIV status, body, gender identity or sexuality are removed. The classifier in this build flags; a person decides.",
			},
			{
				heading: "Discretion",
				body: "Screenshots of other people's photos, messages or location are not permitted. Publishing presence information about somebody who has hidden it — online state, last seen, distance — is treated as a privacy violation, not a formatting preference.",
			},
			{
				heading: "Appeals",
				body: "A suspension can be appealed through the safety centre; the appeal is recorded with the decision it challenges, and the moderator handling it sees the original report and the reason given.",
			},
		],
	},
];

/** The document a slug names, or `null` for an unknown slug. */
export function legalDocument(slug: string | undefined): LegalDocument | null {
	if (!slug) return null;
	return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug) ?? null;
}
